import { validateAccountOrder } from "@/lib/robux-accounts/service";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/catalog";
export const maxDuration = 300;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { data: order, error } = await client
    .from("orders")
    .select(
      "id,order_code,status,total,pix_payload,game_nickname,subtotal,discount_total,coupon_code,delivery_hours,order_type",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Não foi possível carregar o pedido." },
      { status: 500 },
    );
  if (!order)
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    );
  if (order.order_type === "robux_account" && ["awaiting_payment", "proof_rejected"].includes(order.status)) {
    try { await validateAccountOrder(id, true); }
    catch { return NextResponse.json({ error: "Não conseguimos confirmar a conta para pagamento. Abra seu pedido e fale com a equipe antes de pagar." }, { status: 409 }); }
  }
  const qrCode = ["awaiting_payment", "proof_rejected"].includes(order.status)
    ? await QRCode.toDataURL(order.pix_payload, {
        width: 440,
        margin: 2,
        errorCorrectionLevel: "M",
      })
    : "";
  return NextResponse.json(
    { order, qrCode },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
