"use client";

import { useActionState } from "react";
import PendingButton from "../components/PendingButton";
import { updateOrderStatus, type OrderStatusFormState } from "./actions";

export default function OrderStatusActions({
  orderId,
  status,
  buttons,
  total,
  hasProof,
}: {
  orderId: string;
  status: string;
  buttons: string[][];
  total: number;
  hasProof: boolean;
}) {
  const [state, action, pending] = useActionState<OrderStatusFormState, FormData>(
    updateOrderStatus,
    { error: null },
  );

  return (
    <div data-live-busy={pending}>
      <div className="mt-4 flex flex-wrap gap-2">
        {buttons
          .filter(([value]) => !["proof_rejected", "paid"].includes(value))
          .map(([value, label]) => (
            <form key={value} action={action}>
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="expected_status" value={status} />
              <input type="hidden" name="status" value={value} />
              <PendingButton
                disabled={pending}
                confirm={value === "cancelled"
                  ? "Cancelar este pedido e liberar o estoque? Isso NÃO devolve o Pix. Se houve pagamento, registre a devolução separadamente após realizá-la no banco."
                  : value === "paid"
                    ? "Confirme somente se o Pix foi realmente recebido na conta da Cosmic. Isso também funciona sem comprovante anexado. Prosseguir?"
                    : undefined}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold ${value === "paid" || value === "delivered" ? "bg-emerald-600" : value === "preparing_delivery" ? "bg-violet-600" : "bg-red-600"}`}
              >
                {label}
              </PendingButton>
            </form>
          ))}
      </div>
      {buttons.some(([value]) => value === "paid") && (
        <form action={action} className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="expected_status" value={status} />
          <input type="hidden" name="status" value="paid" />
          <h3 className="font-bold text-emerald-200">Conferência manual do Pix</h3>
          <p className="mt-2 text-sm text-zinc-300">O comprovante é apenas um anexo. Confirme o crédito no extrato, o destinatário e o valor antes de continuar.</p>
          <label className="mt-4 block text-sm">Valor recebido no banco (R$)
            <input name="received_amount" required type="number" step="0.01" min="0.01" placeholder={total.toFixed(2)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-[#080812] p-3" />
          </label>
          <label className="mt-3 block text-sm">Identificador da transação no extrato (EndToEnd ou referência bancária)
            <input name="bank_reference" required minLength={8} maxLength={80} pattern="[A-Za-z0-9-]{8,80}" autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-[#080812] p-3" />
          </label>
          {!hasProof && <label className="mt-3 block text-sm">Motivo da confirmação excepcional sem anexo
            <textarea name="exception_reason" required minLength={5} maxLength={300} className="mt-1 w-full rounded-xl border border-white/10 bg-[#080812] p-3" />
          </label>}
          <label className="mt-4 flex items-start gap-3 text-sm"><input name="bank_verified" type="checkbox" required className="mt-1" />Conferi diretamente no extrato bancário o recebimento deste Pix para este pedido.</label>
          <PendingButton disabled={pending} confirm="Confirmar o recebimento conferido no banco?" className="mt-4 min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold">Confirmar pagamento</PendingButton>
        </form>
      )}
      {buttons.some(([value]) => value === "proof_rejected") && (
        <form action={action} className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="expected_status" value={status} />
          <input type="hidden" name="status" value="proof_rejected" />
          <label htmlFor="rejection_reason" className="text-sm font-bold text-red-200">
            Motivo da recusa
          </label>
          <textarea
            id="rejection_reason"
            name="rejection_reason"
            required
            minLength={5}
            maxLength={300}
            placeholder="Ex.: imagem ilegível ou valor diferente."
            className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-[#080812] p-3 text-base outline-none focus:border-red-400"
          />
          <PendingButton disabled={pending} className="mt-3 min-h-11 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold">
            Recusar comprovante
          </PendingButton>
        </form>
      )}
      {state.error && (
        <p role="alert" className="admin-error mt-4">{state.error}</p>
      )}
      {state.success && (
        <p role="status" className="mt-4 text-sm text-emerald-300">{state.success}</p>
      )}
    </div>
  );
}
