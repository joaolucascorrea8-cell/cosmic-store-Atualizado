"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAdminNotifications,
  notifyAdminDiscord,
} from "@/lib/notifications";
import { UUID_PATTERN } from "@/lib/catalog";
export type SupportState = { error: string | null; destination?: string };
export async function createSupportTicket(
  _state: SupportState,
  form: FormData,
): Promise<SupportState> {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser();
  if (!user) redirect("/login?next=/suporte");
  const subject = String(form.get("subject") ?? "").trim(),
    category = String(form.get("category") ?? "other"),
    message = String(form.get("message") ?? "").trim(),
    requestId = String(form.get("request_id") ?? "");
  if (
    subject.length < 3 ||
    subject.length > 120 ||
    message.length < 5 ||
    message.length > 1500 ||
    !["order", "payment", "account", "product", "other"].includes(category) ||
    !UUID_PATTERN.test(requestId)
  )
    return {
      error: "Preencha assunto, categoria e mensagem para abrir o atendimento.",
    };
  const { data: result, error } = await createAdminClient().rpc(
    "create_store_support_ticket",
    {
      p_user_id: user.id,
      p_request_id: requestId,
      p_subject: subject,
      p_category: category,
      p_message: message,
    },
  );
  if (error || !result?.ticket)
    return { error: "Não foi possível abrir o atendimento. Tente novamente." };
  const ticket = result.ticket as { id: string };
  if (result.created)
    await Promise.allSettled([
      createAdminNotifications(
        "Novo atendimento de suporte",
        subject,
        `/admin/suporte/${ticket.id}`,
        user.id,
      ),
      notifyAdminDiscord(`🛟 Novo atendimento no suporte: **${subject}**`),
    ]);
  return { error: null, destination: `/suporte/${ticket.id}` };
}
