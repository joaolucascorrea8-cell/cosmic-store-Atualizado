"use client";
import { useEffect, useState } from "react";
import { allRows } from "@/lib/query-pages";
import { createClient } from "@/lib/supabase/client";
type Reply = {
  id: string;
  label: string;
  body: string;
  game_id: string | null;
  games: { name: string } | { name: string }[] | null;
};
export default function QuickReplies({
  scope,
  onChoose,
  disabled,
}: {
  scope: "order" | "support";
  onChoose: (value: string) => void;
  disabled?: boolean;
}) {
  const [replies, setReplies] = useState<Reply[]>([]),
    [game, setGame] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    const client = createClient();
    let live = true,
      loading = false;
    async function load() {
      if (loading || !live) return;
      loading = true;
      const r = await allRows(
        client
          .from("admin_quick_replies")
          .select("id,label,body,game_id,games(name)")
          .eq("scope", scope)
          .eq("is_active", true)
          .order("display_order")
          .order("label")
          .order("id"),
      );
      loading = false;
      if (live) {
        setReplies((r.data ?? []) as Reply[]);
        setError(Boolean(r.error));
      }
    }
    void load();
    window.addEventListener("focus", load);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [scope]);
  const games = new Map<string, string>();
  for (const r of replies) {
    const g = Array.isArray(r.games) ? r.games[0] : r.games;
    if (r.game_id && g) games.set(r.game_id, g.name);
  }
  if (error)
    return (
      <p className="mb-3 text-xs text-zinc-400">
        Respostas rápidas indisponíveis. Você pode escrever normalmente.
      </p>
    );
  if (!replies.length) return null;
  return (
    <div className="mb-3">
      <p className="mb-2 text-[11px] text-zinc-500">
        Respostas rápidas · escolha, revise e envie
      </p>
      {games.size > 0 && (
        <label className="mb-2 block text-xs text-zinc-400">
          Jogo das respostas
          <select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="admin-input mt-1"
          >
            <option value="">Respostas gerais</option>
            {[...games].map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {replies
          .filter((r) => !r.game_id || r.game_id === game)
          .map((r) => (
            <button
              type="button"
              disabled={disabled}
              key={r.id}
              className="admin-small-button"
              onClick={() => onChoose(r.body)}
            >
              {r.label}
            </button>
          ))}
      </div>
    </div>
  );
}
