"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Game = { id: string; name: string; slug: string };
type Category = { id: string; name: string; game_id: string | null };
type Params = { q?: string; jogo?: string; categoria?: string; ordem?: string };
type Option = { value: string; label: string };

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function FilterPicker({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const shouldSearch = options.length > 5;
  const visibleOptions = useMemo(() => {
    const q = normalize(search);
    if (!q) return options;
    return options.filter((option) => normalize(option.label).includes(q));
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="admin-label block">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#090811] px-3.5 py-2.5 text-left text-sm text-white transition hover:border-violet-400/35 hover:bg-white/[.035] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className={`min-w-0 truncate ${selected ? "font-bold" : "text-zinc-500"}`}>
          {selected?.label ?? placeholder}
        </span>
        <span aria-hidden="true" className={`shrink-0 text-xs text-zinc-500 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#15111c] p-2 shadow-[0_22px_70px_rgba(0,0,0,.55)]">
          {shouldSearch && (
            <div className="mb-2 border-b border-white/[.07] pb-2">
              <input
                autoFocus
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="admin-input h-10 text-sm"
                autoComplete="off"
              />
            </div>
          )}
          <div role="listbox" className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
            {visibleOptions.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || "all"}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active ? "bg-violet-500/15 font-black text-violet-100" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {active && <span className="text-violet-300">✓</span>}
                </button>
              );
            })}
            {!visibleOptions.length && <p className="px-3 py-5 text-center text-xs text-zinc-500">Nenhuma opção encontrada.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CatalogToolbar({ games, categories, params }: { games: Game[]; categories: Category[]; params: Params }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(params.q ?? "");
  const first = useRef(true);

  const selectedGame = games.find((game) => game.slug === params.jogo);
  const onlyGame = games.length === 1 ? games[0] : undefined;
  const effectiveGame = selectedGame ?? onlyGame;

  const visibleCategories = useMemo(
    () => (effectiveGame ? categories.filter((category) => category.game_id === effectiveGame.id) : []),
    [categories, effectiveGame],
  );

  const gameOptions = useMemo<Option[]>(() => {
    if (games.length === 1) return [{ value: games[0].slug, label: games[0].name }];
    return [{ value: "", label: "Todos os jogos" }, ...games.map((game) => ({ value: game.slug, label: game.name }))];
  }, [games]);

  const categoryOptions = useMemo<Option[]>(
    () => [{ value: "", label: "Todas as categorias" }, ...visibleCategories.map((category) => ({ value: category.id, label: category.name }))],
    [visibleCategories],
  );

  const gameValue = selectedGame?.slug ?? onlyGame?.slug ?? "";
  const selectedCategory = visibleCategories.find((category) => category.id === params.categoria);
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
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => update({ q: query.trim() || null }), 180);
    return () => window.clearTimeout(timer);
  }, [query, update]);

  useEffect(() => {
    setQuery(params.q ?? "");
  }, [params.q]);

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-[#131017] p-3 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px]">
        <div>
          <label className="sr-only" htmlFor="catalog-search">Buscar produtos pelo nome</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">⌕</span>
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="admin-input h-12 pl-10 pr-10"
              placeholder="Buscar produto por nome: D, DR, DRA, Dragon..."
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-black text-zinc-500 hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-zinc-500">A busca filtra pelo nome enquanto você digita.</p>
        </div>

        <div>
          <label className="admin-label" htmlFor="catalog-order">Ordenar</label>
          <select
            id="catalog-order"
            className="admin-input"
            value={params.ordem ?? ""}
            onChange={(event) => update({ ordem: event.target.value || null })}
          >
            <option value="">Ordem da loja</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="nome">Nome A → Z</option>
            <option value="nome-desc">Nome Z → A</option>
          </select>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[.07] pt-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,260px)_minmax(220px,320px)_1fr]">
          <FilterPicker
            label="Jogo"
            value={gameValue}
            options={gameOptions}
            placeholder="Selecionar jogo"
            searchPlaceholder="Buscar jogo..."
            disabled={!games.length || games.length === 1}
            onChange={(value) => update({ jogo: value || null, categoria: null })}
          />

          <FilterPicker
            label="Categoria"
            value={selectedCategory?.id ?? ""}
            options={categoryOptions}
            placeholder={effectiveGame ? "Todas as categorias" : "Escolha um jogo primeiro"}
            searchPlaceholder="Buscar categoria..."
            disabled={!effectiveGame}
            onChange={(value) => update({ categoria: value || null })}
          />

          <div className="flex min-h-11 items-end justify-start lg:justify-end">
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  router.replace(pathname, { scroll: false });
                }}
                className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2.5 text-xs font-black text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                ✕ Limpar filtros
              </button>
            ) : (
              <span className="hidden text-xs text-zinc-600 lg:block">Selecione um jogo para refinar o catálogo.</span>
            )}
          </div>
        </div>

        <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
          <span>Catálogo:</span>
          <strong className="text-zinc-300">{effectiveGame?.name ?? "Todos os jogos"}</strong>
          {selectedCategory && <><span>›</span><strong className="text-violet-300">{selectedCategory.name}</strong></>}
        </div>
      </div>
    </section>
  );
}
