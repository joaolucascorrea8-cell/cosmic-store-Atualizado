import { UUID_PATTERN } from "./catalog";
export type CartItem = {
  id: string;
  kind?: "product" | "combo";
  name: string;
  slug?: string;
  price: number;
  image_url: string | null;
  quantity: number;
  stock: number;
  unlimited_stock: boolean;
};
export const cartKey = (item: Pick<CartItem, "id" | "kind">) =>
  `${item.kind ?? "product"}:${item.id}`;
export const maxQuantity = (
  item: Pick<CartItem, "stock" | "unlimited_stock">,
) =>
  item.unlimited_stock ? 99 : Math.min(99, Math.max(0, Math.floor(item.stock)));
export const cartSignature = (items: CartItem[]) =>
  JSON.stringify(
    items
      .map((item) => [
        cartKey(item),
        item.quantity,
        Math.round(item.price * 100),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
export function sanitizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const items: CartItem[] = [];
  for (const entry of raw.slice(0, 40)) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !UUID_PATTERN.test(entry.id) ||
      typeof entry.name !== "string" ||
      !Number.isFinite(entry.price) ||
      entry.price < 0 ||
      !Number.isSafeInteger(entry.quantity)
    )
      continue;
    const available = Number.isFinite(entry.stock)
      ? entry.stock
      : Number.isFinite(entry.max_quantity)
        ? entry.max_quantity
        : 99;
    const unlimited =
      entry.unlimited_stock === true ||
      (entry.stock === undefined && entry.max_quantity === undefined);
    const item: CartItem = {
      id: entry.id,
      kind: entry.kind === "combo" ? "combo" : "product",
      name: entry.name.slice(0, 120),
      slug: typeof entry.slug === "string" ? entry.slug : undefined,
      price: entry.price,
      image_url: typeof entry.image_url === "string" ? entry.image_url : null,
      stock: Math.max(0, Math.floor(available)),
      unlimited_stock: unlimited,
      quantity: Math.max(
        0,
        Math.min(
          entry.quantity,
          maxQuantity({ stock: available, unlimited_stock: unlimited }),
        ),
      ),
    };
    if (
      item.quantity > 0 &&
      !items.some((existing) => cartKey(existing) === cartKey(item))
    )
      items.push(item);
  }
  return items;
}

export function mergeRepurchase(current: CartItem[], incoming: CartItem[]) {
  let added = 0;
  const items = [...current];
  for (const product of sanitizeCart(incoming)) {
    const index = items.findIndex((item) => cartKey(item) === cartKey(product));
    const previous = index >= 0 ? items[index].quantity : 0;
    const quantity = Math.min(
      maxQuantity(product),
      previous + product.quantity,
    );
    if (index < 0 && items.length >= 40) continue;
    if (quantity < 1) continue;
    const merged = { ...product, quantity };
    if (index >= 0) items[index] = merged;
    else items.push(merged);
    added += Math.max(0, quantity - previous);
  }
  return { items, added };
}
