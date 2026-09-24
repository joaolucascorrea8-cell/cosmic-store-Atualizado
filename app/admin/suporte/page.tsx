import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TicketRow = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: { nickname: string } | { nickname: string }[] | null;
};

export default async function AdminSupport() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ticketRows } = await createAdminClient()
    .from("support_tickets")
    .select("id,subject,category,status,created_at,updated_at,profiles(nickname)")
    .order("updated_at", { ascending: false });
  const unreadResult = user
    ? await supabase.from("notifications").select("link").eq("user_id", user.id).is("read_at", null).like("link", "/admin/suporte/%")
    : { data: [] as { link: string | null }[] };
  const unread = unreadResult.data;

  const tickets = (ticketRows ?? []) as TicketRow[];
  const unreadByTicket = new Map<string, number>();
  (unread ?? []).forEach((notification) => {
    if (!notification.link) return;
    unreadByTicket.set(notification.link, (unreadByTicket.get(notification.link) ?? 0) + 1);
  });

  return <main className="min-h-screen p-4 text-white sm:p-6">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">Painel administrativo</p><h1 className="section-title">Atendimentos</h1><p className="mt-2 text-sm text-zinc-400">Mensagens novas ficam destacadas até você abrir a conversa.</p></div>
        <Link href="/admin" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">Voltar</Link>
      </div>

      <div className="mt-8 grid gap-3 md:hidden">
        {tickets.map((ticket) => {
          const profile = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles;
          const unreadCount = unreadByTicket.get(`/admin/suporte/${ticket.id}`) ?? 0;
          return <Link key={ticket.id} href={`/admin/suporte/${ticket.id}`} className={`rounded-2xl border p-4 ${unreadCount ? "border-violet-500/40 bg-violet-500/[.06]" : "border-white/10 bg-white/[.025]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words">{ticket.subject}</strong>{unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{unreadCount} nova{unreadCount === 1 ? "" : "s"}</span>}</div><p className="mt-1 text-xs text-zinc-500">{profile?.nickname ?? "Cliente"}</p></div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${ticket.status === "closed" ? "bg-zinc-500/10 text-zinc-400" : ticket.status === "answered" ? "bg-emerald-500/10 text-emerald-300" : "bg-violet-500/10 text-violet-300"}`}>{ticket.status === "closed" ? "Encerrado" : ticket.status === "answered" ? "Respondido" : "Aguardando equipe"}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs"><span className="text-zinc-500">{new Date(ticket.updated_at).toLocaleString("pt-BR")}</span><strong className="text-violet-300">Abrir →</strong></div>
          </Link>;
        })}
      </div>

      <div className="surface mt-8 hidden overflow-x-auto rounded-3xl md:block">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-white/[.04] text-zinc-500"><tr><th className="p-4">Cliente</th><th className="p-4">Assunto</th><th className="p-4">Situação</th><th className="p-4">Atualizado</th><th className="p-4"></th></tr></thead>
          <tbody>{tickets.map((ticket) => {
            const profile = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles;
            const unreadCount = unreadByTicket.get(`/admin/suporte/${ticket.id}`) ?? 0;
            return <tr key={ticket.id} className={`border-t border-white/[.07] ${unreadCount ? "bg-violet-500/[.06]" : ""}`}>
              <td className="p-4 font-bold">{profile?.nickname ?? "Cliente"}</td>
              <td className="p-4"><span className="inline-flex flex-wrap items-center gap-2">{ticket.subject}{unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{unreadCount} nova{unreadCount === 1 ? "" : "s"}</span>}</span></td>
              <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${ticket.status === "closed" ? "bg-zinc-500/10 text-zinc-400" : ticket.status === "answered" ? "bg-emerald-500/10 text-emerald-300" : "bg-violet-500/10 text-violet-300"}`}>{ticket.status === "closed" ? "Encerrado" : ticket.status === "answered" ? "Respondido" : "Aguardando equipe"}</span></td>
              <td className="p-4 text-zinc-500">{new Date(ticket.updated_at).toLocaleString("pt-BR")}</td>
              <td className="p-4"><Link href={`/admin/suporte/${ticket.id}`} className="font-bold text-violet-300">Abrir →</Link></td>
            </tr>;
          })}</tbody>
        </table>
        {!tickets.length && <p className="p-12 text-center text-zinc-500">Nenhum atendimento aberto.</p>}
      </div>
    </div>
  </main>;
}
