import Link from "next/link";
import { redirect } from "next/navigation";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { orderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pedidos");

  const [{ data: orders }, { data: unread }] = await Promise.all([
    supabase.from("orders").select("id,order_code,status,total,game_nickname,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("notifications").select("link").eq("user_id", user.id).is("read_at", null).like("link", "/pedidos/%"),
  ]);

  const unreadByOrder = new Map<string, number>();
  (unread ?? []).forEach((notification) => {
    if (!notification.link) return;
    unreadByOrder.set(notification.link, (unreadByOrder.get(notification.link) ?? 0) + 1);
  });
  const active = orders?.filter((order) => !["delivered", "cancelled"].includes(order.status)).length ?? 0;

  return <>
    <SiteHeader />
    <main className="shell min-h-[70dvh] py-8 sm:py-12">
      <div className="rounded-3xl border border-violet-500/15 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.16),transparent_45%),#121017] p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Sua conta</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black sm:text-4xl">Meus pedidos</h1><p className="mt-2 text-sm text-zinc-400">Acompanhe pagamento, atendimento e entrega em tempo real.</p></div>
          {active > 0 && <span className="rounded-full bg-violet-500/15 px-4 py-2 text-sm font-bold text-violet-200">{active} em andamento</span>}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {orders?.length ? orders.map((order) => {
          const status = orderStatus[order.status] ?? { label: order.status, className: "text-zinc-300 bg-white/5" };
          const unreadCount = unreadByOrder.get(`/pedidos/${order.id}`) ?? 0;
          return <Link key={order.id} href={`/pedidos/${order.id}`} className={`group block rounded-2xl border bg-[#121017] p-4 transition hover:-translate-y-0.5 hover:border-violet-500/40 sm:p-5 ${unreadCount ? "border-violet-500/35 shadow-[0_0_0_1px_rgba(139,92,246,.08)]" : "border-white/10"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="block truncate text-base">{order.order_code}</strong>
                  {unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{unreadCount} nova{unreadCount === 1 ? "" : "s"}</span>}
                </div>
                <p className="mt-1 text-sm text-zinc-400">Nick: {order.game_nickname}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/5 pt-3">
              <div><p className="text-xs text-zinc-500">Criado em {new Date(order.created_at).toLocaleDateString("pt-BR")}</p><p className="mt-1 text-xs text-zinc-400">Atualizado {new Date(order.updated_at ?? order.created_at).toLocaleString("pt-BR")}</p></div>
              <strong className="shrink-0 text-lg">{Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
            </div>
          </Link>;
        }) : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><p className="font-bold text-zinc-300">Nenhum pedido ainda</p><p className="mt-2 text-sm text-zinc-500">Seus pedidos aparecerão aqui depois da compra.</p><Link href="/produtos" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-5 font-bold">Ver produtos</Link></div>}
      </div>
    </main>
    <SiteFooter />
  </>;
}
