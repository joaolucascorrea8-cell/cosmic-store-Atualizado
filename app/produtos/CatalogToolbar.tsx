"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/app/components/Icon";
type Game = { id: string; name: string; slug: string };
type Category = { id: string; name: string; game_id: string | null };
export type CatalogParams = {
  q?: string;
  jogo?: string;
  categoria?: string;
  ordem?: string;
  estoque?: string;
  pagina?: string;
};
export default function CatalogToolbar({
  games,
  categories,
  params,
  scoped = false,
}: {
  games: Game[];
  categories: Category[];
  params: CatalogParams;
  scoped?: boolean;
}) {
  const router = useRouter(),
    pathname = usePathname();
  const [query, setQuery] = useState(params.q ?? ""),
    [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    queueMicrotask(() => setQuery(params.q ?? ""));
  }, [params.q]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const game = games.find((g) => g.slug === params.jogo),
    visibleCategories = categories.filter(
      (c) => !game || c.game_id === game.id,
    );
  function update(next: Record<string, string>) {
    if (timer.current) clearTimeout(timer.current);
    const search = new URLSearchParams(window.location.search);
    search.delete("pagina");
    Object.entries(next).forEach(([key, value]) =>
      value ? search.set(key, value) : search.delete(key),
    );
    startTransition(() =>
      router.replace(`${pathname}${search.size ? `?${search}` : ""}`, {
        scroll: false,
      }),
    );
  }
  const changed = Boolean(
    params.q ||
    params.jogo ||
    params.categoria ||
    params.ordem ||
    params.estoque,
  );
  return (
    <section aria-label="Busca e filtros" className="catalog-toolbar mb-6">
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label htmlFor="catalog-search" className="admin-label">
            Buscar por nome
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-zinc-500"
            />
            <input
              id="catalog-search"
              type="search"
              className="admin-input pl-10"
              placeholder="Busque seu próximo item…"
              value={query}
              maxLength={100}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(
                  () => update({ q: value.trim() }),
                  250,
                );
              }}
            />
          </div>
        </div>
        <div>
          <label htmlFor="catalog-order" className="admin-label">
            Ordenar
          </label>
          <select
            id="catalog-order"
            className="admin-input"
            value={params.ordem ?? ""}
            onChange={(e) => update({ ordem: e.target.value, q: query.trim() })}
          >
            <option value="">Ordem da loja</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="nome">Nome A → Z</option>
            <option value="nome-desc">Nome Z → A</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {!scoped && (
          <>
            <div className="min-w-0 flex-1 basis-40">
              <label htmlFor="catalog-game" className="admin-label">
                Jogo
              </label>
              <select
                id="catalog-game"
                className="admin-input"
                value={params.jogo ?? ""}
                onChange={(e) =>
                  update({
                    jogo: e.target.value,
                    categoria: "",
                    q: query.trim(),
                  })
                }
              >
                <option value="">Todos os jogos</option>
                {games.map((game) => (
                  <option key={game.id} value={game.slug}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 basis-48">
              <label htmlFor="catalog-category" className="admin-label">
                Categoria
              </label>
              <select
                id="catalog-category"
                className="admin-input"
                value={params.categoria ?? ""}
                onChange={(e) =>
                  update({ categoria: e.target.value, q: query.trim() })
                }
              >
                <option value="">Todas as categorias</option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {game
                      ? category.name
                      : `${games.find((game) => game.id === category.game_id)?.name ?? ""} · ${category.name}`}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <label className="flex min-h-11 items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={params.estoque === "1"}
            onChange={(e) =>
              update({ estoque: e.target.checked ? "1" : "", q: query.trim() })
            }
          />{" "}
          Somente disponíveis
        </label>
        {changed && (
          <button
            type="button"
            className="admin-small-button min-h-11"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setQuery("");
              startTransition(() =>
                router.replace(pathname, { scroll: false }),
              );
            }}
          >
            Limpar filtros
          </button>
        )}
        <span role="status" className="ml-auto text-xs text-zinc-400">
          {pending ? "Atualizando…" : ""}
        </span>
      </div>
    </section>
  );
}
