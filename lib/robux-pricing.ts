import { parsePrice } from "./catalog";
import { priceFromRobuxTable } from "./robux-price-table";

export type RobuxPurchaseMode = "tax_paid" | "tax_not_paid";

export const ROBLOX_CREATOR_SHARE = 0.7;
export const ROBLOX_MARKETPLACE_FEE = 0.3;
export const MIN_ROBUX_AMOUNT = 1;
export const MAX_ROBUX_AMOUNT = 1_000_000;

export type RobuxPricingSettings = {
  minCosmicK: number;
  marginPerThousand: number;
  maxSupplierK: number;
  minMarginPerThousand: number;
};

export function isRobuxPurchaseMode(
  value: unknown,
): value is RobuxPurchaseMode {
  return value === "tax_paid" || value === "tax_not_paid";
}

export function readRobuxAmount(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value)
        : NaN;
  if (
    !Number.isInteger(amount) ||
    amount < MIN_ROBUX_AMOUNT ||
    amount > MAX_ROBUX_AMOUNT
  )
    return null;
  return amount;
}

export function gamepassForDesiredNetRobux(netRobux: number) {
  return Math.ceil(netRobux / ROBLOX_CREATOR_SHARE);
}

export function estimatedNetFromGamepass(gamepassRobux: number) {
  return Math.floor(gamepassRobux * ROBLOX_CREATOR_SHARE);
}

export function robuxBreakdown(
  amount: number,
  mode: RobuxPurchaseMode,
) {
  const gamepassRobux =
    mode === "tax_paid" ? gamepassForDesiredNetRobux(amount) : amount;
  const netRobux =
    mode === "tax_paid" ? amount : estimatedNetFromGamepass(gamepassRobux);
  const feeRobux = Math.max(0, gamepassRobux - netRobux);
  return { requestedRobux: amount, gamepassRobux, netRobux, feeRobux };
}

export function cosmicRateFromSupplier(
  supplierK: number,
  settings: Pick<RobuxPricingSettings, "minCosmicK" | "marginPerThousand">,
) {
  return round2(
    Math.max(settings.minCosmicK, supplierK + settings.marginPerThousand),
  );
}

export function salePriceForGamepass(gamepassRobux: number, cosmicK: number) {
  return round2((gamepassRobux / 1000) * cosmicK);
}

export function effectiveMarginPerThousand(
  salePrice: number,
  gamepassRobux: number,
  supplierK: number,
) {
  if (gamepassRobux <= 0) return -Infinity;
  return round2((salePrice / gamepassRobux) * 1000 - supplierK);
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Precificação histórica de produtos da Cosmic Store. Mantida para não alterar
// o fluxo existente de Produtos > Preços/Importar.
export const REFERENCE_RATE = 34;

export function readRobuxRate(value: string): number | null {
  const n = parsePrice(value);
  return n !== null && n >= 0.01 && n <= 10000 ? n : null;
}

// Mesma curva do bot. Aritmética inteira e arredondamento somente no final.
export function robuxPrice(quantity: number, rate = REFERENCE_RATE): number {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 1000000 ||
    !Number.isFinite(rate) ||
    rate < 0.01 ||
    rate > 10000
  )
    throw new Error("Quantidade ou cotação inválida.");
  return priceFromRobuxTable(quantity, rate);
}

export type PriceChange = {
  id: string;
  name: string;
  category_id: string;
  before: number | string;
  after: number | string;
  reference: string | number;
  version: number;
};

export type PriceBatch = {
  id: string;
  new_rate: number;
  initial_rate: number;
  status: "draft" | "applied" | "reverted";
  changes: PriceChange[];
  skipped: number;
  expires_at: string;
  created_at: string;
};
