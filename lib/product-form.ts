import { readDeliveryHours } from "./store-service";
import { parsePrice, slugify, UUID_PATTERN } from "./catalog";
export type ProductValues = {
  name: string;
  slug: string;
  category_id: string;
  description: string | null;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  is_active: boolean;
  image_url: string | null;
  delivery_hours: number | null;
  delivery_instructions: string;
  robux_quantity: number | null;
  pricing_locked: boolean;
  pricing_rate: number | null;
  low_stock_threshold: number;
};
export function readProductForm(
  form: FormData,
): { error: string; values?: never } | { error: null; values: ProductValues } {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const name = text("name"),
    slug = text("slug") || slugify(name),
    category_id = text("category_id"),
    price = parsePrice(text("price"));
  const unlimited = text("unlimited_stock"),
    active = text("is_active"),
    stock = unlimited === "true" ? 0 : Number(text("stock"));
  if (name.length < 2 || name.length > 100)
    return { error: "O nome deve ter entre 2 e 100 caracteres." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    return { error: "Informe um identificador válido." };
  if (!UUID_PATTERN.test(category_id))
    return { error: "Selecione uma categoria." };
  if (price === null) return { error: "Informe um preço válido, como 29,90." };
  if (
    !["true", "false"].includes(unlimited) ||
    !["true", "false"].includes(active)
  )
    return { error: "Confira estoque e visibilidade." };
  if (
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    stock > 2147483647 ||
    (unlimited === "false" && !/^\d+$/.test(text("stock")))
  )
    return { error: "Informe um estoque válido." };
  if (text("description").length > 2000)
    return { error: "A descrição pode ter até 2000 caracteres." };
  if (text("image_url").length > 500) return { error: "Imagem inválida." };
  const deliveryHours = readDeliveryHours(form.get("delivery_hours"));
  if (deliveryHours === "invalid")
    return {
      error:
        "O prazo deve ser de 1 a 720 horas, ou vazio para usar o prazo do jogo/loja.",
    };
  const rate = text("pricing_rate") ? parsePrice(text("pricing_rate")) : null;
  if (text("pricing_rate") && (rate === null || rate < 0.01 || rate > 10000))
    return { error: "Cotação inválida." };
  const robux = text("robux_quantity") ? Number(text("robux_quantity")) : null;
  const threshold = text("low_stock_threshold")
    ? Number(text("low_stock_threshold"))
    : 2;
  if (
    robux !== null &&
    (!/^\d+$/.test(text("robux_quantity")) ||
      !Number.isSafeInteger(robux) ||
      robux < 1 ||
      robux > 1000000)
  )
    return {
      error: "Informe uma quantidade inteira de Robux, ou deixe vazio.",
    };
  if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 100000)
    return { error: "O limite de estoque baixo deve ser de 0 a 100.000." };
  if (text("delivery_instructions").length > 2000)
    return { error: "As instruções podem ter até 2000 caracteres." };
  return {
    error: null,
    values: {
      name,
      delivery_instructions: text("delivery_instructions"),
      robux_quantity: robux,
      pricing_rate: rate,
      pricing_locked: text("pricing_locked") === "true",
      low_stock_threshold: threshold,
      delivery_hours: deliveryHours,
      slug,
      category_id,
      price,
      stock,
      unlimited_stock: unlimited === "true",
      is_active: active === "true",
      description: text("description") || null,
      image_url: text("image_url") || null,
    },
  };
}
