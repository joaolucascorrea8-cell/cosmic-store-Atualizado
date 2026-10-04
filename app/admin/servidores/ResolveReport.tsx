"use client";
import { useActionState } from "react";
import { resolveServerReport } from "./actions";
export default function ResolveReport({ id }: { id: string }) {
  const [state, action, busy] = useActionState(resolveServerReport, {
    error: null,
  });
  return (
    <form action={action} data-live-busy={busy}>
      <input type="hidden" name="id" value={id} />
      <button disabled={busy} className="admin-small-button">
        {busy ? "Salvando…" : "Marcar como resolvido"}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
