import { UUID_PATTERN } from "./catalog";
export function checkoutItems(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40)
    return null;
  const keys = new Set<string>();
  const items: {
    id: string;
    kind: "product" | "combo";
    quantity: number;
    unit_price: number;
  }[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !UUID_PATTERN.test(item.id) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99 ||
      typeof item.price !== "number" ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      (item.kind !== undefined && !["product", "combo"].includes(item.kind))
    )
      return null;
    const kind = item.kind === "combo" ? "combo" : "product";
    const key = `${kind}:${item.id}`;
    if (keys.has(key)) return null;
    keys.add(key);
    items.push({
      id: item.id,
      kind,
      quantity: item.quantity,
      unit_price: item.price,
    });
  }
  return items;
}
