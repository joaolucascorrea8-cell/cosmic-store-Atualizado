"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
export async function toggleReviewVisibility(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? ""),
    value = String(form.get("visible") ?? "");
  if (!UUID_PATTERN.test(id) || !["true", "false"].includes(value))
    throw new Error("Avaliação inválida.");
  const { data, error } = await createAdminClient()
    .from("feedbacks")
    .update({ is_visible: value === "true" })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error("Não foi possível atualizar a avaliação.");
  revalidatePath("/", "layout");
}
