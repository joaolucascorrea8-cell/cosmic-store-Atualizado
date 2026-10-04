import { parsePrice, UUID_PATTERN } from "./catalog";
export type Coupon = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  min_order: number;
  max_uses: number | null;
  per_user_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  game_id: string | null;
  product_id: string | null;
  include_combos: boolean;
  updated_at: string;
  uses?: number;
};
export type CheckoutQuote = {
  subtotal: number;
  discount: number;
  total: number;
  code: string | null;
  delivery_hours: number;
};
export function couponCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}
export function couponDate(value: string): string | null | "invalid" {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "invalid";
  const date = new Date(`${value}:00-03:00`);
  return Number.isFinite(date.getTime()) &&
    couponDateInput(date.toISOString()) === value
    ? date.toISOString()
    : "invalid";
}
export function couponDateInput(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(value))
    .replace(" ", "T");
}
export function readCouponForm(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const code = couponCode(text("code")),
    kind = text("kind"),
    amount = parsePrice(text("amount")),
    minimum = parsePrice(text("min_order") || "0");
  const limit = text("max_uses"),
    perUser = text("per_user_limit"),
    scope = text("scope"),
    target = text(scope === "game" ? "game_id" : "product_id");
  const starts = couponDate(text("starts_at")),
    ends = couponDate(text("ends_at"));
  if (!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(code))
    return {
      error: "Use um código com 3 a 30 letras, números, hífen ou sublinhado.",
    } as const;
  if (
    !["percent", "fixed"].includes(kind) ||
    amount === null ||
    amount <= 0 ||
    (kind === "percent" && amount > 99) ||
    minimum === null
  )
    return {
      error:
        "Confira o desconto e o valor mínimo. O percentual deve ser maior que zero e no máximo 99%.",
    } as const;
  if (
    (limit &&
      (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 1000000)) ||
    !/^\d+$/.test(perUser) ||
    Number(perUser) < 1 ||
    Number(perUser) > 1000
  )
    return { error: "Confira os limites de uso." } as const;
  if (
    !["all", "game", "product"].includes(scope) ||
    (scope !== "all" && !UUID_PATTERN.test(target))
  )
    return {
      error: "Selecione o jogo ou produto válido para este cupom.",
    } as const;
  if (
    starts === "invalid" ||
    ends === "invalid" ||
    (starts && ends && ends <= starts)
  )
    return {
      error: "Confira a validade: o fim deve ser posterior ao início.",
    } as const;
  return {
    error: null,
    values: {
      code,
      kind: kind as Coupon["kind"],
      amount,
      min_order: minimum,
      max_uses: limit ? Number(limit) : null,
      per_user_limit: Number(perUser),
      starts_at: starts,
      ends_at: ends,
      game_id: scope === "game" ? target : null,
      product_id: scope === "product" ? target : null,
      include_combos: scope === "all" && form.get("include_combos") === "on",
      is_active: form.get("is_active") === "on",
    },
  } as const;
}
