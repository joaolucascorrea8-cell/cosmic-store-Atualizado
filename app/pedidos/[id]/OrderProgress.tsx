type OrderProgressProps = {
  status: string;
};

const steps = [
  { title: "Pedido criado", detail: "Pedido registrado" },
  { title: "Comprovante", detail: "Envio e análise do Pix" },
  { title: "Pagamento", detail: "Pagamento confirmado" },
  { title: "Entrega", detail: "Equipe preparando" },
  { title: "Concluído", detail: "Item entregue" },
];

const statusIndex: Record<string, number> = {
  awaiting_payment: 0,
  proof_submitted: 1,
  under_review: 1,
  proof_rejected: 1,
  paid: 2,
  preparing_delivery: 3,
  delivered: 4,
};

export default function OrderProgress({ status }: OrderProgressProps) {
  const cancelled = status === "cancelled";
  const currentIndex = statusIndex[status] ?? 0;
  const rejected = status === "proof_rejected";

  return (
    <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5" aria-label="Andamento do pedido">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Andamento</p>
          <h2 className="mt-1 font-black">Acompanhe cada etapa do seu pedido</h2>
        </div>
        {cancelled && <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">Pedido cancelado</span>}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const issue = rejected && index === 1;
          const done = !cancelled && !issue && index < currentIndex;
          const current = !cancelled && !issue && index === currentIndex;
          const className = issue
            ? "border-red-500/30 bg-red-500/10 text-red-100"
            : done
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
              : current
                ? "border-violet-400/35 bg-violet-500/15 text-white"
                : "border-white/[.07] bg-black/10 text-zinc-500";

          return (
            <li key={step.title} className={`rounded-xl border p-3 ${className}`}>
              <div className="flex items-center gap-2 sm:block">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${issue ? "bg-red-500 text-white" : done ? "bg-emerald-500 text-white" : current ? "bg-violet-500 text-white" : "bg-white/5 text-zinc-500"}`}>
                  {issue ? "!" : done ? "✓" : index + 1}
                </span>
                <div className="min-w-0 sm:mt-2">
                  <strong className="block text-xs">{step.title}</strong>
                  <span className="mt-0.5 block text-[10px] leading-4 opacity-70">{issue ? "Envie um novo comprovante" : step.detail}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!cancelled && status === "awaiting_payment" && <p className="mt-4 text-xs leading-5 text-zinc-400">Faça o Pix e envie o comprovante para a equipe começar a análise.</p>}
      {!cancelled && ["proof_submitted", "under_review"].includes(status) && <p className="mt-4 text-xs leading-5 text-sky-200">Seu comprovante já chegou. A equipe está conferindo o pagamento.</p>}
      {!cancelled && ["paid", "preparing_delivery"].includes(status) && <p className="mt-4 text-xs leading-5 text-emerald-200">Pagamento confirmado. Use o chat do pedido para acompanhar a entrega.</p>}
      {!cancelled && status === "delivered" && <p className="mt-4 text-xs leading-5 text-emerald-200">Entrega concluída. Se quiser, deixe sua avaliação logo abaixo.</p>}
    </section>
  );
}
