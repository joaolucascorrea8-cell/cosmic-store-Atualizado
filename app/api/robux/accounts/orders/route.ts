import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayload } from "@/lib/pix";
import { createAdminNotifications } from "@/lib/notifications";
import {
  accountSettings,
  validateOffer,
  takeLimit,
  AccountUnavailable,
} from "@/lib/robux-accounts/service";
import { publicOffer } from "@/lib/providers/byrobux/accounts-parser";
import { readAccountPolicy } from "@/lib/robux-accounts/policy";
import { UUID_PATTERN } from "@/lib/catalog";
export const maxDuration = 300;
export async function POST(request: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para continuar." },
      { status: 401 },
    );
  const body = await request.json().catch(() => null);
  if (
    !/^[a-f0-9]{64}$/.test(body?.offerId ?? "") ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      body?.checkoutToken ?? "",
    ) ||
    typeof body?.expectedPrice !== "number" ||
    !Number.isFinite(body.expectedPrice) ||
    body.policyAccepted !== true ||
    typeof body.policyVersion !== "string" ||
    !UUID_PATTERN.test(body.policyVersion)
  )
    return NextResponse.json(
      { error: "Escolha a conta e confirme a leitura da política de reembolso." },
      { status: 400 },
    );
  try {
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("orders")
      .select("id,order_code,total,order_type,robux_account_orders(offer_id)")
      .eq("user_id", user.id)
      .eq("checkout_token", body.checkoutToken)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const snapshot = Array.isArray(existing.robux_account_orders)
        ? existing.robux_account_orders[0]
        : existing.robux_account_orders;
      if (
        existing.order_type !== "robux_account" ||
        snapshot?.offer_id !== body.offerId
      )
        return NextResponse.json(
          { error: "Esta sessão pertence a outro pedido." },
          { status: 409 },
        );
      return NextResponse.json({
        order: {
          id: existing.id,
          order_code: existing.order_code,
          total: existing.total,
        },
        created: false,
      });
    }
    const policy = await readAccountPolicy();
    if (body.policyVersion !== policy.version)
      return NextResponse.json({ error: "A política foi atualizada. Leia a versão atual e confirme novamente.", policy }, { status: 409 });
    await takeLimit(`user:${user.id}`, 10);
    const settings = await accountSettings();
    if (!settings.enabled)
      return NextResponse.json(
        { error: "As compras de contas estão pausadas." },
        { status: 503 },
      );
    const offer = await validateOffer(body.offerId);
    const safe = publicOffer(offer, settings.margin_per_thousand);
    if (Math.round(body.expectedPrice * 100) !== Math.round(safe.price * 100))
      return NextResponse.json(
        {
          error:
            "O preço foi atualizado. Confira o novo valor e clique novamente para confirmar.",
          offer: safe,
        },
        { status: 409 },
      );
    const code = `COSMIC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const { data, error } = await admin.rpc("create_robux_account_order_with_policy", {
      p_user_id: user.id,
      p_token: body.checkoutToken,
      p_code: code,
      p_pix: createPixPayload(safe.price, code),
      p_offer: offer,
      p_expected: safe.price,
      p_policy_version: policy.version,
      p_policy_accepted: true,
    });
    if (error) {
      console.error("[robux-accounts/create]", error);
      return NextResponse.json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : "Não foi possível criar o pedido. Tente novamente.",
        },
        { status: 409 },
      );
    }
    if (data.created)
      await createAdminNotifications(
        "Pedido de conta com Robux",
        `${data.order.order_code}: ${offer.robux.toLocaleString("pt-BR")} Robux.`,
        `/admin/pedidos/${data.order.id}`,
        user.id,
      ).catch((error) => console.error("[robux-accounts/notification]", error));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[robux-accounts/order]", error);
    return NextResponse.json(
      {
        error:
          error instanceof AccountUnavailable
            ? error.message
            : "Não conseguimos confirmar esta conta agora. Aguarde alguns segundos e tente novamente.",
      },
      { status: error instanceof AccountUnavailable ? 409 : 503 },
    );
  }
}
