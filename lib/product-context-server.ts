import type { CartCatalog } from "./cart";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productContext, type ProductContext } from "./product-context";
export async function readProductContexts(client: SupabaseClient, ids: string[], includeInactive = false) {
  const contexts: Record<string, ProductContext> = {};
  const catalog: CartCatalog = {};
  if (!ids.length) return { contexts, catalog, error: false };
  let query = client.from("products")
    .select("id,price,stock,unlimited_stock,categories!inner(name,games!inner(name,is_active))")
    .in("id", [...new Set(ids)].slice(0, 40));
  if (!includeInactive) query = query.eq("is_active", true).eq("categories.games.is_active", true);
  const { data, error } = await query;
  for (const row of data ?? []) {
    const context = productContext(row);
    if (context) contexts[row.id] = context;
    catalog[row.id] = { price: Number(row.price), stock: row.stock, unlimited_stock: row.unlimited_stock };
  }
  return { contexts, catalog, error: Boolean(error) };
}
export async function readOrderDisplayItems(client: SupabaseClient, orderId: string, requireItems = false) {
  const { data, error } = await client.from("order_items")
    .select("product_id,product_name,quantity,unit_price").eq("order_id", orderId);
  if (error && requireItems) throw new Error("Não foi possível consultar os itens deste pedido.");
  if (error) return [];
  const { contexts } = await readProductContexts(client, (data ?? []).flatMap(item => item.product_id ? [item.product_id] : []));
  return (data ?? []).map(item => ({ ...item, context: contexts[item.product_id] ?? null }));
}
