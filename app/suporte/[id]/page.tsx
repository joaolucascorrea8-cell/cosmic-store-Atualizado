import { localDate, UUID_PATTERN } from "@/lib/catalog";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import NotificationReadMarker from "@/app/components/NotificationReadMarker";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { withSignedChatAttachments } from "@/lib/chat-attachments";
import SupportChat from "./SupportChat";
export const dynamic = "force-dynamic";
export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/suporte/${id}`);
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id,subject,category,requested_game,status,created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("support_messages")
      .select(
        "id,user_id,message,created_at,attachment_path,attachment_name,attachment_type,profiles(nickname)",
      )
      .eq("ticket_id", id)
      .order("created_at"),
  ]);
  if (!ticket) notFound();
  const signedMessages = await withSignedChatAttachments(messages ?? []);
  return (
    <>
      <SiteHeader />
      <NotificationReadMarker
        userId={user.id}
        scope="support"
        link={`/suporte/${id}`}
      />
      <main id="conteudo-principal" tabIndex={-1} className="shell py-12">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/suporte"
            className="text-sm font-bold text-zinc-500 hover:text-white"
          >
            ← Central de suporte
          </Link>
          <div className="my-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Atendimento particular</p>
              <h1 className="mt-2 text-3xl font-black">{ticket.subject}</h1>
              {ticket.category === "server_request" && (
                <p className="mt-3 text-sm text-violet-300">
                  Solicitação de servidor VIP para {ticket.requested_game}. A
                  resposta da equipe aparece nesta conversa.
                </p>
              )}
              <p className="mt-2 text-sm text-zinc-500">
                Aberto em {localDate(ticket.created_at)}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${ticket.status === "closed" ? "bg-zinc-500/10 text-zinc-400" : "bg-violet-500/10 text-violet-300"}`}
            >
              {ticket.status === "closed" ? "Encerrado" : "Em atendimento"}
            </span>
          </div>
          <SupportChat
            ticketId={ticket.id}
            userId={user.id}
            initialMessages={signedMessages as never[]}
            canSend={ticket.status !== "closed"}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
