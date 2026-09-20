import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminDiscord, sendEmail } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { path?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  if (!path.startsWith(`${user.id}/${id}/`)) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,order_code,total,user_id,status").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!order || !["awaiting_payment", "proof_rejected"].includes(order.status)) return NextResponse.json({ error: "Este pedido não aceita comprovante agora." }, { status: 400 });

  const { error } = await admin.from("orders").update({ status: "proof_submitted", proof_path: path, proof_uploaded_at: new Date().toISOString(), rejection_reason: null }).eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível registrar o comprovante." }, { status: 500 });

  const text = `🔔 Novo comprovante: **${order.order_code}** — ${Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  await Promise.allSettled([
    notifyAdminDiscord(text),
    sendEmail(process.env.ADMIN_NOTIFICATION_EMAIL, `Novo comprovante — ${order.order_code}`, `<h2>Novo comprovante recebido</h2><p>Pedido ${order.order_code}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/admin/pedidos/${id}">Abrir pedido</a></p>`),
  ]);
  return NextResponse.json({ ok: true });
}
