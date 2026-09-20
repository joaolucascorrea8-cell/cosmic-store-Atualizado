import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { orderStatus } from "@/lib/order-status";
import OrderChat from "./OrderChat";
import FeedbackForm from "./FeedbackForm";
import ProofReuploadForm from "./ProofReuploadForm";
import OrderStatusWatcher from "./OrderStatusWatcher";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/pedidos/${id}`);

  const { data: order } = await supabase.from("orders").select("id,order_code,status,total,game_nickname,created_at,paid_at,delivered_at,delivery_due_at,chat_closed_at,rejection_reason,order_items(product_name,unit_price,quantity)").eq("id", id).maybeSingle();
  if (!order) notFound();

  const status = orderStatus[order.status] ?? { label: order.status, className: "bg-white/5 text-zinc-300" };
  const chatAvailable = ["paid", "preparing_delivery", "delivered"].includes(order.status);
  const canSend = chatAvailable && !order.chat_closed_at;
  const { data: messages } = chatAvailable
    ? await supabase.from("order_messages").select("id,user_id,message,created_at,profiles(nickname,avatar_url)").eq("order_id", id).order("created_at")
    : { data: [] };
  const { data: feedback } = order.status === "delivered"
    ? await supabase.from("feedbacks").select("rating,comment").eq("order_id", id).maybeSingle()
    : { data: null };

  return <>
    <SiteHeader />
    <OrderStatusWatcher orderId={id} initialStatus={order.status} initialChatClosedAt={order.chat_closed_at} />
    <main className="shell min-h-[70vh] py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Pedido</p>
            <h1 className="mt-2 text-3xl font-black">{order.order_code}</h1>
            <p className="mt-2 text-sm text-zinc-500">Criado em {new Date(order.created_at).toLocaleString("pt-BR")}</p>
            {order.delivery_due_at && !["delivered", "cancelled"].includes(order.status) && <p className="mt-1 text-sm text-amber-300">Entrega prevista até {new Date(order.delivery_due_at).toLocaleString("pt-BR")}.</p>}
          </div>
          <span className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${status.className}`}>{status.label}</span>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#121017] p-6">
          <div className="flex justify-between"><span className="text-zinc-400">Nickname no jogo</span><strong>{order.game_nickname}</strong></div>
          <div className="my-5 border-t border-white/10" />
          <div className="space-y-3">{order.order_items?.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm"><span>{item.quantity}× {item.product_name}</span><strong>{(Number(item.unit_price) * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>)}</div>
          <div className="my-5 border-t border-white/10" />
          <div className="flex justify-between text-xl"><strong>Total</strong><strong>{Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
        </section>

        {order.status === "proof_submitted" && <p className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sky-200">Recebemos seu comprovante. Você será avisado quando o pagamento for conferido.</p>}
        {order.status === "proof_rejected" && <><p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200"><strong>Comprovante recusado.</strong><span className="mt-1 block">Motivo: {order.rejection_reason ?? "O comprovante não pôde ser confirmado."}</span></p><ProofReuploadForm orderId={id} /></>}
        {chatAvailable
          ? <OrderChat orderId={id} userId={user.id} initialMessages={(messages ?? []) as never[]} canSend={canSend} />
          : <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6"><h2 className="font-black">Chat do pedido</h2><p className="mt-2 text-sm text-zinc-500">Será liberado assim que o pagamento for confirmado.</p></section>}
        {order.status === "delivered" && <FeedbackForm orderId={id} userId={user.id} initial={feedback} />}
      </div>
    </main>
    <SiteFooter />
  </>;
}
