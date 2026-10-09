"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncCatalog,
  validateAccountOrder,
} from "@/lib/robux-accounts/service";
import { revalidatePath } from "next/cache";
import { UUID_PATTERN } from "@/lib/catalog";
export async function saveAccountSettings(form: FormData) {
  const user = await requireAdmin();
  const margin = Number(String(form.get("margin") ?? "").replace(",", "."));
  if (
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin > 10000 ||
    (Math.round(margin * 100) !== margin * 100 &&
      Math.abs(Math.round(margin * 100) - margin * 100) > 1e-8)
  )
    throw new Error(
      "Informe uma margem de 0 a 10.000 com até duas casas decimais.",
    );
  const { error } = await createAdminClient(user.id)
    .from("robux_account_settings")
    .update({
      margin_per_thousand: margin,
      enabled: form.get("enabled") === "on",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error("Não foi possível salvar a configuração.");
  revalidatePath("/admin/robux/contas");
  revalidatePath("/robux/contas");
}
export async function refreshAccountCatalog() {
  await requireAdmin();
  await syncCatalog();
  revalidatePath("/admin/robux/contas");
}
export async function checkAccountOrder(form: FormData) {
  await requireAdmin();
  const id = String(form.get("order_id") ?? "");
  if (!UUID_PATTERN.test(id)) throw new Error("Pedido inválido.");
  try {
    await validateAccountOrder(id);
  } catch {
    /* Persistent availability appears in the admin panel; technical errors never reach customer. */
  }
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath(`/pedidos/${id}`);
}
export async function markAccountAcquired(form: FormData) {
  const user = await requireAdmin(),
    id = String(form.get("order_id") ?? "");
  if (!UUID_PATTERN.test(id) || form.get("confirmed") !== "on")
    throw new Error("Confirme que já adquiriu manualmente esta conta.");
  const { error } = await createAdminClient(user.id).rpc(
    "mark_robux_account_acquired",
    { p_order_id: id, p_admin_id: user.id },
  );
  if (error)
    throw new Error(
      error.code === "P0001"
        ? error.message
        : "Não foi possível registrar a aquisição.",
    );
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath(`/pedidos/${id}`);
}
