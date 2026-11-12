import { createClient } from "@/lib/supabase/server";
import { orderFinance } from "@/lib/order-finance";

export default async function OrderRefundSummary({ orderId, total, paid, cancelled }: { orderId: string; total: number; paid: boolean; cancelled: boolean }) {
  const client = await createClient();
  const [{ data, error }, { data: receipts, error: receiptError }] = await Promise.all([
    client.from("order_refunds").select("id,amount,created_at").eq("order_id", orderId),
    client.from("order_additional_payments").select("id,amount,used_for_confirmation,created_at").eq("order_id", orderId),
  ]);
  if (error || receiptError) return <p className="mt-4 text-sm text-amber-200">Consulte a equipe para confirmar a situação de uma devolução financeira.</p>;
  const { received, refunded, remaining } = orderFinance(total, paid, receipts ?? [], data ?? []);
  if (!refunded && !(receipts ?? []).length && !(cancelled && paid)) return null;
  return <section className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-4">
    <h2 className="font-bold">Situação do reembolso</h2>
    <p className="mt-2 text-sm text-zinc-300">Recebimentos conferidos: R$ {received.toFixed(2).replace(".", ",")} · Devoluções registradas: R$ {refunded.toFixed(2).replace(".", ",")}.</p>
    {cancelled && remaining > 0 && <p className="mt-2 text-sm text-amber-200">O cancelamento do pedido não confirma a devolução do Pix. Fale com a equipe para acompanhar o saldo ainda não devolvido.</p>}
    {!paid && !cancelled && received > 0 && <p className="mt-2 text-sm text-amber-200">Um recebimento excepcional foi registrado. Isso não confirma a compra; acompanhe a conferência com a equipe.</p>}
  </section>;
}
