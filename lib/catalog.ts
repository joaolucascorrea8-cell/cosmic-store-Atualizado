export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const slugify = (value: string) =>
  normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
export function matchesProductName(name: string, query: string) {
  const words = normalizeSearch(name).split(/\s+/);
  return normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => words.some((word) => word.startsWith(term)));
}
export function parsePrice(value: unknown): number | null {
  const text = String(value ?? "")
    .trim()
    .replace(/^R\$\s*/, "");
  let normalized = text;
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text))
    normalized = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(?:[,.]\d{1,2})?$/.test(text))
    normalized = text.replace(",", ".");
  else return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number <= 9999999999.99
    ? Math.round(number * 100) / 100
    : null;
}
export const money = (value: number | string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function localDate(value: string | Date, time = true) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(time ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  });
}
export function localDateTimeInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return parts.replace(" ", "T");
}
export function pageNumber(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
}
