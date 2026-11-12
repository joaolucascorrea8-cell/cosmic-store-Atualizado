import { createClient } from "@/lib/supabase/server";

export default async function OrderRefundSummary({ orderId, total, cancelled }: { orderId: string; total: number; cancelled: boolean }) {
  const { data, error } = await (await createClient()).from("order_refunds")
    .select("id,amount,created_at").eq("order_id", orderId);
  if (error) return <p className="mt-4 text-sm text-amber-200">Consulte a equipe para confirmar a situação de uma devolução financeira.</p>;
  const cents = (data ?? []).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  if (!cancelled && !cents) return null;
  return <section className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-4">
    <h2 className="font-bold">Situação do reembolso</h2>
    <p className="mt-2 text-sm text-zinc-300">Devoluções registradas: R$ {(cents / 100).toFixed(2).replace(".", ",")}.</p>
    {cancelled && cents < Math.round(total * 100) && <p className="mt-2 text-sm text-amber-200">O cancelamento do pedido não confirma a devolução do Pix. Fale com a equipe para acompanhar o saldo ainda não devolvido.</p>}
  </section>;
}
