"use client";
import { useActionState, useEffect, useState } from "react";
import { saveServiceSettings } from "./actions";
import { dayNames, type ServiceSettings } from "@/lib/store-service";
export default function ServiceForm({
  settings,
}: {
  settings: ServiceSettings;
}) {
  const [state, action, pending] = useActionState(saveServiceSettings, {});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.success) queueMicrotask(() => setDirty(false));
  }, [state]);
  return (
    <form
      action={action}
      onChange={() => setDirty(true)}
      data-live-dirty={dirty}
      data-live-busy={pending}
      className="admin-panel mt-6 max-w-3xl space-y-6"
    >
      <input
        type="hidden"
        name="updated_at"
        value={settings.updated_at ?? ""}
      />
      <div>
        <label className="admin-label" htmlFor="delivery-hours">
          Prazo padrão da loja, em horas
        </label>
        <input
          id="delivery-hours"
          name="delivery_hours"
          type="number"
          min={1}
          max={720}
          required
          defaultValue={settings.delivery_hours}
          className="admin-input"
        />
        <p className="mt-2 text-xs leading-6 text-zinc-500">
          Horas corridas após confirmar o pagamento. Você pode definir outro
          prazo por jogo ou produto. Em compras com vários itens, vale o maior
          prazo. O horário de atendimento abaixo não pausa essa contagem.
        </p>
      </div>
      <div>
        <label className="flex items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            name="schedule_enabled"
            defaultChecked={settings.schedule_enabled}
          />
          Mostrar horário de atendimento na loja
        </label>
        <p className="mt-2 text-xs text-zinc-500">
          Horário de Brasília. As compras continuam disponíveis fora desse
          período.
        </p>
      </div>
      <div className="space-y-3">
        {settings.schedule.map((day) => (
          <div
            key={day.day}
            className="grid items-center gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_130px_130px]"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`day_${day.day}`}
                defaultChecked={day.enabled}
              />
              {dayNames[day.day]}
            </label>
            <label className="text-xs text-zinc-400">
              Início
              <input
                type="time"
                name={`start_${day.day}`}
                required
                defaultValue={day.start}
                className="admin-input mt-1"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Fim
              <input
                type="time"
                name={`end_${day.day}`}
                required
                defaultValue={day.end}
                className="admin-input mt-1"
              />
            </label>
          </div>
        ))}
      </div>
      <div>
        <label className="admin-label" htmlFor="service-notice">
          Aviso para os clientes (opcional)
        </label>
        <textarea
          id="service-notice"
          name="notice"
          rows={3}
          maxLength={300}
          defaultValue={settings.notice}
          className="admin-input"
          placeholder="Ex.: Neste feriado, responderemos a partir das 14h."
        />
      </div>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="admin-notice">
          {state.success}
        </p>
      )}
      <button disabled={pending} className="btn-primary">
        {pending ? "Salvando…" : "Salvar atendimento"}
      </button>
    </form>
  );
}
