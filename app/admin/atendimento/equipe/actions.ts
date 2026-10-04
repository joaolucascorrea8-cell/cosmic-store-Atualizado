"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
import { operationError } from "@/lib/store-issues";
import { revalidatePath } from "next/cache";
export type WorkState = { error?: string; success?: string };
export async function saveWork(
  _state: WorkState,
  form: FormData,
): Promise<WorkState> {
  const actor = await requireAdmin(),
    id = String(form.get("entity_id") ?? ""),
    kind = String(form.get("kind") ?? ""),
    assigned = String(form.get("assigned") ?? ""),
    note = String(form.get("note") ?? "").trim(),
    expected = String(form.get("expected") ?? "");
  if (
    !UUID_PATTERN.test(id) ||
    !["order", "support"].includes(kind) ||
    (assigned && !UUID_PATTERN.test(assigned)) ||
    (note.length > 0 && note.length < 2) ||
    note.length > 2000 ||
    (expected && !Number.isFinite(Date.parse(expected)))
  )
    return { error: "Confira o responsável e a anotação." };
  const { error } = await createAdminClient(actor.id).rpc("ops_work_update", {
    p_actor: actor.id,
    p_kind: kind,
    p_id: id,
    p_assigned: assigned || null,
    p_note: note,
    p_expected: expected || null,
  });
  if (error)
    return { error: await operationError(error, "/admin/atendimento") };
  revalidatePath(
    kind === "order" ? `/admin/pedidos/${id}` : `/admin/suporte/${id}`,
  );
  return {
    success: "Organização interna salva. O cliente não recebe essa anotação.",
  };
}
export async function saveReply(
  _state: WorkState,
  form: FormData,
): Promise<WorkState> {
  const actor = await requireAdmin(),
    client = createAdminClient(actor.id),
    id = String(form.get("id") ?? ""),
    scope = String(form.get("scope") ?? ""),
    label = String(form.get("label") ?? "").trim(),
    body = String(form.get("body") ?? "").trim(),
    game = String(form.get("game_id") ?? "");
  if (
    (id && !UUID_PATTERN.test(id)) ||
    !["order", "support"].includes(scope) ||
    label.length < 2 ||
    label.length > 40 ||
    body.length < 2 ||
    body.length > 2000 ||
    (game && !UUID_PATTERN.test(game))
  )
    return { error: "Confira o nome e o texto da resposta." };
  const values = {
    scope,
    label,
    body,
    game_id: game || null,
    is_active: form.get("is_active") === "on",
    updated_at: new Date().toISOString(),
  };
  const r = id
    ? await client
        .from("admin_quick_replies")
        .update(values)
        .eq("id", id)
        .eq("updated_at", String(form.get("expected") ?? ""))
        .select("id")
        .maybeSingle()
    : await client
        .from("admin_quick_replies")
        .insert(values)
        .select("id")
        .single();
  if (r.error)
    return {
      error:
        r.error.code === "23505"
          ? "Já existe uma resposta com esse nome neste tipo de conversa."
          : await operationError(r.error, "/admin/atendimento"),
    };
  if (!r.data)
    return {
      error: "A resposta mudou em outra tela. Atualize antes de salvar.",
    };
  revalidatePath("/admin/atendimento");
  return { success: "Resposta salva." };
}
