"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
export async function updateTicketStatus(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? ""),
    status = String(form.get("status") ?? "");
  if (!UUID_PATTERN.test(id) || !["open", "closed"].includes(status))
    throw new Error("Atendimento inválido.");
  const expected = String(form.get("expected_status") ?? "");
  const admin = createAdminClient();
  const { data: before, error: lookup } = await admin
    .from("support_tickets")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (lookup || !before) throw new Error("Atendimento não encontrado.");
  if (expected && expected !== before.status)
    throw new Error("O atendimento mudou. Atualize a página.");
  const { data, error } = await admin
    .from("support_tickets")
    .update({
      status,
      closed_at: status === "closed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", before.status)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "O atendimento mudou. Atualize a página e tente novamente.",
    );
  revalidatePath("/admin/suporte");
  revalidatePath(`/admin/suporte/${id}`);
  revalidatePath(`/suporte/${id}`);
  redirect(`/admin/suporte/${id}`);
}
