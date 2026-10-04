import { requireAdmin } from "@/lib/require-admin";
import { pageNumber, localDate } from "@/lib/catalog";
import Pagination from "@/app/components/Pagination";
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

export default async function AdminSupport({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    ordem?: string;
    pagina?: string;
    categoria?: string;
  }>;
}) {
  const params = await searchParams,
    user = await requireAdmin();
  const supabase = await createClient();
  const { data: listing, error } = await createAdminClient().rpc(
    "list_store_support_filtered",
    {
      p_query: (params.q ?? "").trim().slice(0, 100),
      p_status: params.status ?? "",
      p_sort: params.ordem ?? "priority",
      p_page: pageNumber(params.pagina),
      p_category: params.categoria ?? "",
    },
  );
  const ticketRows = listing?.rows;
  const unreadResult = user
    ? await supabase
        .from("notifications")
        .select("link")
        .eq("user_id", user.id)
        .is("read_at", null)
        .like("link", "/admin/suporte/%")
    : { data: [] as { link: string | null }[] };
  const unread = unreadResult.data;

  const tickets = (ticketRows ?? []) as TicketRow[];
  const unreadByTicket = new Map<string, number>();
  (unread ?? []).forEach((notification) => {
    if (!notification.link) return;
    unreadByTicket.set(
      notification.link,
      (unreadByTicket.get(notification.link) ?? 0) + 1,
    );
  });

  return (
    <main
      id="conteudo-principal"
      tabIndex={-1}
      className="min-h-screen p-4 text-white sm:p-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1 className="section-title">Atendimentos</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Mensagens novas ficam destacadas até você abrir a conversa.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold"
          >
            Voltar
          </Link>
        </div>

        <form className="catalog-toolbar mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_160px_150px_auto]">
          <input
            name="q"
            defaultValue={params.q}
            aria-label="Buscar atendimento"
            placeholder="Assunto ou cliente"
            className="admin-input"
          />
          <select
            name="status"
            defaultValue={params.status ?? ""}
            aria-label="Situação"
            className="admin-input"
          >
            <option value="">Todas as situações</option>
            <option value="open">Aguardando equipe</option>
            <option value="answered">Respondidos</option>
            <option value="closed">Encerrados</option>
          </select>
          <select
            name="categoria"
            defaultValue={params.categoria ?? ""}
            aria-label="Tipo de atendimento"
            className="admin-input"
          >
            <option value="">Todos os assuntos</option>
            <option value="server_request">Pedidos de servidor</option>
            <option value="order">Pedidos</option>
            <option value="payment">Pagamentos</option>
            <option value="account">Contas</option>
            <option value="product">Produtos</option>
            <option value="other">Outros</option>
          </select>
          <select
            name="ordem"
            defaultValue={params.ordem ?? "priority"}
            aria-label="Ordem"
            className="admin-input"
          >
            <option value="priority">Prioridade</option>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
          </select>
          <button className="btn-primary">Filtrar</button>
        </form>
        {error && (
          <p role="alert" className="admin-error mt-5">
            Não foi possível carregar os atendimentos. Confira a atualização
            SQL.
          </p>
        )}
        <p className="mt-4 text-xs text-zinc-400">
          {listing?.total ?? 0} atendimentos encontrados
        </p>
        <div className="mt-8 grid gap-3 md:hidden">
          {tickets.map((ticket) => {
            const profile = Array.isArray(ticket.profiles)
              ? ticket.profiles[0]
              : ticket.profiles;
            const unreadCount =
              unreadByTicket.get(`/admin/suporte/${ticket.id}`) ?? 0;
            return (
              <Link
                key={ticket.id}
                href={`/admin/suporte/${ticket.id}`}
                className={`rounded-2xl border p-4 ${unreadCount ? "border-violet-500/40 bg-violet-500/[.06]" : "border-white/10 bg-white/[.025]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-words">{ticket.subject}</strong>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {unreadCount} nova{unreadCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {profile?.nickname ?? "Cliente"}
                      {ticket.category === "server_request"
                        ? " · Pedido de servidor VIP"
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${ticket.status === "closed" ? "bg-zinc-500/10 text-zinc-400" : ticket.status === "answered" ? "bg-emerald-500/10 text-emerald-300" : "bg-violet-500/10 text-violet-300"}`}
                  >
                    {ticket.status === "closed"
                      ? "Encerrado"
                      : ticket.status === "answered"
                        ? "Respondido"
                        : "Aguardando equipe"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                  <span className="text-zinc-500">
                    {localDate(ticket.updated_at)}
                  </span>
                  <strong className="text-violet-300">Abrir →</strong>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="surface mt-8 hidden overflow-x-auto rounded-3xl md:block">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-white/[.04] text-zinc-500">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Assunto</th>
                <th className="p-4">Situação</th>
                <th className="p-4">Atualizado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const profile = Array.isArray(ticket.profiles)
                  ? ticket.profiles[0]
                  : ticket.profiles;
                const unreadCount =
                  unreadByTicket.get(`/admin/suporte/${ticket.id}`) ?? 0;
                return (
                  <tr
                    key={ticket.id}
                    className={`border-t border-white/[.07] ${unreadCount ? "bg-violet-500/[.06]" : ""}`}
                  >
                    <td className="p-4 font-bold">
                      {profile?.nickname ?? "Cliente"}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {ticket.subject}
                        {ticket.category === "server_request" && (
                          <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-300">
                            Servidor VIP
                          </span>
                        )}
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                            {unreadCount} nova{unreadCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${ticket.status === "closed" ? "bg-zinc-500/10 text-zinc-400" : ticket.status === "answered" ? "bg-emerald-500/10 text-emerald-300" : "bg-violet-500/10 text-violet-300"}`}
                      >
                        {ticket.status === "closed"
                          ? "Encerrado"
                          : ticket.status === "answered"
                            ? "Respondido"
                            : "Aguardando equipe"}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500">
                      {localDate(ticket.updated_at)}
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/admin/suporte/${ticket.id}`}
                        className="font-bold text-violet-300"
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!tickets.length && (
            <p className="p-12 text-center text-zinc-500">
              Nenhum atendimento aberto.
            </p>
          )}
        </div>
        <Pagination
          page={listing?.page ?? 1}
          total={listing?.total ?? 0}
          pageSize={25}
          pathname="/admin/suporte"
          params={params}
        />
      </div>
    </main>
  );
}
