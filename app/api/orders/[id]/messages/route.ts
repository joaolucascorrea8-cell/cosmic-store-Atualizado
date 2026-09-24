import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeChatAttachment, uploadChatAttachment, validateChatAttachment, withSignedChatAttachments } from "@/lib/chat-attachments";
import { createAdminNotifications, notifyAdminDiscord, notifyCustomer, sendEmail, type NotificationAttachment } from "@/lib/notifications";

async function getAccess(orderId: string, userId: string) {
  const admin = createAdminClient();
  const [{ data: order }, { data: adminRole }] = await Promise.all([
    admin.from("orders").select("user_id,order_code,status,chat_closed_at").eq("id", orderId).maybeSingle(),
    admin.from("admins").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  const isAdmin = Boolean(adminRole && ["owner", "admin"].includes(adminRole.role));
  if (!order || (!isAdmin && order.user_id !== userId)) return null;
  return { admin, order, isAdmin };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const access = await getAccess(id, user.id);
  if (!access) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const { data, error } = await access.admin
    .from("order_messages")
    .select("id,user_id,message,created_at,attachment_path,attachment_name,attachment_type,profiles(nickname,avatar_url)")
    .eq("order_id", id)
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
  if (message.length > 1000) return NextResponse.json({ error: "A mensagem pode ter no máximo 1000 caracteres." }, { status: 400 });
  const checkedFile = validateChatAttachment(file);
  if (!checkedFile.ok) return NextResponse.json({ error: checkedFile.error }, { status: 400 });
  if (!message && !file) return NextResponse.json({ error: "Digite uma mensagem ou selecione uma imagem." }, { status: 400 });

  const access = await getAccess(id, user.id);
  if (!access) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const { admin, order, isAdmin } = access;
  if (!["paid", "preparing_delivery", "delivered"].includes(order.status) || order.chat_closed_at) {
    return NextResponse.json({ error: "Este atendimento está encerrado." }, { status: 403 });
  }

  const { data: lastMessage } = await admin
    .from("order_messages")
    .select("created_at")
    .eq("order_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastMessage && Date.now() - new Date(lastMessage.created_at).getTime() < 1200) {
    return NextResponse.json({ error: "Aguarde um instante antes de enviar novamente." }, { status: 429 });
  }

  let uploaded: Awaited<ReturnType<typeof uploadChatAttachment>> | null = null;
  try {
    if (file) uploaded = await uploadChatAttachment("orders", id, file);
    const { error } = await supabase.from("order_messages").insert({
      order_id: id,
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

  const notificationAttachment: NotificationAttachment | undefined = uploaded ? {
    filename: uploaded.name,
    contentType: uploaded.type,
    bytes: uploaded.bytes,
  } : undefined;

  if (isAdmin) {
    await notifyCustomer(
      order.user_id,
      uploaded ? "Nova imagem no seu pedido" : "Nova mensagem no seu pedido",
      `A equipe respondeu no pedido ${order.order_code}.`,
      `/pedidos/${id}`,
      notificationAttachment,
    );
  } else {
    const title = uploaded ? "Cliente enviou uma imagem" : "Nova mensagem de pedido";
    const body = `O cliente enviou uma nova mensagem no pedido ${order.order_code}.`;
    await Promise.allSettled([
      createAdminNotifications(title, body, `/admin/pedidos/${id}`, user.id),
      notifyAdminDiscord(`💬 Nova mensagem no pedido **${order.order_code}**${uploaded ? " com imagem" : ""}`),
      sendEmail(
        process.env.ADMIN_NOTIFICATION_EMAIL,
        `${uploaded ? "Nova imagem" : "Nova mensagem"} — ${order.order_code}`,
        `<p>O cliente enviou uma nova mensagem${uploaded ? " com uma imagem" : ""}.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/admin/pedidos/${id}">Abrir conversa</a></p>`,
        notificationAttachment,
      ),
    ]);
  }

  return NextResponse.json({ ok: true });
}
