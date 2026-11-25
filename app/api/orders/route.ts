import { readOrderDisplayItems } from "@/lib/product-context-server";
import {recordStoreIssue} from "@/lib/store-issues";
import { checkoutItems } from "@/lib/checkout-request";
import { orderIsPayable } from "@/lib/order-status";
import { couponCode } from "@/lib/coupons";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayload } from "@/lib/pix";
import { checkoutReady } from "@/lib/checkout-readiness";
import {
  createAdminNotifications,
  notifyAdminDiscord,
} from "@/lib/notifications";

type CreatedOrder = {
  id: string; order_code: string; order_type: string; status: string; total: number;
  game_nickname: string; pix_payload: string; paid_at?: string | null;
  coupon_code?: string | null; subtotal?: number; discount_total?: number; delivery_hours?: number;
};
type RequestItems = NonNullable<ReturnType<typeof checkoutItems>>;

async function orderResponse(order: CreatedOrder, request: {
  items: RequestItems; nickname: string; code: string; total: number;
}, replay: boolean) {
  const conflict = () => NextResponse.json({ error: "Esta tentativa já pertence a outro pedido. Confira Meus pedidos." }, { status: 409 });
  if (order.order_type !== "store") return conflict();
  const client = await createClient();
  const items = await readOrderDisplayItems(client, order.id, true);
  if (replay && (request.nickname !== order.game_nickname || request.code !== (order.coupon_code ?? "") ||
      Math.round(request.total * 100) !== Math.round(Number(order.total) * 100) ||
      request.items.length !== items.length || !request.items.every(line => items.some(saved =>
        saved.product_id === line.id && saved.quantity === line.quantity &&
        Math.round(Number(saved.unit_price) * 100) === Math.round(line.unit_price * 100))))) return conflict();
  let payable = orderIsPayable(order);
  if (replay && payable) {
    const { data: receipts, error } = await client.from("order_additional_payments").select("amount").eq("order_id", order.id).limit(1);
    if (error) throw new Error("Não foi possível conferir os recebimentos do pedido.");
    payable = !receipts?.length;
  }
  const qrCode = payable ? await QRCode.toDataURL(order.pix_payload, { width: 440, margin: 2, errorCorrectionLevel: "M" }) : "";
  const { id, order_code, order_type, status, total, game_nickname, coupon_code, subtotal, discount_total, delivery_hours } = order;
  return NextResponse.json({
    order: { id, order_code, order_type, status, total, game_nickname, coupon_code, subtotal, discount_total, delivery_hours, pix_payload: payable ? order.pix_payload : null },
    qrCode, items,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para finalizar." },
      { status: 401 },
    );

  const body = (await request.json().catch(() => null)) as {
    items?: unknown;
    cartOwner?: unknown;
    gameNickname?: unknown;
    checkoutToken?: unknown;
    couponCode?: unknown;
    expectedTotal?: unknown;
  } | null;
  const nickname =
    typeof body?.gameNickname === "string" ? body.gameNickname.trim() : "";
  if (nickname.length < 2 || nickname.length > 60)
    return NextResponse.json(
      { error: "Informe um nickname válido do jogo." },
      { status: 400 },
    );

  const token =
    typeof body?.checkoutToken === "string" ? body.checkoutToken : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    return NextResponse.json(
      { error: "Sessão de checkout inválida. Atualize a página." },
      { status: 400 },
    );
  }

  if (body?.cartOwner && body.cartOwner !== user.id)
    return NextResponse.json({ error: "A conta mudou. Confira o carrinho da conta atual." }, { status: 409 });
  const items = checkoutItems(body?.items);
  const code = couponCode(body?.couponCode);
  if (!items || code.length > 30)
    return NextResponse.json({ error: "Confira os itens, quantidades e cupom do carrinho." }, { status: 400 });
  // Clientes antigos sem cupom podem enviar apenas os valores unitários.
  const total = body?.expectedTotal ?? (!code ? items.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0) / 100 : null);
  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0 || !Number.isSafeInteger(Math.round(total * 100)))
    return NextResponse.json({ error: "Confira o total do pedido." }, { status: 400 });
  const admin = createAdminClient();
  if (!(await checkoutReady())) return NextResponse.json({ error: "As compras estão temporariamente indisponíveis. Se já pagou, procure o suporte." }, { status: 503 });
  const orderCode = `COSMIC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  try {
    const pixPayload = createPixPayload(total, orderCode);
    const { data: result, error: orderError } = await admin.rpc(
      "create_store_order_with_coupon",
      {
        p_user_id: user.id,
        p_checkout_token: token,
        p_nickname: nickname,
        p_order_code: orderCode,
        p_pix_payload: pixPayload,
        p_expected_total: total,
        p_code: code,
        p_items: items,
      },
    );
    if (orderError || !result?.order) {
      if (orderError?.code === "P0001")
        return NextResponse.json(
          { error: orderError.message },
          { status: 409 },
        );
      throw orderError ?? new Error("Não foi possível criar o pedido.");
    }
    const order = result.order as CreatedOrder;
    if (!result.created) return await orderResponse(order, { items, nickname, code, total }, true);

    await Promise.allSettled([
      createAdminNotifications(
        "Novo pedido recebido",
        `Pedido ${order.order_code} acabou de ser criado.`,
        `/admin/pedidos/${order.id}`,
        user.id,
      ),
      notifyAdminDiscord(
        `🛒 Novo pedido **${order.order_code}** — ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      ),
    ]);
    return await orderResponse(order, { items, nickname, code, total }, false);
  } catch (error) {
    await recordStoreIssue("checkout",error,"/api/orders");
    console.error(
      "Falha no checkout:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    return NextResponse.json(
      {
        error:
          "Não foi possível criar o pedido. Tente novamente sem pagar duas vezes.",
      },
      { status: 500 },
    );
  }
}
