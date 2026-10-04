"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { operationError } from "@/lib/store-issues";
import { revalidatePath } from "next/cache";
export async function saveAutoClose(
  _state: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const actor = await requireAdmin(),
    hours = Number(form.get("hours")),
    expected = String(form.get("expected") ?? "");
  if (
    !Number.isInteger(hours) ||
    hours < 24 ||
    hours > 720 ||
    !Number.isFinite(Date.parse(expected))
  )
    return { error: "Confira o prazo e atualize a página." };
  const { error } = await createAdminClient(actor.id).rpc("ops_save_settings", {
    p_actor: actor.id,
    p_enabled: form.get("enabled") === "on",
    p_hours: hours,
    p_expected: expected,
  });
  if (error)
    return { error: await operationError(error, "/admin/atendimento") };
  revalidatePath("/admin/atendimento");
  revalidatePath("/admin/diagnostico");
  return { success: "Configuração salva." };
}
