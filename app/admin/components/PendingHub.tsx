import { getRequestTime } from "@/lib/store-service-server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { localDate } from "@/lib/catalog";
export default async function PendingHub() {
  await requireAdmin();
  const client = createAdminClient();
  const [proofs, delivery, support, servers, reports] = await Promise.all([
    client
      .from("orders")
      .select("id,order_code,game_nickname,created_at", { count: "exact" })
      .in("status", ["proof_submitted", "under_review"])
      .order("updated_at", { ascending: true })
      .limit(4),
    client
      .from("orders")
      .select("id,order_code,game_nickname,delivery_due_at,created_at", {
        count: "exact",
      })
      .in("status", ["paid", "preparing_delivery"])
      .order("delivery_due_at", { ascending: true })
      .limit(4),
    client
      .from("support_tickets")
      .select("id,subject,updated_at", { count: "exact" })
      .eq("status", "open")
      .neq("category", "server_request")
      .order("updated_at")
      .limit(4),
    client
      .from("support_tickets")
      .select("id,subject,updated_at", { count: "exact" })
      .eq("status", "open")
      .eq("category", "server_request")
      .order("updated_at")
      .limit(4),
    client
      .from("server_reports")
      .select("id,created_at,game_servers(game_name,name)", { count: "exact" })
      .eq("status", "open")
      .order("created_at")
      .limit(4),
  ]);
  const now = await getRequestTime();
  const groups = [
    {
      title: "Conferir pagamentos",
      count: proofs.count,
      error: proofs.error,
      href: "/admin/pedidos?status=pending",
      rows: (proofs.data ?? []).map((p) => ({
        id: p.id,
        title: p.order_code,
        detail: p.game_nickname,
        href: `/admin/pedidos/${p.id}`,
        late: false,
      })),
    },
    {
      title: "Preparar entregas",
      count: delivery.count,
      error: delivery.error,
      href: "/admin/pedidos?status=delivery",
      rows: (delivery.data ?? []).map((p) => ({
        id: p.id,
        title: p.order_code,
        detail: p.delivery_due_at
          ? `Prazo: ${localDate(p.delivery_due_at)}`
          : p.game_nickname,
        href: `/admin/pedidos/${p.id}`,
        late: Boolean(
          p.delivery_due_at && new Date(p.delivery_due_at).getTime() < now,
        ),
      })),
    },
    {
      title: "Responder suporte",
      count: support.count,
      error: support.error,
      href: "/admin/suporte?status=open",
      rows: (support.data ?? []).map((p) => ({
        id: p.id,
        title: p.subject,
        detail: localDate(p.updated_at),
        href: `/admin/suporte/${p.id}`,
        late: false,
      })),
    },
    {
      title: "Pedidos de servidor",
      count: servers.count,
      error: servers.error,
      href: "/admin/suporte?status=open&categoria=server_request",
      rows: (servers.data ?? []).map((p) => ({
        id: p.id,
        title: p.subject,
        detail: localDate(p.updated_at),
        href: `/admin/suporte/${p.id}`,
        late: false,
      })),
    },
    {
      title: "Problemas em servidores",
      count: reports.count,
      error: reports.error,
      href: "/admin/servidores#relatos",
      rows: (reports.data ?? []).map((p) => {
        const game = (
          Array.isArray(p.game_servers) ? p.game_servers[0] : p.game_servers
        ) as { game_name: string; name: string } | null;
        return {
          id: p.id,
          title: `${game?.game_name ?? "Servidor"} · ${game?.name ?? ""}`,
          detail: localDate(p.created_at),
          href: "/admin/servidores#relatos",
          late: false,
        };
      }),
    },
  ];
  const count = groups.reduce((sum, g) => sum + (g.count ?? 0), 0);
  return (
    <section className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/[.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Central de pendências</h2>
          <p className="mt-1 text-xs text-zinc-400">
            {count
              ? `${count} tarefas aguardando a equipe. Comece pelas mais antigas ou pelo prazo de entrega.`
              : "Confira as filas da equipe abaixo."}
          </p>
        </div>
        <Link href="/admin/atendimento" className="admin-small-button">
          Horários e prazos →
        </Link>
      </div>
      <div className="mt-4 grid items-start gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <details
            key={group.title}
            open={(group.count ?? 0) > 0}
            className="rounded-xl border border-white/10 bg-[#121017] p-4"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold">
              <span>{group.title}</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-violet-200">
                {group.error ? "—" : (group.count ?? 0)}
              </span>
            </summary>
            {group.error ? (
              <p role="alert" className="mt-3 text-xs text-red-300">
                Não foi possível consultar esta fila.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {group.rows.map((row) => (
                  <Link
                    key={row.id}
                    href={row.href}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[.025] p-3 hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-xs">
                        {row.title}
                      </strong>
                      <small
                        className={`mt-1 block text-[11px] ${row.late ? "text-amber-300" : "text-zinc-500"}`}
                      >
                        {row.late ? "Prazo ultrapassado · " : ""}
                        {row.detail}
                      </small>
                    </span>
                    <span className="text-violet-300">→</span>
                  </Link>
                ))}
                {!group.rows.length && (
                  <p className="text-xs text-zinc-500">Nenhuma pendência.</p>
                )}
              </div>
            )}
            <Link
              href={group.href}
              className="mt-3 inline-block text-xs font-bold text-violet-300"
            >
              Ver fila completa →
            </Link>
          </details>
        ))}
      </div>
    </section>
  );
}
