"use client";
import { useActionState } from "react";
import { saveAccountPolicy, type AccountFormState } from "./actions";
export default function AccountPolicyForm({
  body,
  version,
}: {
  body: string;
  version: string;
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    saveAccountPolicy,
    { error: null },
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="version" value={version} />
      <label className="block text-sm text-zinc-300">
        Texto público da política
        <textarea
          name="body"
          defaultValue={body}
          required
          minLength={100}
          maxLength={12000}
          rows={12}
          className="admin-input mt-2 leading-6"
        />
      </label>
      <p className="text-xs leading-5 text-zinc-500">
        Uma alteração gera uma nova versão. O pedido preserva o texto lido pelo
        cliente. Mantenha os direitos legais de reembolso; o prazo operacional
        do fornecedor não substitui os direitos do consumidor.
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
      <button disabled={pending} className="btn-primary">
        {pending ? "Salvando…" : "Salvar política"}
      </button>
    </form>
  );
}
