import { UUID_PATTERN } from "@/lib/catalog";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAdminNotifications,
  notifyAdminDiscord,
  sendEmail,
} from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    path?: unknown;
  } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  if (!path.startsWith(`${user.id}/${id}/`))
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,order_code,total,user_id,status,proof_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order)
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    );
  if (!["awaiting_payment", "proof_rejected"].includes(order.status))
    return NextResponse.json(
      {
        error: "O pedido mudou de situação. Abra o pedido para acompanhar.",
        proofReceived:
          Boolean(order.proof_path) &&
          [
            "proof_submitted",
            "under_review",
            "paid",
            "preparing_delivery",
            "delivered",
          ].includes(order.status),
      },
      { status: 409 },
    );

  // Verify the object exists in the private bucket before associating it with the order.
  const fileName = path.split("/").pop() ?? "";
  if (!/^comprovante(?:-[0-9a-f-]{36})?\.(jpg|png|pdf)$/.test(fileName))
    return NextResponse.json(
      { error: "Nome de arquivo inválido." },
      { status: 400 },
    );
  const { data: files, error: listError } = await admin.storage
    .from("payment-proofs")
    .list(`${user.id}/${id}`, { limit: 1, search: fileName });
  if (listError || !files?.some((file) => file.name === fileName))
    return NextResponse.json(
      { error: "Comprovante não encontrado. Envie o arquivo novamente." },
      { status: 400 },
    );
  // Compare-and-set avoids duplicate admin e-mails/webhook notifications on double-submit.
  const { data: updated, error } = await admin
    .from("orders")
    .update({
      status: "proof_submitted",
      proof_path: path,
      proof_uploaded_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["awaiting_payment", "proof_rejected"])
    .select("id")
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Não foi possível registrar o comprovante." },
      { status: 500 },
    );
  if (!updated) {
    const { data: current } = await admin
      .from("orders")
      .select("status,proof_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    return NextResponse.json(
      {
        error: "O pedido mudou de situação. Abra seu pedido para acompanhar.",
        proofReceived:
          Boolean(current?.proof_path) &&
          [
            "proof_submitted",
            "under_review",
            "paid",
            "preparing_delivery",
            "delivered",
          ].includes(current?.status ?? ""),
      },
      { status: 409 },
    );
  }

  const text = `🔔 Novo comprovante: **${order.order_code}** — ${Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  await Promise.allSettled([
    createAdminNotifications(
      "Novo comprovante recebido",
      `O pedido ${order.order_code} enviou um comprovante.`,
      `/admin/pedidos/${id}`,
      user.id,
    ),
    notifyAdminDiscord(text),
    sendEmail(
      process.env.ADMIN_NOTIFICATION_EMAIL,
      `Novo comprovante — ${order.order_code}`,
      `<h2>Novo comprovante recebido</h2><p>Pedido ${order.order_code}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cosmic-store-blush.vercel.app"}/admin/pedidos/${id}">Abrir pedido</a></p>`,
    ),
  ]);
  return NextResponse.json({ ok: true });
}
