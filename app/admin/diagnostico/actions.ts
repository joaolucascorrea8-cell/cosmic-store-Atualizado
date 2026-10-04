"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { UUID_PATTERN } from "@/lib/catalog";
import { operationError } from "@/lib/store-issues";
export async function resolveIssue(form: FormData) {
  const actor = await requireAdmin(),
    id = String(form.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) throw new Error("Ocorrência inválida.");
  const { error } = await createAdminClient(actor.id)
    .from("store_issues")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("last_seen", String(form.get("last_seen") ?? ""))
    .is("resolved_at", null);
  if (error) throw new Error(await operationError(error, "/admin/diagnostico"));
  revalidatePath("/admin/diagnostico");
}
