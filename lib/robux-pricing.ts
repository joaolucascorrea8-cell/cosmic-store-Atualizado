import { parsePrice } from "./catalog";
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
  const q = BigInt(quantity);
  let n: bigint, d: bigint;
  if (quantity <= 350) {
    n = q * BigInt(1500);
    d = BigInt(350);
  } else if (quantity <= 450) {
    n = BigInt(1500) + (q - BigInt(350)) * BigInt(2);
    d = BigInt(1);
  } else if (quantity < 1000) {
    n = BigInt(1700) * (q + BigInt(100));
    d = BigInt(550);
  } else {
    n = q * BigInt(3400);
    d = BigInt(1000);
  }
  n *= BigInt(Math.round(rate * 100));
  d *= BigInt(3400);
  return Number((BigInt(2) * n + d) / (BigInt(2) * d)) / 100;
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
