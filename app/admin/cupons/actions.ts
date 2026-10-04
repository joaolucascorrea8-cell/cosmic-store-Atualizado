"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
import { readCouponForm } from "@/lib/coupons";
import { revalidatePath } from "next/cache";
export type CouponState = {
  error?: string;
  success?: string;
  savedAt?: string;
};
export async function saveCoupon(
  _state: CouponState,
  form: FormData,
): Promise<CouponState> {
  await requireAdmin();
  const result = readCouponForm(form);
  if (result.error) return { error: result.error };
  const id = String(form.get("id") ?? "");
  if (id && !UUID_PATTERN.test(id)) return { error: "Cupom inválido." };
  const admin = createAdminClient();
  const fields = { ...result.values, updated_at: new Date().toISOString() };
  const query = id
    ? admin
        .from("store_coupons")
        .update(fields)
        .eq("id", id)
        .eq("updated_at", String(form.get("updated_at") ?? ""))
    : admin.from("store_coupons").insert(fields);
  const { data, error } = await query.select("id,updated_at").maybeSingle();
  if (error) {
    console.error("[cupons]", error);
    return {
      error:
        error.code === "23505"
          ? "Já existe um cupom com esse código."
          : "Não foi possível salvar o cupom. Confira os dados e a atualização SQL.",
    };
  }
  if (!data)
    return {
      error:
        "Este cupom mudou em outra tela. Atualize a página antes de salvar.",
    };
  revalidatePath("/admin/cupons");
  return {
    success: "Cupom salvo. Pedidos já gerados mantêm os valores originais.",
    savedAt: data.updated_at,
  };
}
