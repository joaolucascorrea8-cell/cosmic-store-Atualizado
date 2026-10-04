"use client";
import { useActionState, useState, useEffect } from "react";
import { saveAutoClose } from "./auto-actions";
export type AutoSettings = {
  auto_close_enabled: boolean;
  auto_close_hours: number;
  updated_at: string;
  enabled_at: string | null;
  last_run_at: string | null;
  last_run_count: number | null;
};
export default function AutoCloseForm({
  settings,
}: {
  settings: AutoSettings;
}) {
  const [state, action, pending] = useActionState(saveAutoClose, {}),
    [dirty, setDirty] = useState(false),
    [enabled, setEnabled] = useState(settings.auto_close_enabled);
  useEffect(() => {
    if (state.success) queueMicrotask(() => setDirty(false));
  }, [state]);
  return (
    <details className="admin-panel mt-5">
      <summary className="cursor-pointer font-bold">
        Pedidos sem comprovante ·{" "}
        {settings.auto_close_enabled
          ? "Automação ligada"
          : "Automação desligada"}
      </summary>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Encerra apenas pedidos aguardando pagamento, sem comprovante, pagamento
        confirmado ou atividade recente. Pedidos em análise, recusados ou em
        entrega ficam preservados. O cliente pode pedir ajuda no suporte se já
        tiver feito o Pix.
      </p>
      <form
        action={action}
        onChange={() => setDirty(true)}
        data-live-dirty={dirty}
        data-live-busy={pending}
        className="mt-5 space-y-4 max-w-xl"
        onSubmit={(e) => {
          if (
            enabled &&
            !confirm(
              "Habilitar o encerramento automático após o prazo escolhido? Pedidos sem comprovante podem ser encerrados pela rotina diária.",
            )
          )
            e.preventDefault();
        }}
      >
        <input type="hidden" name="expected" value={settings.updated_at} />
        <label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1 accent-violet-500"
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Ativar encerramento automático
        </label>
        <label className="admin-label block">
          Horas sem atividade
          <input
            type="number"
            name="hours"
            className="admin-input mt-2"
            min={24}
            max={720}
            defaultValue={settings.auto_close_hours}
            required
          />
        </label>
        <p className="text-xs leading-5 text-zinc-400">
          De 24 a 720 horas. Ao habilitar ou mudar o prazo, começa uma nova
          carência para todos os pedidos. A rotina existente da Vercel roda
          diariamente: o encerramento pode ocorrer até 24 horas depois do prazo,
          se o cron estiver configurado.
        </p>
        <p className="text-xs text-amber-200/80">
          Isso organiza o pedido; não invalida a chave ou o código Pix.
        </p>
        {state.error && (
          <p role="alert" className="admin-error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-300">
            {state.success}
          </p>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar automação"}
        </button>
      </form>
    </details>
  );
}
