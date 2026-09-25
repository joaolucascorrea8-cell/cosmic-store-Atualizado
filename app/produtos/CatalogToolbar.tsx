"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Game = { id: string; name: string; slug: string };
type Category = { id: string; name: string; game_id: string | null };
type Params = { q?: string; jogo?: string; categoria?: string; ordem?: string };

export default function CatalogToolbar({ games, categories, params }: { games: Game[]; categories: Category[]; params: Params }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(params.q ?? "");
  const first = useRef(true);
  const selectedGame = games.find((game) => game.slug === params.jogo);
  const visibleCategories = useMemo(() => categories.filter((category) => !selectedGame || category.game_id === selectedGame.id), [categories, selectedGame]);
  const hasFilters = Boolean(params.q || params.jogo || params.categoria || params.ordem);

  const update = useCallback((next: Record<string, string | null | undefined>) => {
    const search = new URLSearchParams(window.location.search);
    Object.entries(next).forEach(([key, value]) => {
      if (value) search.set(key, value);
      else search.delete(key);
    });
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const timer = window.setTimeout(() => update({ q: query.trim() || null }), 180);
    return () => window.clearTimeout(timer);
  }, [query, update]);

  return <section className="mb-6 rounded-2xl border border-white/10 bg-[#131017] p-3 sm:p-4">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
      <div>
        <label className="sr-only" htmlFor="catalog-search">Buscar produtos pelo nome</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">⌕</span>
          <input id="catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="admin-input h-12 pl-10 pr-10" placeholder="Buscar produto por nome: D, DR, DRA, Dragon..." autoComplete="off" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-black text-zinc-500 hover:bg-white/5 hover:text-white">×</button>}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-zinc-500">A busca filtra pelo nome enquanto você digita.</p>
      </div>
      <div>
        <label className="admin-label" htmlFor="catalog-order">Ordenar</label>
        <select id="catalog-order" className="admin-input" value={params.ordem ?? ""} onChange={(event) => update({ ordem: event.target.value || null })}>
          <option value="">Ordem da loja</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="nome">Nome A → Z</option>
          <option value="nome-desc">Nome Z → A</option>
        </select>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/[.07] pt-4">
      {games.length > 1 ? <div className="min-w-44"><label className="admin-label" htmlFor="catalog-game">Jogo</label><select id="catalog-game" className="admin-input" value={params.jogo ?? ""} onChange={(event) => update({ jogo: event.target.value || null, categoria: null })}><option value="">Todos os jogos</option>{games.map((game) => <option key={game.id} value={game.slug}>{game.name}</option>)}</select></div> : games[0] ? <span className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-black text-zinc-300">🎮 {games[0].name}</span> : null}

      <div className="min-w-0 flex-1"><span className="admin-label block">Categoria</span><div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button type="button" onClick={() => update({ categoria: null })} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition ${!params.categoria ? "border-violet-500/50 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[.025] text-zinc-400 hover:text-white"}`}>Todos</button>{visibleCategories.map((category) => <button key={category.id} type="button" onClick={() => update({ categoria: category.id })} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition ${params.categoria === category.id ? "border-violet-500/50 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[.025] text-zinc-400 hover:text-white"}`}>{category.name}</button>)}</div></div>

      {hasFilters && <button type="button" onClick={() => { setQuery(""); router.replace(pathname, { scroll: false }); }} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-white/5 hover:text-white">Limpar filtros</button>}
    </div>
  </section>;
}
