export const orderStatus: Record<string, { label: string; className: string }> = {
  awaiting_payment: { label: "Aguardando pagamento", className: "text-amber-300 bg-amber-500/10" },
  proof_submitted: { label: "Comprovante enviado", className: "text-sky-300 bg-sky-500/10" },
  under_review: { label: "Em análise", className: "text-sky-300 bg-sky-500/10" },
  paid: { label: "Pago", className: "text-emerald-300 bg-emerald-500/10" },
  preparing_delivery: { label: "Preparando entrega", className: "text-violet-300 bg-violet-500/10" },
  delivered: { label: "Entregue", className: "text-emerald-300 bg-emerald-500/10" },
  cancelled: { label: "Cancelado", className: "text-red-300 bg-red-500/10" },
  proof_rejected: { label: "Comprovante recusado", className: "text-red-300 bg-red-500/10" },
};

