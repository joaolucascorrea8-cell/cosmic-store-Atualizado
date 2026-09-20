import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { orderStatus } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pedidos");
  const { data: orders } = await supabase.from("orders").select("id,order_code,status,total,game_nickname,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return <><SiteHeader/><main className="shell min-h-[70vh] py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Sua conta</p><h1 className="mt-2 text-4xl font-black">Meus pedidos</h1><div className="mt-8 space-y-3">{orders?.length?orders.map(order=>{const status=orderStatus[order.status]??{label:order.status,className:"text-zinc-300 bg-white/5"};return <Link key={order.id} href={`/pedidos/${order.id}`} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#121017] p-5 hover:border-violet-500/40 sm:flex-row sm:items-center sm:justify-between"><div><strong>{order.order_code}</strong><p className="mt-1 text-sm text-zinc-500">Nick: {order.game_nickname} • {new Date(order.created_at).toLocaleDateString("pt-BR")}</p></div><div className="flex items-center gap-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span><strong>{Number(order.total).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div></Link>}):<div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-zinc-500">Você ainda não possui pedidos.</div>}</div></main><SiteFooter/></>;
}

