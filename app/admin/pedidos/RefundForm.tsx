"use client";

import { useActionState } from "react";
import { recordOrderRefund, type OrderStatusFormState } from "./actions";
import PendingButton from "../components/PendingButton";

export default function RefundForm({ orderId, token, remaining }: { orderId: string; token: string; remaining: number }) {
  const [state, action, pending] = useActionState<OrderStatusFormState, FormData>(recordOrderRefund, { error: null });
  return <form action={action} className="mt-4 space-y-3" data-live-busy={pending}>
    <input type="hidden" name="order_id" value={orderId} />
    <input type="hidden" name="refund_token" value={token} />
    <p className="text-sm text-zinc-300">Este formulário apenas registra uma devolução já realizada no banco. Não transfere dinheiro nem altera o status do pedido.</p>
    <label className="block text-sm">Valor devolvido (R$)<input name="amount" type="number" min="0.01" step="0.01" max={remaining.toFixed(2)} required className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-[#080812] p-3" /></label>
    <label className="block text-sm">Referência bancária da devolução<input name="bank_reference" minLength={8} maxLength={80} pattern="[A-Za-z0-9-]{8,80}" required autoComplete="off" className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-[#080812] p-3" /></label>
    <label className="block text-sm">Motivo<textarea name="reason" minLength={5} maxLength={300} required className="mt-1 block w-full rounded-xl border border-white/10 bg-[#080812] p-3" /></label>
    <label className="flex items-start gap-3 text-sm"><input name="bank_verified" type="checkbox" required className="mt-1" />Conferi que a devolução foi realizada no banco.</label>
    <PendingButton disabled={pending} className="min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold">Registrar devolução realizada</PendingButton>
    {state.error && <p role="alert" className="admin-error">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-300">{state.success}</p>}
  </form>;
}
