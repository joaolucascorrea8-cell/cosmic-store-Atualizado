"use client";

import { useActionState } from "react";
import { recordAdditionalPayment, recordOrderRefund, type OrderStatusFormState } from "./actions";
import PendingButton from "../components/PendingButton";

export default function RefundForm({ orderId, token, remaining, receipt = false }: { orderId: string; token: string; remaining: number; receipt?: boolean }) {
  const [state, action, pending] = useActionState<OrderStatusFormState, FormData>(receipt ? recordAdditionalPayment : recordOrderRefund, { error: null });
  return <form action={action} className="mt-4 space-y-3" data-live-busy={pending}>
    <input type="hidden" name="order_id" value={orderId} />
    <input type="hidden" name="operation_token" value={token} />
    <p className="text-sm text-zinc-300">{receipt ? "Registre um Pix tardio, repetido ou divergente já conferido no extrato. Isso não confirma a compra nem reabre pedidos cancelados. Não registre novamente o Pix principal já confirmado." : "Este formulário apenas registra uma devolução já realizada no banco. Não transfere dinheiro nem altera o status do pedido."}</p>
    <label className="block text-sm">{receipt ? "Valor recebido (R$)" : "Valor devolvido (R$)"}<input name="amount" type="number" min="0.01" step="0.01" max={receipt ? undefined : remaining.toFixed(2)} required className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-[#080812] p-3" /></label>
    <label className="block text-sm">{receipt ? "Referência bancária do recebimento" : "Referência bancária da devolução"}<input name="bank_reference" minLength={8} maxLength={80} pattern="[A-Za-z0-9-]{8,80}" required autoComplete="off" className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-[#080812] p-3" /></label>
    <label className="block text-sm">Motivo<textarea name="reason" minLength={5} maxLength={300} required className="mt-1 block w-full rounded-xl border border-white/10 bg-[#080812] p-3" /></label>
    <label className="flex items-start gap-3 text-sm"><input name="bank_verified" type="checkbox" required className="mt-1" />{receipt ? "Conferi este recebimento diretamente no extrato bancário." : "Conferi que a devolução foi realizada no banco."}</label>
    <PendingButton disabled={pending} className="min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold">{receipt ? "Registrar recebimento excepcional" : "Registrar devolução realizada"}</PendingButton>
    {state.error && <p role="alert" className="admin-error">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-300">{state.success}</p>}
  </form>;
}
