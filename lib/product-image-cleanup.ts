import "server-only";
import { createAdminClient } from "./supabase/admin";
import {
  getManagedProductImagePath,
  PRODUCT_IMAGE_BUCKET,
} from "./product-images";
export async function removeUnusedProductImage(url: string | null | undefined) {
  const path = getManagedProductImagePath(url ?? null);
  if (!path || !url) return;
  const client = createAdminClient();
  for (const [table, column] of [
    ["products", "image_url"],
    ["games", "image_url"],
    ["categories", "image_url"],
    ["combos", "image_url"],
    ["game_servers", "image_url"],
    ["campaigns", "banner_url"],
  ]) {
    const { count, error } = await client
      .from(table)
      .select("id", { head: true, count: "exact" })
      .eq(column, url);
    if (error || count === null || count > 0) return;
  }
  const { error } = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([path]);
  if (error)
    console.error(
      "Não foi possível remover a imagem sem referências:",
      error.message,
    );
}
