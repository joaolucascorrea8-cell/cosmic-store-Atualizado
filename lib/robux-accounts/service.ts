import "server-only";
import { groupAccountOptions } from "./presentation";
import { readAccountPolicy } from "./policy";
import { getStoreService } from "@/lib/store-service-server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchCatalog,
  findQuoteAccount,
} from "@/lib/providers/byrobux/accounts";
import {
  AccountOffer,
  AccountQuote,
  publicOffer,
} from "@/lib/providers/byrobux/accounts-parser";

export type AccountSettings = {
  enabled: boolean;
  margin_per_thousand: number;
  min_cosmic_k: number;
};
export type CatalogState = {
  quotes: AccountQuote[];
  offers: AccountOffer[];
  diagnostics: string[];
  last_complete_at: string | null;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  next_attempt_at: string;
  lease_until: string | null;
};
const maxAge = 10 * 60 * 1000;
function assertOk(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function accountSettings(): Promise<AccountSettings> {
  const { data, error } = await createAdminClient()
    .from("robux_account_settings")
    .select("enabled,margin_per_thousand,min_cosmic_k")
    .eq("id", 1)
    .single();
  assertOk(error);
  if (!data) throw new Error("Configuração de contas ausente.");
  return {
    enabled: Boolean(data.enabled),
    margin_per_thousand: Number(data.margin_per_thousand),
    min_cosmic_k: Number(data.min_cosmic_k),
  };
}
export async function readCatalog(): Promise<CatalogState> {
  const { data, error } = await createAdminClient()
    .from("robux_account_catalog")
    .select(
      "quotes,offers,diagnostics,last_complete_at,last_success_at,last_attempt_at,last_error,next_attempt_at,lease_until",
    )
    .eq("id", 1)
    .single();
  assertOk(error);
  if (!data) throw new Error("Cache de contas ausente.");
  return data as CatalogState;
}
let syncing: Promise<CatalogState> | null = null;
export async function syncCatalog(): Promise<CatalogState> {
  if (syncing) return syncing;
  syncing = (async () => {
    const admin = createAdminClient(),
      token = crypto.randomUUID();
    const { data: claimed, error } = await admin.rpc(
      "robux_account_claim_sync",
      { p_token: token },
    );
    assertOk(error);
    if (!claimed) return readCatalog();
    try {
      const previous = await readCatalog();
      const result = await fetchCatalog(previous);
      const { error: saveError } = await admin
        .from("robux_account_catalog")
        .update({
          quotes: result.quotes,
          offers: result.offers,
          diagnostics: result.diagnostics,
          last_complete_at: result.errors.length
            ? previous.last_complete_at
            : result.seenAt,
          last_success_at: result.seenAt,
          last_error: result.errors.length
            ? `${result.errors.length} cotação(ões) não atualizada(s). O último estado dessas cotações foi preservado. ${result.errors[0]}`.slice(
                0,
                500,
              )
            : null,
          lease_token: null,
          lease_until: null,
          next_attempt_at: new Date(Date.now() + 90000).toISOString(),
        })
        .eq("id", 1)
        .eq("lease_token", token);
      assertOk(saveError);
    } catch (error) {
      console.error("[robux-accounts/sync]", error);
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Falha na sincronização pública.";
      // Global failure never changes quotes/offers; individual failed quotes are merged from their last known state.
      const { error: saveError } = await admin
        .from("robux_account_catalog")
        .update({
          last_error: message,
          lease_token: null,
          lease_until: null,
          next_attempt_at: new Date(Date.now() + 90000).toISOString(),
        })
        .eq("id", 1)
        .eq("lease_token", token);
      assertOk(saveError);
    }
    return readCatalog();
  })();
  try {
    return await syncing;
  } finally {
    syncing = null;
  }
}
export function catalogFresh(state: CatalogState) {
  return Boolean(
    state.last_success_at &&
    Date.now() - Date.parse(state.last_success_at) <= maxAge,
  );
}
export async function publicCatalog(params: URLSearchParams) {
  const [settings, state, policy, service] = await Promise.all([
    accountSettings(),
    readCatalog(),
    readAccountPolicy(),
    getStoreService(),
  ]);
  const available = settings.enabled && catalogFresh(state);
  const admin = createAdminClient();
  const { data: reservations, error } = await admin
    .from("robux_account_orders")
    .select("provider_id,reservation_until,acquired_at,orders!inner(status)");
  assertOk(error);
  const blocked = new Set(
    (reservations ?? [])
      .filter((r) => {
        const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
        if (r.provider_id.startsWith("fourth:") && o?.status === "delivered")
          return false;
        return (
          r.acquired_at ||
          (o?.status !== "cancelled" &&
            (o?.status !== "awaiting_payment" ||
              Date.parse(r.reservation_until) > Date.now()))
        );
      })
      .map((r) => r.provider_id),
  );
  const { data: checks, error: checkError } = await admin
    .from("robux_account_offer_checks")
    .select("offer_id,available,checked_at")
    .eq("available", false);
  assertOk(checkError);
  const missing = new Map(
    (checks ?? []).map((c) => [c.offer_id, Date.parse(c.checked_at)]),
  );
  const sourceOffers = state.offers
    .filter(
      (o) =>
        !blocked.has(o.providerId) &&
        !(missing.has(o.id) && missing.get(o.id)! >= Date.parse(o.seenAt)),
    )
    .map((o) => ({
      ...publicOffer(o, settings.margin_per_thousand, settings.min_cosmic_k),
      available: available && Date.now() - Date.parse(o.seenAt) <= maxAge,
      publicCount: o.publicCount,
    }));
  let offers = groupAccountOptions(sourceOffers);
  const min = Number(params.get("min") || 0),
    max = Number(params.get("max") || 10000000);
  if (Number.isFinite(min)) offers = offers.filter((o) => o.robux >= min);
  if (Number.isFinite(max)) offers = offers.filter((o) => o.robux <= max);
  const sort = params.get("sort");
  offers.sort(
    (a, b) =>
      (sort === "value"
        ? a.cosmicK - b.cosmicK || a.price - b.price
        : sort === "robux_desc"
        ? b.robux - a.robux
        : sort === "robux_asc"
          ? a.robux - b.robux
          : a.price - b.price) || a.id.localeCompare(b.id),
  );
  const pages = Math.max(1, Math.ceil(offers.length / 12));
  const requested = Number(params.get("page") || 1);
  const page = Math.max(
    1,
    Math.min(pages, Number.isSafeInteger(requested) ? requested : 1),
  );
  return {
    offers: offers.slice((page - 1) * 12, page * 12),
    page,
    pages,
    total: offers.length,
    available,
    updatedAt: state.last_success_at,
    policy,
    deliveryHours: service?.delivery_hours ?? 24,
    message: available
      ? ""
      : "Estamos atualizando a disponibilidade das contas. Tente novamente em instantes.",
  };
}
async function recordOfferCheck(id: string, available: boolean) {
  const { error } = await createAdminClient()
    .from("robux_account_offer_checks")
    .upsert({ offer_id: id, available, checked_at: new Date().toISOString() });
  assertOk(error);
}
export class AccountUnavailable extends Error {}
export async function takeLimit(key: string, seconds = 10) {
  const { data, error } = await createAdminClient().rpc(
    "robux_account_take_limit",
    { p_key: key, p_seconds: seconds },
  );
  assertOk(error);
  if (!data) throw new Error("Aguarde alguns segundos e tente novamente.");
}
export async function validateOffer(id: string): Promise<AccountOffer> {
  const state = await readCatalog();
  const offer = state.offers.find((o) => o.id === id);
  if (!offer)
    throw new AccountUnavailable(
      "Esta conta não está mais disponível. Escolha outra oferta.",
    );
  // Shared cross-instance gate, never substitute stale data for a checkout validation.
  await takeLimit(`quote:${offer.quoteId}`, 5);
  const result = await findQuoteAccount(
    {
      id: offer.quoteId,
      url: offer.quoteUrl,
      supplierK: offer.supplierK,
      seenAt: new Date().toISOString(),
    },
    offer.providerId,
  );
  const current = result.offers.find((o) => o.providerId === offer.providerId);
  if (!current) {
    await recordOfferCheck(id, false);
    throw new AccountUnavailable(
      "Esta conta não está mais disponível. Escolha outra oferta.",
    );
  }
  if (current.robux !== offer.robux)
    throw new AccountUnavailable(
      "A oferta foi alterada. Atualize o catálogo antes de continuar.",
    );
  await recordOfferCheck(id, true);
  return current;
}
export async function validateAccountOrder(
  orderId: string,
  requireSamePrice = false,
) {
  const admin = createAdminClient();
  const { data: snapshot, error } = await admin
    .from("robux_account_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();
  assertOk(error);
  if (!snapshot) throw new Error("Snapshot não encontrado.");
  if (snapshot.acquired_at) return snapshot;
  if (requireSamePrice) {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    assertOk(orderError);
    if (
      order?.status === "awaiting_payment" &&
      Date.parse(snapshot.reservation_until) <= Date.now()
    )
      throw new AccountUnavailable(
        "A reserva expirou. Fale com a equipe antes de pagar.",
      );
  }
  try {
    await takeLimit(`quote:${snapshot.quote_id}`, 5);
    const result = await findQuoteAccount(
      {
        id: snapshot.quote_id,
        url: snapshot.quote_url,
        supplierK: Number(snapshot.supplier_k),
        seenAt: new Date().toISOString(),
      },
      snapshot.provider_id,
    );
    const offer = result.offers.find(
      (o) => o.providerId === snapshot.provider_id,
    );
    if (!offer || offer.robux !== snapshot.robux) {
      await recordOfferCheck(snapshot.offer_id, false);
      throw new AccountUnavailable(
        "Esta conta deixou de estar disponível. Entre em contato pelo pedido para revisar a entrega.",
      );
    }
    await recordOfferCheck(snapshot.offer_id, true);
    if (
      requireSamePrice &&
      (offer.supplierK !== Number(snapshot.supplier_k) ||
        offer.supplierPrice !== Number(snapshot.supplier_cost))
    )
      throw new AccountUnavailable(
        "A oferta mudou após a criação do pedido. Fale com a equipe antes de pagar.",
      );
    const now = offer.seenAt;
    const { error: updateError } = await admin
      .from("robux_account_orders")
      .update({
        availability: "available",
        last_validated_at: now,
        last_supplier_k: offer.supplierK,
        last_supplier_cost: offer.supplierPrice,
        last_validation_error: null,
      })
      .eq("order_id", orderId);
    assertOk(updateError);
    return { ...snapshot, currentOffer: offer };
  } catch (error) {
    const { error: updateError } = await admin
      .from("robux_account_orders")
      .update({
        availability:
          error instanceof AccountUnavailable ? "unavailable" : "unknown",
        last_validated_at: new Date().toISOString(),
        last_validation_error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Consulta indisponível.",
      })
      .eq("order_id", orderId);
    assertOk(updateError);
    const { error: detailError } = await admin
      .from("robux_account_order_details")
      .update({ fulfillment_status: "review" })
      .eq("order_id", orderId);
    assertOk(detailError);
    throw error;
  }
}
