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
  return {
    error: null,
    values: {
      name,
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
