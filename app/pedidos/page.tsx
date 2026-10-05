import Pagination from "@/app/components/Pagination";
import { localDate, money, pageNumber } from "@/lib/catalog";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { orderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { q?: string; status?: string; pagina?: string };
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pedidos");

  const q = (params.q ?? "").trim().slice(0, 100),
    selectedStatus = Object.keys(orderStatus).includes(params.status ?? "")
      ? params.status
      : "";
  const query = () => {
    let request = supabase
      .from("orders")
      .select(
        "id,order_code,status,total,game_nickname,created_at,updated_at,order_type,robux_orders(supplier_status)",
        { count: "exact" },
      )
      .eq("user_id", user.id);
    if (q)
      request = request.ilike(
        "order_code",
        `%${q.replace(/[\\%_]/g, "\\$&")}%`,
      );
    if (selectedStatus) request = request.eq("status", selectedStatus);
    return request.order("created_at", { ascending: false }).order("id");
  };
  const { count, error: countError } = await query().range(0, 0);
  const total = count ?? 0,
    page = Math.min(
      pageNumber(params.pagina),
      Math.max(1, Math.ceil(total / 25)),
    );
  const [{ data: orders, error }, { data: unread }, { count: activeCount }] =
    await Promise.all([
      query().range((page - 1) * 25, page * 25 - 1),
      supabase
        .from("notifications")
        .select("link")
        .eq("user_id", user.id)
        .is("read_at", null)
        .like("link", "/pedidos/%"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("status", "in", "(delivered,cancelled)"),
    ]);
  const unreadByOrder = new Map<string, number>();
  (unread ?? []).forEach((notification) => {
    if (!notification.link) return;
    unreadByOrder.set(
      notification.link,
      (unreadByOrder.get(notification.link) ?? 0) + 1,
    );
  });
  const active = activeCount ?? 0;

  return (
    <>
      <SiteHeader />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell min-h-[70dvh] py-8 sm:py-12"
      >
        <div className="rounded-3xl border border-violet-500/15 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.16),transparent_45%),#121017] p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">
            Sua conta
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">Meus pedidos</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Acompanhe pagamento, atendimento e entrega em tempo real.
              </p>
            </div>
            {active > 0 && (
              <span className="rounded-full bg-violet-500/15 px-4 py-2 text-sm font-bold text-violet-200">
                {active} em andamento
              </span>
            )}
          </div>
        </div>

        <form className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_230px_auto]">
          <input
            aria-label="Buscar código do pedido"
            name="q"
            className="admin-input"
            placeholder="Buscar pelo código do pedido…"
            defaultValue={q}
            maxLength={100}
          />
          <select
            aria-label="Status do pedido"
            name="status"
            className="admin-input"
            defaultValue={selectedStatus}
          >
            <option value="">Todos os status</option>
            {Object.entries(orderStatus).map(([value, status]) => (
              <option key={value} value={value}>
                {status.label}
              </option>
            ))}
          </select>
          <button className="btn-primary">Filtrar</button>
        </form>
        {(error || countError) && (
          <p role="alert" className="admin-error mt-5">
            Não foi possível carregar seus pedidos. Tente novamente.
          </p>
        )}
        <div className="mt-6 space-y-3">
          {orders?.length ? (
            orders.map((order) => {
              const robuxRelation = order.robux_orders;
              const robux = Array.isArray(robuxRelation) ? robuxRelation[0] : robuxRelation;
              const supplierStatus = robux?.supplier_status ?? "";
              const status = order.order_type === "robux"
                ? supplierStatus === "COMPLETED" || order.status === "delivered"
                  ? { label: "GamePass comprado", className: "text-emerald-300 bg-emerald-500/10" }
                  : supplierStatus === "PENDING"
                    ? { label: "Comprando GamePass", className: "text-violet-200 bg-violet-500/10" }
                    : supplierStatus === "CANCELLED" || supplierStatus === "FAILED"
                      ? { label: "Entrega em revisão", className: "text-amber-200 bg-amber-500/10" }
                      : orderStatus[order.status] ?? { label: order.status, className: "text-zinc-300 bg-white/5" }
                : orderStatus[order.status] ?? {
                    label: order.status,
                    className: "text-zinc-300 bg-white/5",
                  };
              const unreadCount =
                unreadByOrder.get(`/pedidos/${order.id}`) ?? 0;
              return (
                <Link
                  key={order.id}
                  href={`/pedidos/${order.id}`}
                  className={`group block rounded-2xl border bg-[#121017] p-4 transition hover:-translate-y-0.5 hover:border-violet-500/40 sm:p-5 ${unreadCount ? "border-violet-500/35 shadow-[0_0_0_1px_rgba(139,92,246,.08)]" : "border-white/10"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="block truncate text-base">
                          {order.order_code}
                        </strong>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                            {unreadCount} nova{unreadCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">
                        Nick: {order.game_nickname}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/5 pt-3">
                    <div>
                      <p className="text-xs text-zinc-500">
                        Criado em {localDate(order.created_at, false)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Atualizado{" "}
                        {localDate(order.updated_at ?? order.created_at)}
                      </p>
                    </div>
                    <strong className="shrink-0 text-lg">
                      {money(order.total)}
                    </strong>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <p className="font-bold text-zinc-300">
                {q || selectedStatus
                  ? "Nenhum pedido com esses filtros"
                  : "Nenhum pedido ainda"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Seus pedidos aparecerão aqui depois da compra.
              </p>
              <Link
                href="/produtos"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-5 font-bold"
              >
                Ver produtos
              </Link>
            </div>
          )}
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={25}
          pathname="/pedidos"
          params={params}
        />
      </main>
      <SiteFooter />
    </>
  );
}
