"use client";
import { useActionState } from "react";
import { saveReply, type WorkState } from "./actions";
export type Reply = {
  id: string;
  scope: string;
  label: string;
  body: string;
  game_id: string | null;
  is_active: boolean;
  updated_at: string;
};
export default function ReplyForm({
  reply,
  games,
}: {
  reply?: Reply;
  games: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveReply, {} as WorkState);
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={reply?.id ?? ""} />
      <input type="hidden" name="expected" value={reply?.updated_at ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="admin-label">
          Nome da resposta
          <input
            name="label"
            required
            minLength={2}
            maxLength={40}
            className="admin-input mt-2"
            defaultValue={reply?.label}
          />
        </label>
        <label className="admin-label">
          Tipo de conversa
          <select
            name="scope"
            defaultValue={reply?.scope ?? "order"}
            className="admin-input mt-2"
          >
            <option value="order">Pedidos</option>
            <option value="support">Suporte</option>
          </select>
        </label>
      </div>
      <label className="admin-label block">
        Jogo (opcional)
        <select
          name="game_id"
          defaultValue={reply?.game_id ?? ""}
          className="admin-input mt-2"
        >
          <option value="">Todos os jogos</option>
          {games.map((g) => (
            <option value={g.id} key={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-label block">
        Texto
        <textarea
          name="body"
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          defaultValue={reply?.body}
          className="admin-input mt-2"
        />
      </label>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={reply?.is_active ?? true}
        />
        Disponível nas conversas
      </label>
      {state.error && (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="admin-success" role="status">
          {state.success}
        </p>
      )}
      <button className="btn-secondary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar resposta"}
      </button>
    </form>
  );
}
