import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { money, localDate } from "@/lib/catalog";
import { markAccountAcquired, checkAccountOrder } from "./actions";
import PendingButton from "@/app/admin/components/PendingButton";
import AccountDeliveryForm from "./AccountDeliveryForm";
import {
  accountDeliveryConfigured,
  readAdminAccountDelivery,
} from "@/lib/robux-accounts/delivery";
export default async function AccountOrderPanel({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: a }, { data: acceptance }] = await Promise.all([
    admin
      .from("robux_account_orders")
      .select("*")
      .eq("order_id", orderId)
      .single(),
    admin
      .from("robux_account_policy_acceptances")
      .select("policy_version,policy_body,accepted_at")
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);
  if (!a)
    return (
      <p className="admin-error mt-5">Snapshot da conta não encontrado.</p>
    );
  const paid = ["paid", "preparing_delivery", "delivered"].includes(status);
  let delivery = null,
    deliveryError = "";
  if (paid && a.acquired_at) {
    try {
      delivery = await readAdminAccountDelivery(orderId);
    } catch (error) {
      deliveryError =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a entrega.";
    }
  }
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-violet-500/20 bg-[#11101b]">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
              Conta com Robux
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {Number(a.robux).toLocaleString("pt-BR")} Robux
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              K Cosmic {money(a.cosmic_k)} / 1K
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-zinc-500">Valor da venda</p>
            <strong className="mt-2 block text-2xl">
              {money(a.sale_price)}
            </strong>
          </div>
        </div>
        <ol className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
          <li className={paid ? "text-emerald-300" : ""}>
            {paid ? "✓" : "1."} Pagamento
          </li>
          <li className={a.acquired_at ? "text-emerald-300" : ""}>
            {a.acquired_at ? "✓" : "2."} Aquisição manual
          </li>
          <li className={delivery ? "text-emerald-300" : ""}>
            {delivery ? "✓" : "3."} Dados salvos
          </li>
          <li className={status === "delivered" ? "text-emerald-300" : ""}>
            {status === "delivered" ? "✓" : "4."} Entrega
          </li>
        </ol>
      </div>
      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <div className="min-w-0">
          <h3 className="font-bold">Localizar e adquirir a conta</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Uso interno · confira estes dados na página da cotação.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="font-mono text-lg font-bold">{a.masked_id}</p>
            <p className="mt-2 text-sm text-zinc-300">
              {Number(a.robux).toLocaleString("pt-BR")} Robux ·{" "}
              {money(a.supplier_cost)}
            </p>
            <a
              href={a.quote_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-violet-400/30 px-4 text-sm font-bold text-violet-200 hover:bg-violet-500/10"
            >
              Abrir oferta no fornecedor ↗
            </a>
          </div>
          {a.acquired_at ? (
            <p className="mt-4 text-sm text-emerald-300">
              Aquisição registrada em {localDate(a.acquired_at)}.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-zinc-400">
                {a.availability === "available"
                  ? "Disponível na última consulta."
                  : "Disponibilidade em revisão. Confira antes de adquirir."}
              </p>
              {a.last_validation_error && (
                <p className="mt-2 text-xs text-amber-200">
                  {a.last_validation_error}
                </p>
              )}
              {status !== "cancelled" && (
                <form action={checkAccountOrder} className="mt-3">
                  <input type="hidden" name="order_id" value={orderId} />
                  <PendingButton>Verificar disponibilidade</PendingButton>
                </form>
              )}
              {paid && (
                <form action={markAccountAcquired} className="mt-5">
                  <input type="hidden" name="order_id" value={orderId} />
                  <label className="mb-3 flex items-start gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      name="confirmed"
                      required
                      className="mt-1"
                    />
                    Já adquiri manualmente a conta correta e conferi seus dados.
                  </label>
                  <PendingButton>Registrar aquisição</PendingButton>
                </form>
              )}
            </>
          )}
          <details className="mt-5 border-t border-white/10 pt-4 text-xs text-zinc-400">
            <summary className="cursor-pointer font-bold text-zinc-300">
              Cotação e histórico da oferta
            </summary>
            <div className="mt-3 space-y-2 leading-6">
              <p>
                K fornecedor {money(a.supplier_k)} · Margem{" "}
                {money(a.margin_per_thousand)} / 1K
              </p>
              <p>
                Snapshot {localDate(a.snapshot_at)} · Última validação{" "}
                {localDate(a.last_validated_at)}
              </p>
              <p>Reserva até {localDate(a.reservation_until)}</p>
              <p className="break-all">Cotação: {a.quote_id}</p>
              <p className="break-all">Oferta: {a.provider_id}</p>
              <p>
                Os valores originais do pedido são preservados. A reserva da
                Cosmic não reserva a conta no fornecedor.
              </p>
            </div>
          </details>
          <details className="mt-4 text-xs leading-6 text-zinc-400">
            <summary className="cursor-pointer font-bold text-zinc-300">
              Regras operacionais do fornecedor
            </summary>
            <div className="mt-3 space-y-2">
              <p>
                Texto informado pelo lojista, atualizado em 04/03/2026: o
                fornecedor exige vídeo completo da compra até o primeiro login,
                login imediato e report em até 10 minutos da compra externa.
              </p>
              <p>
                Casos indicados: conta sem Robux, saldo já gasto e senha
                inválida. Segundo o texto informado, ausência de vídeo, demora
                no login ou report após 10 minutos não são aceitos pelo
                fornecedor.
              </p>
              <p>
                Ao comprar, preserve o vídeo e o Order ID original do
                fornecedor. Confira o prazo antes de liberar a entrega. O prazo
                externo pode começar antes do acesso do cliente; essas regras
                não substituem os direitos do consumidor perante a Cosmic.
              </p>
            </div>
          </details>
        </div>
        <div className="min-w-0 rounded-xl border border-white/10 p-4 sm:p-5">
          <h3 className="font-bold">Dados da conta para entrega</h3>
          {!paid ? (
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Os campos de usuário e senha serão liberados após a confirmação do
              pagamento.
            </p>
          ) : !a.acquired_at ? (
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Registre a aquisição manual da conta para preencher os dados que
              serão entregues ao cliente.
            </p>
          ) : deliveryError ? (
            <p className="admin-error mt-4">{deliveryError}</p>
          ) : !accountDeliveryConfigured() ? (
            <p className="admin-error mt-4">
              Configure ROBUX_ACCOUNT_DELIVERY_KEY na Vercel para salvar os
              dados com segurança. Consulte o guia desta atualização.
            </p>
          ) : (
            <AccountDeliveryForm
              orderId={orderId}
              initial={delivery}
              delivered={status === "delivered"}
            />
          )}
        </div>
      </div>
      <details className="border-t border-white/10 px-5 py-4 text-sm sm:px-6">
        <summary className="cursor-pointer text-zinc-400">
          Política apresentada ao cliente
        </summary>
        {acceptance ? (
          <div className="mt-3">
            <p className="text-xs text-zinc-500">
              Leitura confirmada em {localDate(acceptance.accepted_at)} · versão{" "}
              {acceptance.policy_version}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-zinc-400">
              {acceptance.policy_body}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            Este pedido não tem um registro de leitura da política. Pedidos
            anteriores à atualização mantêm o histórico original.
          </p>
        )}
      </details>
    </section>
  );
}
