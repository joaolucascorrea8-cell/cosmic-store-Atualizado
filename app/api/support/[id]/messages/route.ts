import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeChatAttachment, uploadChatAttachment, validateChatAttachment, withSignedChatAttachments } from "@/lib/chat-attachments";
import { createAdminNotifications, notifyAdminDiscord, notifyCustomer, type NotificationAttachment } from "@/lib/notifications";

async function getAccess(ticketId: string, userId: string) {
  const admin = createAdminClient();
  const [{ data: ticket }, { data: adminRole }] = await Promise.all([
    admin.from("support_tickets").select("user_id,subject,status").eq("id", ticketId).maybeSingle(),
    admin.from("admins").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  const isAdmin = Boolean(adminRole && ["owner", "admin"].includes(adminRole.role));
  if (!ticket || (!isAdmin && ticket.user_id !== userId)) return null;
  return { admin, ticket, isAdmin };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const access = await getAccess(id, user.id);
  if (!access) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const { data, error } = await access.admin
    .from("support_messages")
    .select("id,user_id,message,created_at,attachment_path,attachment_name,attachment_type,profiles(nickname)")
    .eq("ticket_id", id)
    .order("created_at");
  if (error) return NextResponse.json({ error: "Não foi possível carregar a conversa." }, { status: 500 });
  const messages = await withSignedChatAttachments(data ?? []);
  return NextResponse.json({ messages });
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const rawMessage = form.get("message");
    const rawFile = form.get("attachment");
    return {
      message: typeof rawMessage === "string" ? rawMessage.trim() : "",
      file: rawFile instanceof File && rawFile.size > 0 ? rawFile : null,
    };
  }
  const body = await request.json().catch(() => null) as { message?: unknown } | null;
  return { message: typeof body?.message === "string" ? body.message.trim() : "", file: null as File | null };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { message, file } = await parseRequest(request);
  if (message.length > 1500) return NextResponse.json({ error: "A mensagem pode ter no máximo 1500 caracteres." }, { status: 400 });
  const checkedFile = validateChatAttachment(file);
  if (!checkedFile.ok) return NextResponse.json({ error: checkedFile.error }, { status: 400 });
  if (!message && !file) return NextResponse.json({ error: "Digite uma mensagem ou selecione uma imagem." }, { status: 400 });

  const access = await getAccess(id, user.id);
  if (!access) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });
  const { admin, ticket, isAdmin } = access;
  if (ticket.status === "closed") return NextResponse.json({ error: "Este atendimento está encerrado." }, { status: 403 });

  let uploaded: Awaited<ReturnType<typeof uploadChatAttachment>> | null = null;
  try {
    if (file) uploaded = await uploadChatAttachment("support", id, file);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: id,
      user_id: user.id,
      message,
      attachment_path: uploaded?.path ?? null,
      attachment_name: uploaded?.name ?? null,
      attachment_type: uploaded?.type ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (uploaded?.path) await removeChatAttachment(uploaded.path);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar." }, { status: 400 });
  }

  await admin.from("support_tickets").update({
    status: isAdmin ? "answered" : "open",
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  const notificationAttachment: NotificationAttachment | undefined = uploaded ? {
    filename: uploaded.name,
    contentType: uploaded.type,
    bytes: uploaded.bytes,
  } : undefined;

  if (isAdmin) {
    await notifyCustomer(
      ticket.user_id,
      uploaded ? "Nova imagem do suporte" : "Resposta do suporte",
      `A equipe respondeu: ${ticket.subject}`,
      `/suporte/${id}`,
      notificationAttachment,
    );
  } else {
    const title = uploaded ? "Cliente enviou uma imagem no suporte" : "Nova mensagem no suporte";
    await Promise.allSettled([
      createAdminNotifications(title, `Nova resposta em: ${ticket.subject}`, `/admin/suporte/${id}`, user.id),
      notifyAdminDiscord(`🛟 Nova mensagem no suporte: **${ticket.subject}**${uploaded ? " com imagem" : ""}`),
    ]);
  }

  return NextResponse.json({ ok: true });
}
