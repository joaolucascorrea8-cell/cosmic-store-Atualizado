"use client";

import { useActionState } from "react";
import { saveRobuxSettings } from "./actions";
import type { RobuxSettings } from "@/lib/robux-settings";

export default function RobuxSettingsForm({ settings }: { settings: RobuxSettings }) {
  const [state, action, pending] = useActionState(saveRobuxSettings, {});
  return (
    <form action={action} className="admin-panel mt-6 max-w-4xl space-y-6" data-live-busy={pending}>
      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1" />
        <span>
          <strong className="block">Vendas de Robux ativas</strong>
          <span className="mt-1 block text-xs leading-5 text-zinc-500">Desative para pausar novas compras sem remover a página.</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">K mínimo da Cosmic
          <input name="min_cosmic_k" type="number" step="0.01" min="0.01" required defaultValue={settings.minCosmicK} className="admin-input mt-2" />
          <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500">Mesmo que o fornecedor fique barato, a loja não vende abaixo deste K.</span>
        </label>
        <label className="text-sm font-bold">Margem adicionada ao K do fornecedor
          <input name="margin_per_thousand" type="number" step="0.01" min="0" required defaultValue={settings.marginPerThousand} className="admin-input mt-2" />
          <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500">Ex.: fornecedor K25 + margem 9 = K34.</span>
        </label>
        <label className="text-sm font-bold">K máximo aceito do fornecedor
          <input name="max_supplier_k" type="number" step="0.01" min="0.01" required defaultValue={settings.maxSupplierK} className="admin-input mt-2" />
          <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500">Acima disso, novas compras ficam pausadas automaticamente.</span>
        </label>
        <label className="text-sm font-bold">Margem mínima antes de executar
          <input name="min_margin_per_thousand" type="number" step="0.01" min="0" required defaultValue={settings.minMarginPerThousand} className="admin-input mt-2" />
          <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500">Se o K subir depois do Pix, a Cosmic bloqueia a compra antes de dar prejuízo.</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Prazo mínimo informado (dias)
          <input name="pending_days_min" type="number" min="1" max="30" required defaultValue={settings.pendingDaysMin} className="admin-input mt-2" />
        </label>
        <label className="text-sm font-bold">Prazo máximo informado (dias)
          <input name="pending_days_max" type="number" min="1" max="30" required defaultValue={settings.pendingDaysMax} className="admin-input mt-2" />
        </label>
      </div>

      <label className="text-sm font-bold">Link do vídeo: como criar GamePass
        <input name="tutorial_url" type="url" maxLength={500} defaultValue={settings.tutorialUrl} className="admin-input mt-2" placeholder="https://www.youtube.com/watch?v=..." />
        <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500">Quando preenchido, o botão “Assistir tutorial em vídeo” aparece na página Robux.</span>
      </label>

      {state.error && <p role="alert" className="admin-error">{state.error}</p>}
      {state.success && <p role="status" className="admin-notice">{state.success}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Salvando…" : "Salvar configurações"}</button>
    </form>
  );
}
