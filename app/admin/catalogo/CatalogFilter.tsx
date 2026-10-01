"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { normalizeSearch } from "@/lib/catalog";
export default function CatalogFilter({
  children,
  games,
  scope,
}: {
  children: ReactNode;
  games?: Array<{ id: string; name: string }>;
  scope: string;
}) {
  const [query, setQuery] = useState(""),
    [game, setGame] = useState(""),
    [loaded, setLoaded] = useState(false);
  const key = `cosmic-catalog-filter-${scope}`;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (value) {
          setQuery(typeof value.query === "string" ? value.query : "");
          setGame(typeof value.game === "string" ? value.game : "");
        }
      } catch {}
      setLoaded(true);
    });
  }, [key]);
  useEffect(() => {
    if (loaded)
      try {
        sessionStorage.setItem(key, JSON.stringify({ query, game }));
      } catch {}
  }, [query, game, key, loaded]);
  const visible = Children.toArray(children).filter(
    (child) =>
      isValidElement<{ "data-name"?: string; "data-game"?: string }>(child) &&
      normalizeSearch(child.props["data-name"] ?? "").includes(
        normalizeSearch(query),
      ) &&
      (!game || child.props["data-game"] === game),
  );
  return (
    <div className="mt-5">
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input
          aria-label={`Buscar ${scope}`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome…"
          className="admin-input"
        />
        {games && (
          <select
            aria-label="Filtrar categorias por jogo"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="admin-input"
          >
            <option value="">Todos os jogos</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
        {visible.length ? (
          visible
        ) : (
          <p className="admin-empty">Nenhum resultado com esses filtros.</p>
        )}
      </div>
    </div>
  );
}
