"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncCatalog,
  validateAccountOrder,
} from "@/lib/robux-accounts/service";
import { revalidatePath } from "next/cache";
import { UUID_PATTERN } from "@/lib/catalog";
import {
  encryptCredentials,
  validateCredentials,
} from "@/lib/robux-accounts/credentials-crypto";

export type AccountFormState = { error: string | null; success?: string };
export async function saveAccountDelivery(
  _previous: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const user = await requireAdmin();
  const id = String(form.get("order_id") ?? "");
  if (!UUID_PATTERN.test(id)) return { error: "Pedido inválido." };
  let encrypted: string;
  try {
    const credentials = validateCredentials({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      instructions: String(form.get("instructions") ?? ""),
    });
    encrypted = encryptCredentials(
      id,
      credentials,
      process.env.ROBUX_ACCOUNT_DELIVERY_KEY ?? "",
    );
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Confira os dados da conta.",
    };
  }
  const { error } = await createAdminClient(user.id).rpc(
    "save_robux_account_delivery",
    {
      p_order_id: id,
      p_admin_id: user.id,
      p_encrypted: encrypted,
      p_expected_updated_at: String(form.get("updated_at") ?? "") || null,
    },
  );
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Não foi possível salvar. Confira a atualização SQL.",
    };
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath(`/pedidos/${id}`);
  return {
    error: null,
    success:
      "Dados salvos. Eles são liberados ao cliente quando o pedido estiver entregue.",
  };
}
export async function saveAccountPolicy(
  _previous: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const user = await requireAdmin();
  const body = String(form.get("body") ?? "").trim();
  const version = String(form.get("version") ?? "");
  if (!UUID_PATTERN.test(version) || body.length < 100 || body.length > 12000)
    return { error: "Informe uma política entre 100 e 12.000 caracteres." };
  const { error } = await createAdminClient(user.id).rpc(
    "save_robux_account_policy",
    {
      p_admin_id: user.id,
      p_body: body,
      p_expected_version: version,
    },
  );
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Não foi possível salvar a política.",
    };
  for (const path of [
    "/admin/robux/contas",
    "/reembolso/contas",
    "/robux/contas",
  ])
    revalidatePath(path);
  return {
    error: null,
    success:
      "Política salva. Novos pedidos solicitarão a leitura da versão atual.",
  };
}
export async function saveAccountSettings(form: FormData) {
  const user = await requireAdmin();
  const rawMargin = String(form.get("margin") ?? "").trim().replace(",", ".");
  const rawMinimum = String(form.get("min_cosmic_k") ?? "").trim().replace(",", ".");
  const margin = Number(rawMargin), minimum = Number(rawMinimum);
  if (
    !rawMargin || !rawMinimum ||
    [margin, minimum].some((value) =>
      !Number.isFinite(value) || value < 0 || value > 10000 ||
      Math.abs(Math.round(value * 100) - value * 100) > 1e-8,
    )
  )
    throw new Error(
      "Informe mínimo e acréscimo de 0 a 10.000 com até duas casas decimais.",
    );
  const { error } = await createAdminClient(user.id)
    .from("robux_account_settings")
    .update({
      margin_per_thousand: margin,
      min_cosmic_k: minimum,
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
