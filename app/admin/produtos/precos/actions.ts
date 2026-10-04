"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { readRobuxRate, type PriceBatch } from "@/lib/robux-pricing";
import { UUID_PATTERN } from "@/lib/catalog";
import { operationError } from "@/lib/store-issues";
import { revalidatePath } from "next/cache";
export async function setPricingCategories(ids: string[], enabled: boolean) {
  const actor = await requireAdmin();
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 500 ||
    ids.some((x) => !UUID_PATTERN.test(x)) ||
    typeof enabled !== "boolean"
  )
    return { error: "Selecione categorias válidas." };
  const { error } = await createAdminClient(actor.id).rpc(
    "ops_set_categories",
    { p_actor: actor.id, p_ids: ids, p_enabled: enabled },
  );
  if (error)
    return { error: await operationError(error, "/admin/produtos/precos") };
  revalidatePath("/admin/produtos/precos");
  return { success: "Categorias atualizadas. Os preços não foram alterados." };
}
export async function previewPrices(
  categories: string[],
  rate: string,
  initial: string,
): Promise<{ error?: string; batch?: PriceBatch }> {
  const actor = await requireAdmin();
  const amount = readRobuxRate(rate),
    base = readRobuxRate(initial);
  if (
    !amount ||
    !base ||
    !Array.isArray(categories) ||
    categories.length < 1 ||
    categories.length > 500 ||
    categories.some((x) => !UUID_PATTERN.test(x))
  )
    return { error: "Selecione categorias e confira a cotação." };
  const { data, error } = await createAdminClient(actor.id).rpc(
    "ops_preview_prices",
    {
      p_actor: actor.id,
      p_categories: categories,
      p_rate: amount,
      p_initial: base,
    },
  );
  if (error)
    return { error: await operationError(error, "/admin/produtos/precos") };
  return { batch: data as PriceBatch };
}
export async function applyPrices(id: string, revert = false) {
  const actor = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { error: "Reajuste inválido." };
  const { data, error } = await createAdminClient(actor.id).rpc(
    revert ? "ops_revert_prices" : "ops_apply_prices",
    { p_actor: actor.id, p_batch: id },
  );
  if (error)
    return { error: await operationError(error, "/admin/produtos/precos") };
  revalidatePath("/", "layout");
  return {
    success: revert
      ? `${data} produtos restaurados.`
      : `Reajuste aplicado a ${data} produtos.`,
  };
}
