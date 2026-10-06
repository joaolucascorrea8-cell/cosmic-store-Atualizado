import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayload } from "@/lib/pix";
import {
  calculateByRobux,
  friendlyByRobuxError,
  normalizeByRobuxUsername,
} from "@/lib/byrobux";
import { getRobuxSettings } from "@/lib/robux-settings";
import {
  cosmicRateFromSupplier,
  isRobuxPurchaseMode,
  readRobuxAmount,
  robuxBreakdown,
  salePriceForGamepass,
} from "@/lib/robux-pricing";
import {
  createAdminNotifications,
  notifyAdminDiscord,
} from "@/lib/notifications";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para comprar Robux." },
      { status: 401 },
    );

  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    mode?: unknown;
    link?: unknown;
    checkoutToken?: unknown;
    expectedPrice?: unknown;
  } | null;
  const amount = readRobuxAmount(body?.amount);
  const mode = body?.mode;
  const link = typeof body?.link === "string" ? body.link.trim() : "";
  const token =
    typeof body?.checkoutToken === "string" ? body.checkoutToken : "";
  if (!amount || !isRobuxPurchaseMode(mode))
    return NextResponse.json(
      { error: "Quantidade ou opção de taxa inválida." },
      { status: 400 },
    );
  if (link.length < 20 || link.length > 500)
    return NextResponse.json(
      { error: "Cole um link de GamePass válido." },
      { status: 400 },
    );
  if (!UUID_V4.test(token))
    return NextResponse.json(
      { error: "Sessão de compra inválida. Atualize a página." },
      { status: 400 },
    );

  const admin = createAdminClient();
  const existing = await admin
    .from("orders")
    .select("id,order_code,status,total,order_type")
    .eq("user_id", user.id)
    .eq("checkout_token", token)
    .maybeSingle();
  if (existing.data) {
    if (existing.data.order_type !== "robux")
      return NextResponse.json(
        { error: "Esta sessão já foi usada em outro pedido." },
        { status: 409 },
      );
    return NextResponse.json({ order: existing.data, created: false });
  }

  try {
    const settings = await getRobuxSettings();
    if (!settings.enabled)
      return NextResponse.json(
        { error: "As compras de Robux estão temporariamente pausadas." },
        { status: 503 },
      );
    const quote = await calculateByRobux(link);
    const item = quote.items?.[0];
    if (!item || item.error)
      return NextResponse.json(
        { error: "Não conseguimos validar esse GamePass." },
        { status: 400 },
      );
    const supplierK = Number(quote.rateBrlPerThousand);
    if (!Number.isFinite(supplierK) || supplierK <= 0)
      throw new Error("Cotação inválida do fornecedor.");
    if (supplierK > settings.maxSupplierK)
      return NextResponse.json(
        {
          error:
            "A cotação subiu acima do limite permitido. Tente novamente mais tarde.",
        },
        { status: 503 },
      );

    const breakdown = robuxBreakdown(amount, mode);
    if (Number(item.robux) !== breakdown.gamepassRobux)
      return NextResponse.json(
        {
          error: `O preço do GamePass mudou. Configure-o para ${breakdown.gamepassRobux.toLocaleString("pt-BR")} Robux e verifique novamente.`,
        },
        { status: 409 },
      );

    const cosmicK = cosmicRateFromSupplier(supplierK, settings);
    const total = salePriceForGamepass(breakdown.gamepassRobux, cosmicK);
    const robloxUsername = normalizeByRobuxUsername(item.username);
    if (
      typeof body?.expectedPrice !== "number" ||
      Math.round(body.expectedPrice * 100) !== Math.round(total * 100)
    )
      return NextResponse.json(
        {
          error:
            "A cotação mudou desde a verificação. Verifique o GamePass novamente antes de gerar o Pix.",
          currentPrice: total,
          currentCosmicK: cosmicK,
        },
        { status: 409 },
      );
    const orderCode = `COSMIC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const pixPayload = createPixPayload(total, orderCode);
    const supplierCost = Number(item.priceBrl);
    const { data: result, error } = await admin.rpc(
      "create_robux_store_order",
      {
        p_user_id: user.id,
        p_checkout_token: token,
        p_order_code: orderCode,
        p_pix_payload: pixPayload,
        p_total: total,
        p_mode: mode,
        p_requested_robux: breakdown.requestedRobux,
        p_gamepass_robux: breakdown.gamepassRobux,
        p_net_robux: breakdown.netRobux,
        p_gamepass_url: link,
        p_gamepass_id: item.id,
        p_roblox_username: robloxUsername,
        p_supplier_k: supplierK,
        p_cosmic_k: cosmicK,
        p_supplier_cost: supplierCost,
      },
    );
    if (error || !result?.order) {
      if (error?.code === "P0001")
        return NextResponse.json({ error: error.message }, { status: 409 });
      console.error("[robux/order]", error);
      return NextResponse.json(
        {
          error:
            "Não foi possível criar o pedido de Robux. Confira se a atualização SQL foi aplicada.",
        },
        { status: 500 },
      );
    }

    const order = result.order as {
      id: string;
      order_code: string;
      total: number;
    };
    if (result.created) {
      await Promise.allSettled([
        createAdminNotifications(
          "Novo pedido de Robux",
          `${order.order_code}: ${breakdown.netRobux.toLocaleString("pt-BR")} Robux previstos para ${robloxUsername}.`,
          `/admin/pedidos/${order.id}`,
          user.id,
        ),
        notifyAdminDiscord(
          `🟣 Novo pedido de Robux **${order.order_code}** — ${breakdown.gamepassRobux.toLocaleString("pt-BR")} no GamePass — ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        ),
      ]);
    }
    return NextResponse.json({ order, created: Boolean(result.created) });
  } catch (error) {
    console.error("[robux/order]", error);
    return NextResponse.json(
      { error: friendlyByRobuxError(error) },
      { status: 503 },
    );
  }
}
