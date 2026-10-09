import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { money, localDate } from "@/lib/catalog";
import { markAccountAcquired, checkAccountOrder } from "./actions";
import PendingButton from "@/app/admin/components/PendingButton";
export default async function AccountOrderPanel({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  await requireAdmin();
  const { data: a } = await createAdminClient()
    .from("robux_account_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();
  if (!a)
    return (
      <p className="admin-error mt-5">Snapshot da conta não encontrado.</p>
    );
  return (
    <section className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/[.055] p-5">
      <h2 className="text-xl font-black">Pedido de conta com Robux</h2>
      <p className="mt-3">
        {Number(a.robux).toLocaleString("pt-BR")} Robux · K Cosmic{" "}
        {money(a.cosmic_k)} / 1K · Venda {money(a.sale_price)}
      </p>
      <div className="mt-4 rounded-xl border border-white/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Informação interna · snapshot original
        </p>
        <p className="mt-3">
          Procure por: <strong className="font-mono">{a.masked_id}</strong> ·{" "}
          {Number(a.robux).toLocaleString("pt-BR")} Robux ·{" "}
          {money(a.supplier_cost)}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          K fornecedor: {money(a.supplier_k)} · Margem:{" "}
          {money(a.margin_per_thousand)} / 1K
        </p>
        <p className="mt-2 break-all text-xs text-zinc-500">
          Cotação: {a.quote_id} · Oferta: {a.provider_id}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Snapshot: {localDate(a.snapshot_at)} · Última validação:{" "}
          {localDate(a.last_validated_at)}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Reserva de pagamento até: {localDate(a.reservation_until)}
        </p>
        <a
          href={a.quote_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold"
        >
          Abrir oferta no fornecedor
        </a>
      </div>
      <p className="mt-4 text-sm">
        Disponibilidade:{" "}
        {a.acquired_at
          ? "Aquisição manual registrada"
          : a.availability === "available"
            ? "Confirmada na última consulta"
            : a.availability === "unavailable"
              ? "Oferta indisponível · revisar pedido"
              : "Não foi possível consultar · revisar pedido"}
      </p>
      {a.last_supplier_k && (
        <p className="mt-2 text-sm text-zinc-400">
          Última consulta: K {money(a.last_supplier_k)} · Custo{" "}
          {money(a.last_supplier_cost)}. O snapshot original acima é preservado.
        </p>
      )}
      {a.last_validation_error && (
        <p className="mt-2 text-sm text-amber-200">{a.last_validation_error}</p>
      )}
      <p className="mt-2 text-sm text-zinc-400">
        O link abre a cotação correta. A Cosmic não compra nem reserva no
        fornecedor. Confira ID, Robux e custo na página antes da aquisição; o
        preço de venda deste pedido permanece o do snapshot.
      </p>
      {!a.acquired_at && status !== "cancelled" && (
        <form action={checkAccountOrder} className="mt-4">
          <input type="hidden" name="order_id" value={orderId} />
          <PendingButton>Verificar disponibilidade agora</PendingButton>
        </form>
      )}
      {a.acquired_at ? (
        <p className="mt-4 text-emerald-300">
          Adquirida manualmente em {localDate(a.acquired_at)}. Envie os dados no
          chat privado e uma imagem de confirmação da entrega antes de concluir.
        </p>
      ) : (
        ["paid", "preparing_delivery"].includes(status) && (
          <form action={markAccountAcquired} className="mt-5">
            <input type="hidden" name="order_id" value={orderId} />
            <label className="mb-3 flex items-start gap-3 text-sm">
              <input type="checkbox" name="confirmed" required /> Já comprei
              manualmente a conta correta e conferi seus dados.
            </label>
            <PendingButton>Registrar aquisição manual</PendingButton>
          </form>
        )
      )}
    </section>
  );
}
