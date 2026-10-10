"use client";

import { useActionState } from "react";
import PendingButton from "../components/PendingButton";
import { updateOrderStatus, type OrderStatusFormState } from "./actions";

export default function OrderStatusActions({
  orderId,
  status,
  buttons,
}: {
  orderId: string;
  status: string;
  buttons: string[][];
}) {
  const [state, action, pending] = useActionState<OrderStatusFormState, FormData>(
    updateOrderStatus,
    { error: null },
  );

  return (
    <div data-live-busy={pending}>
      <div className="mt-4 flex flex-wrap gap-2">
        {buttons
          .filter(([value]) => value !== "proof_rejected")
          .map(([value, label]) => (
            <form key={value} action={action}>
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="expected_status" value={status} />
              <input type="hidden" name="status" value={value} />
              <PendingButton
                disabled={pending}
                confirm={value === "cancelled"
                  ? "Cancelar este pedido? O estoque baixado será devolvido."
                  : undefined}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold ${value === "paid" || value === "delivered" ? "bg-emerald-600" : value === "preparing_delivery" ? "bg-violet-600" : "bg-red-600"}`}
              >
                {label}
              </PendingButton>
            </form>
          ))}
      </div>
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
