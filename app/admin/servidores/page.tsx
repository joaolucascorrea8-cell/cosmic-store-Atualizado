import ResolveReport from "./ResolveReport";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/query-pages";
import type { GameServer } from "@/lib/game-servers";
import ServerManager from "./ServerManager";
export const dynamic = "force-dynamic";
export default async function AdminServersPage({
  searchParams,
}: {
  searchParams: Promise<{ relatos?: string }>;
}) {
  const query = await searchParams;
  const reportPage = Math.max(
    1,
    Math.min(100000, Number.parseInt(query.relatos ?? "1", 10) || 1),
  );
  await requireAdmin();
  const client = createAdminClient();
  const [servers, games, requests, reports] = await Promise.all([
    allRows(
      client
        .from("game_servers")
        .select(
          "id,game_name,name,join_url,description,image_url,is_active,availability,display_order,updated_at",
        )
        .order("display_order")
        .order("created_at")
        .order("id"),
    ),
    allRows(client.from("games").select("id,name").order("name").order("id")),
    client
      .from("support_tickets")
      .select("id,subject,status,requested_game", { count: "exact" })
      .eq("category", "server_request")
      .neq("status", "closed")
      .order("updated_at", { ascending: false })
      .limit(5),
    client
      .from("server_reports")
      .select("id,reason,details,created_at,game_servers(game_name,name)", {
        count: "exact",
      })
      .eq("status", "open")
      .order("created_at")
      .order("id")
      .range((reportPage - 1) * 20, reportPage * 20 - 1),
  ]);
  const rows = (servers.data ?? []) as GameServer[];
  return (
    <main id="conteudo-principal" tabIndex={-1} className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Entre e jogue</p>
          <h1 className="section-title">Servidores</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Cadastre links para os jogos, organize a página e acompanhe as
            solicitações.
          </p>
        </div>
        <Link href="/servidores" className="admin-small-button">
          Ver página pública ↗
        </Link>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="admin-stat">
          <span>Publicados</span>
          <strong>{rows.filter((server) => server.is_active).length}</strong>
          <small>visíveis na loja</small>
        </div>
        <div className="admin-stat">
          <span>Ocultos</span>
          <strong>{rows.filter((server) => !server.is_active).length}</strong>
          <small>guardados no painel</small>
        </div>
        <div className="admin-stat">
          <span>Solicitações em aberto</span>
          <strong>{requests.count ?? 0}</strong>
          <small>conversas no suporte</small>
        </div>
      </div>
      {(servers.error || requests.error) && (
        <p role="alert" className="admin-error mt-5">
          Não foi possível carregar a área de servidores. Aplique a migração
          202610040001_servers_live_pages.sql e atualize a página.
        </p>
      )}
      <section className="surface mt-6 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">Pedidos de servidor</h2>
          <Link
            href="/admin/suporte?categoria=server_request"
            className="text-sm font-bold text-violet-300"
          >
            Ver todas as solicitações →
          </Link>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          O nome do jogo é livre. Responda pela conversa e encerre quando
          terminar.
        </p>
        <div className="mt-4 space-y-2">
          {(requests.data ?? []).map((ticket) => (
            <Link
              key={ticket.id}
              href={`/admin/suporte/${ticket.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm hover:border-violet-500/40"
            >
              <span className="break-words font-bold">
                {ticket.requested_game ?? ticket.subject}
              </span>
              <span className="shrink-0 text-xs text-violet-300">
                {ticket.status === "answered"
                  ? "Respondido"
                  : "Aguardando equipe"}{" "}
                →
              </span>
            </Link>
          ))}
          {!requests.error && !requests.data?.length && (
            <p className="py-3 text-sm text-zinc-500">
              Nenhuma solicitação em aberto.
            </p>
          )}
        </div>
      </section>
      <section id="relatos" className="admin-panel mt-6">
        <h2 className="text-lg font-black">
          Problemas relatados{" "}
          <span className="text-zinc-500">({reports.count ?? "—"})</span>
        </h2>
        <p className="mt-2 text-xs text-zinc-400">
          Confira o link ou estado do servidor antes de resolver o aviso.
        </p>
        {reports.error ? (
          <p role="alert" className="admin-error mt-3">
            Não foi possível carregar os avisos. Confira o novo SQL.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {reports.data?.map((report) => {
              const server = (
                Array.isArray(report.game_servers)
                  ? report.game_servers[0]
                  : report.game_servers
              ) as { game_name: string; name: string } | null;
              return (
                <div
                  key={report.id}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <strong className="block text-sm">
                    {server?.game_name} · {server?.name}
                  </strong>
                  <p className="mt-1 text-xs text-amber-200">
                    {
                      {
                        invalid_link: "Link inválido",
                        cannot_join: "Não consegue entrar",
                        other: "Outro problema",
                      }[report.reason as string]
                    }
                  </p>
                  <p className="my-3 whitespace-pre-line break-words text-sm text-zinc-400">
                    {report.details}
                  </p>
                  <ResolveReport id={report.id} />
                </div>
              );
            })}
            {!reports.data?.length && (
              <p className="text-sm text-zinc-500">
                Nenhum aviso pendente nesta página.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          {reportPage > 1 && (
            <Link
              href={`/admin/servidores?relatos=${reportPage - 1}#relatos`}
              className="admin-small-button"
            >
              ← Anterior
            </Link>
          )}
          {(reports.count ?? 0) > reportPage * 20 && (
            <Link
              href={`/admin/servidores?relatos=${reportPage + 1}#relatos`}
              className="admin-small-button"
            >
              Próxima →
            </Link>
          )}
        </div>
      </section>
      {!servers.error && (
        <ServerManager
          servers={rows}
          games={[...new Set((games.data ?? []).map((game) => game.name))]}
        />
      )}
    </main>
  );
}
