"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function toggleReviewVisibility(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const visible = String(formData.get("visible")) === "true";
  if (!id) return;
  await createAdminClient().from("feedbacks").update({ is_visible: visible }).eq("id", id);
  revalidatePath("/admin/avaliacoes");
  revalidatePath("/");
}
