"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveWork, type WorkState } from "../atendimento/equipe/actions";
export default function WorkForm({
  id,
  kind,
  assigned,
  expected,
  actor,
  staff,
}: {
  id: string;
  kind: "order" | "support";
  assigned: string;
  expected: string;
  actor: string;
  staff: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveWork, {} as WorkState),
    [selection, setSelection] = useState(assigned),
    note = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state.success && note.current) note.current.value = "";
  }, [state]);
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="entity_id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="expected" value={expected} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="admin-label">
          Responsável (opcional)
          <select
            name="assigned"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            className="admin-input mt-2"
          >
            <option value="">Sem responsável</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-small-button"
          onClick={() => setSelection(actor)}
        >
          Selecionar meu nome
        </button>
      </div>
      <label className="admin-label block">
        Nova anotação privada
        <textarea
          ref={note}
          name="note"
          rows={3}
          maxLength={2000}
          className="admin-input mt-2"
          placeholder="Ex.: cliente estará no jogo às 20h."
        />
      </label>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="admin-success">
          {state.success}
        </p>
      )}
      <button disabled={pending} className="btn-secondary">
        {pending ? "Salvando…" : "Salvar organização interna"}
      </button>
    </form>
  );
}
