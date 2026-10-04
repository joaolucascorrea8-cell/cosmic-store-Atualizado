"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
import { serverRequestFields } from "@/lib/game-servers";
import {
  createAdminNotifications,
  notifyAdminDiscord,
} from "@/lib/notifications";

export type ServerRequestState = { error: string | null; destination?: string };
export async function requestGameServer(
  _state: ServerRequestState,
  form: FormData,
): Promise<ServerRequestState> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/servidores/pedir");
  const fields = serverRequestFields(
    String(form.get("game_name") ?? ""),
    String(form.get("message") ?? ""),
  );
  const requestId = String(form.get("request_id") ?? "");
  if (fields.error) return { error: fields.error };
  if (!UUID_PATTERN.test(requestId))
    return { error: "Atualize a página e tente enviar novamente." };
  const { data, error } = await createAdminClient().rpc(
    "create_store_server_request",
    {
      p_user_id: user.id,
      p_request_id: requestId,
      p_game_name: fields.gameName,
      p_message: fields.message,
    },
  );
  if (error || !data?.ticket) {
    console.error("[servidores] Falha ao registrar solicitação:", error);
    return {
      error:
        "Não foi possível enviar o pedido de servidor. Tente novamente em instantes.",
    };
  }
  const id = data.ticket.id as string;
  if (data.created) {
    const results = await Promise.allSettled([
      createAdminNotifications(
        "Novo pedido de servidor",
        `Servidor VIP solicitado para ${fields.gameName}.`,
        `/admin/suporte/${id}`,
      ),
      notifyAdminDiscord(
        `Novo pedido de servidor VIP: **${fields.gameName}**\n${process.env.NEXT_PUBLIC_SITE_URL || "https://cosmic-store-blush.vercel.app"}/admin/suporte/${id}`,
      ),
    ]);
    results.forEach((result) => {
      if (result.status === "rejected")
        console.error(
          "[servidores] Falha no aviso administrativo:",
          result.reason,
        );
    });
  }
  revalidatePath("/suporte");
  revalidatePath("/admin/suporte");
  revalidatePath("/admin/servidores");
  return { error: null, destination: `/suporte/${id}` };
}
