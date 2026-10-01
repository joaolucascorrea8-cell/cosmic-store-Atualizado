"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
export async function moderateUser(form: FormData) {
  const actor = await requireAdmin(),
    admin = createAdminClient(),
    userId = String(form.get("user_id") ?? ""),
    action = String(form.get("action") ?? "");
  if (
    !UUID_PATTERN.test(userId) ||
    !["delete_message", "mute", "ban", "unban", "unmute"].includes(action)
  )
    throw new Error("Ação de moderação inválida.");
  if (["mute", "ban"].includes(action)) {
    const { data: staff, error } = await admin
      .from("admins")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível verificar o usuário.");
    if (staff && ["admin", "owner"].includes(staff.role))
      throw new Error(
        "Administradores não podem ser silenciados ou banidos por esta tela.",
      );
  }
  let error;
  if (action === "delete_message") {
    const id = String(form.get("message_id") ?? "");
    if (!UUID_PATTERN.test(id)) throw new Error("Mensagem inválida.");
    ({ error } = await admin
      .from("global_messages")
      .delete()
      .eq("id", id)
      .eq("user_id", userId));
  }
  if (action === "mute")
    ({ error } = await admin
      .from("chat_mutes")
      .upsert({
        user_id: userId,
        muted_until: new Date(Date.now() + 86400000).toISOString(),
        reason: "Moderação",
        created_by: actor.id,
      }));
  if (action === "ban")
    ({ error } = await admin
      .from("chat_bans")
      .upsert({ user_id: userId, reason: "Moderação", created_by: actor.id }));
  if (action === "unban")
    ({ error } = await admin.from("chat_bans").delete().eq("user_id", userId));
  if (action === "unmute")
    ({ error } = await admin.from("chat_mutes").delete().eq("user_id", userId));
  if (error) throw new Error("Não foi possível concluir a moderação.");
  revalidatePath("/admin/comunidade");
  revalidatePath("/chat");
}
export async function resolveReport(form: FormData) {
  await requireAdmin();
  const id = String(form.get("report_id") ?? "");
  if (!UUID_PATTERN.test(id)) throw new Error("Denúncia inválida.");
  const { error } = await createAdminClient()
    .from("message_reports")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .is("resolved_at", null);
  if (error) throw new Error("Não foi possível resolver a denúncia.");
  revalidatePath("/admin/comunidade");
}
