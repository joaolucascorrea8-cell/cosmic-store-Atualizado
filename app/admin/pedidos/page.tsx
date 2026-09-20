import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderStatus } from "@/lib/order-status";

type OrderRow = {
  id: string; order_code: string; status: string; total: number; game_nickname: string; created_at: string;
  profiles: { nickname: string } | { nickname: string }[] | null;
};

const priority: Record<string, number> = { proof_submitted: 0, under_review: 1, paid: 2, proof_rejected: 3, awaiting_payment: 4, delivered: 5, cancelled: 6 };
const filters = [
  ["", "Todos"], ["pending", "Aguardando análise"], ["awaiting_payment", "Aguardando pagamento"],
  ["paid", "Pagos"], ["delivered", "Entregues"], ["cancelled", "Cancelados"],
];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const selectedStatus = params.status ?? "";
  const { data } = await createAdminClient().from("orders").select("id,order_code,status,total,game_nickname,created_at,profiles(nickname)").order("created_at", { ascending: false });
  const allOrders = (data ?? []) as OrderRow[];
  const counts = {
    total: allOrders.length,
    proofs: allOrders.filter((order) => ["proof_submitted", "under_review"].includes(order.status)).length,
    paid: allOrders.filter((order) => order.status === "paid").length,
    delivered: allOrders.filter((order) => order.status === "delivered").length,
  };
  const orders = allOrders.filter((order) => {
    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    const matchesText = !query || [order.order_code, order.game_nickname, profile?.nickname ?? ""].some((value) => value.toLowerCase().includes(query));
    const matchesStatus = !selectedStatus || (selectedStatus === "pending" ? ["proof_submitted", "under_review"].includes(order.status) : order.status === selectedStatus);
    return matchesText && matchesStatus;
  }).sort((a, b) => (priority[a.status] ?? 99) - (priority[b.status] ?? 99) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <main className="min-h-screen bg-[#080812] p-4 text-white sm:p-6"><div className="mx-auto max-w-6xl">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-violet-400">Painel administrativo</p><h1 className="mt-2 text-3xl font-black">Pedidos</h1><p className="mt-2 text-sm text-zinc-400">Comprovantes pendentes aparecem primeiro.</p></div><Link href="/admin" className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-bold">Voltar</Link></div>

    <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Pedidos',counts.total,'text-white'],['Para analisar',counts.proofs,'text-amber-300'],['Pagos',counts.paid,'text-emerald-300'],['Entregues',counts.delivered,'text-violet-300']].map(([label,value,color]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</p><strong className={`mt-2 block text-2xl sm:text-3xl ${color}`}>{value}</strong></div>)}
    </section>

    <form className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 md:grid-cols-[1fr_220px_auto]">
      <label className="sr-only" htmlFor="order-search">Buscar pedido</label><input id="order-search" name="q" defaultValue={params.q} placeholder="Código, cliente ou nickname" className="min-h-11 rounded-xl border border-white/10 bg-[#080812] px-4 outline-none focus:border-violet-500" />
      <label className="sr-only" htmlFor="status-filter">Filtrar situação</label><select id="status-filter" name="status" defaultValue={selectedStatus} className="min-h-11 rounded-xl border border-white/10 bg-[#080812] px-4">{filters.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className="min-h-11 rounded-xl bg-violet-600 px-5 font-bold hover:bg-violet-500">Filtrar</button>
    </form>

    <p className="mt-4 text-sm text-zinc-400">{orders.length} {orders.length === 1 ? "pedido encontrado" : "pedidos encontrados"}</p>
    <div className="mt-4 grid gap-3 md:hidden">{orders.map((order) => { const status = orderStatus[order.status] ?? { label: order.status, className: "" }; const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles; return <Link key={order.id} href={`/admin/pedidos/${order.id}`} className={`rounded-2xl border p-4 ${["proof_submitted","under_review"].includes(order.status) ? "border-amber-400/30 bg-amber-500/5" : "border-white/10 bg-white/[.025]"}`}><div className="flex items-start justify-between gap-3"><div><strong>{order.order_code}</strong><p className="mt-1 text-xs text-zinc-400">{new Date(order.created_at).toLocaleString("pt-BR")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-zinc-500">Cliente</span>{profile?.nickname ?? "Cliente"}</div><div><span className="block text-xs text-zinc-500">Nickname</span>{order.game_nickname}</div></div><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3"><strong>{Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><span className="font-bold text-violet-300">Abrir →</span></div></Link>; })}</div>
    <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-white/10 md:block"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-white/5 text-zinc-300"><tr><th className="p-4">Pedido</th><th className="p-4">Cliente</th><th className="p-4">Nickname</th><th className="p-4">Total</th><th className="p-4">Situação</th><th className="p-4"></th></tr></thead><tbody>{orders.map((order) => { const status = orderStatus[order.status] ?? { label: order.status, className: "" }; const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles; return <tr key={order.id} className={`border-t border-white/10 ${["proof_submitted","under_review"].includes(order.status) ? "bg-amber-500/5" : ""}`}><td className="p-4 font-bold">{order.order_code}<span className="mt-1 block text-xs font-normal text-zinc-400">{new Date(order.created_at).toLocaleString("pt-BR")}</span></td><td className="p-4">{profile?.nickname ?? "Cliente"}</td><td className="p-4">{order.game_nickname}</td><td className="p-4 font-bold">{Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></td><td className="p-4"><Link href={`/admin/pedidos/${order.id}`} className="font-bold text-violet-300">Abrir →</Link></td></tr>; })}</tbody></table></div>
    {!orders.length && <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-12 text-center text-zinc-400">Nenhum pedido corresponde aos filtros.</div>}
  </div></main>;
}
