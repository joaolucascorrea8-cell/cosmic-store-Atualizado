import PendingButton from "@/app/admin/components/PendingButton";
import { UUID_PATTERN } from "@/lib/catalog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { withSignedChatAttachments } from "@/lib/chat-attachments";
import SupportChat from "@/app/suporte/[id]/SupportChat";
import { updateTicketStatus } from "../actions";
export const dynamic = "force-dynamic";
export default async function AdminTicket({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const user = await requireAdmin();
  const admin = createAdminClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    admin
      .from("support_tickets")
      .select(
        "id,subject,category,requested_game,status,created_at,profiles(nickname)",
      )
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("support_messages")
      .select(
        "id,user_id,message,created_at,attachment_path,attachment_name,attachment_type,profiles(nickname)",
      )
      .eq("ticket_id", id)
      .order("created_at"),
  ]);
  if (!ticket) notFound();
  const signedMessages = await withSignedChatAttachments(messages ?? []);
  const profile = Array.isArray(ticket.profiles)
    ? ticket.profiles[0]
    : ticket.profiles;
  return (
    <main
      id="conteudo-principal"
      tabIndex={-1}
      className="min-h-screen p-6 text-white"
    >
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/suporte" className="text-sm font-bold text-zinc-500">
          ← Atendimentos
        </Link>
        <div className="my-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">
              Suporte • {profile?.nickname ?? "Cliente"}
            </p>
            <h1 className="mt-2 text-3xl font-black">{ticket.subject}</h1>
            {ticket.category === "server_request" && (
              <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm text-zinc-300">
                <strong>Pedido de servidor VIP</strong> ·{" "}
                {ticket.requested_game}
                <Link
                  href="/admin/servidores"
                  className="mt-2 block font-bold text-violet-300"
                >
                  Gerenciar servidores →
                </Link>
              </div>
            )}
          </div>
          <form action={updateTicketStatus}>
            <input type="hidden" name="id" value={ticket.id} />
            <input type="hidden" name="expected_status" value={ticket.status} />
            <input
              type="hidden"
              name="status"
              value={ticket.status === "closed" ? "open" : "closed"}
            />
            <PendingButton
              className={`rounded-xl px-4 py-2 text-sm font-bold ${ticket.status === "closed" ? "bg-emerald-600" : "bg-red-600"}`}
            >
              {ticket.status === "closed"
                ? "Reabrir atendimento"
                : "Encerrar atendimento"}
            </PendingButton>
          </form>
        </div>
        <SupportChat
          ticketId={ticket.id}
          userId={user.id}
          initialMessages={signedMessages as never[]}
          canSend={ticket.status !== "closed"}
          isAdmin
        />
      </div>
    </main>
  );
}
