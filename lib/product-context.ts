export type ProductContext = { game: string; category: string };
function first(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? row as Record<string, unknown> : null;
}
export function productContext(value: unknown): ProductContext | null {
  const product = first(value), category = first(product?.categories), game = first(category?.games);
  if (typeof category?.name !== "string" || typeof game?.name !== "string") return null;
  const names = { game: game.name.trim().slice(0, 100), category: category.name.trim().slice(0, 100) };
  return names.game && names.category ? names : null;
}
export function productLabel(name: string, context?: ProductContext | null) {
  return context ? `${name} · ${context.game} · ${context.category}` : name;
}
