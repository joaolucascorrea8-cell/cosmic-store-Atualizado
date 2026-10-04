"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestGameServer, type ServerRequestState } from "../actions";
const draftKey = "cosmic-server-request-draft-v1";
export default function ServerRequestForm({
  userId,
  games,
}: {
  userId: string;
  games: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ServerRequestState, FormData>(
    requestGameServer,
    { error: null },
  );
  const [id, setId] = useState("");
  const [game, setGame] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const key = `${draftKey}-${userId}`;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
        setId(typeof saved?.id === "string" ? saved.id : crypto.randomUUID());
        setGame(
          typeof saved?.game === "string" ? saved.game.slice(0, 100) : "",
        );
        setMessage(
          typeof saved?.message === "string"
            ? saved.message.slice(0, 1200)
            : "",
        );
      } catch {
        setId(crypto.randomUUID());
      }
      setLoaded(true);
    });
  }, [key]);
  useEffect(() => {
    if (!loaded || state.destination) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ id, game, message }));
    } catch {}
  }, [loaded, id, game, message, key, state.destination]);
  useEffect(() => {
    if (!state.destination) return;
    try {
      sessionStorage.removeItem(key);
    } catch {}
    router.push(state.destination);
    router.refresh();
  }, [state.destination, router, key]);
  return (
    <form
      action={action}
      data-live-dirty={Boolean(game || message)}
      data-live-busy={pending}
      className="space-y-5"
    >
      <input type="hidden" name="request_id" value={id} />
      <div>
        <label htmlFor="server-game" className="admin-label">
          Nome do jogo
        </label>
        <input
          id="server-game"
          name="game_name"
          list="server-game-suggestions"
          value={game}
          onChange={(e) => setGame(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          className="admin-input"
          placeholder="Ex.: Blox Fruits, Brookhaven ou outro jogo"
          autoComplete="off"
        />
        <datalist id="server-game-suggestions">
          {games.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Pode escrever qualquer jogo, mesmo que ele ainda não esteja no
          catálogo.
        </p>
      </div>
      <div>
        <label htmlFor="server-message" className="admin-label">
          Como você gostaria do servidor?
        </label>
        <textarea
          id="server-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={5}
          maxLength={1200}
          rows={5}
          className="admin-input"
          placeholder="Conte para que você quer o servidor VIP e se há algum detalhe importante."
        />
        <p className="mt-1 text-right text-xs text-zinc-500">
          {message.length}/1200
        </p>
      </div>
      <p className="rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm leading-6 text-zinc-400">
        A equipe vai analisar a disponibilidade e responder pelo suporte. O
        envio deste pedido não gera uma compra nem garante a criação de um
        servidor.
      </p>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      <button
        disabled={pending || !id || Boolean(state.destination)}
        className="btn-primary w-full"
      >
        {pending ? "Enviando pedido…" : "Pedir servidor"}
      </button>
    </form>
  );
}
