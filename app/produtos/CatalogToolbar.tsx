"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/app/components/Icon";
type Game = { id: string; name: string; slug: string };
type Category = { id: string; name: string; game_id: string | null };
export type CatalogParams = { q?: string; jogo?: string; categoria?: string; ordem?: string; estoque?: string; pagina?: string };
const orders: Record<string, string> = { menor: "Menor preço", maior: "Maior preço", nome: "Nome A → Z", "nome-desc": "Nome Z → A" };
export default function CatalogToolbar({ games, categories, params, scoped = false }: {
  games: Game[]; categories: Category[]; params: CatalogParams; scoped?: boolean;
}) {
  const router = useRouter(), pathname = usePathname();
  const [query, setQuery] = useState(params.q ?? "");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toggle = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { queueMicrotask(() => setQuery(params.q ?? "")); }, [params.q]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const game = games.find(g => g.slug === params.jogo);
  const visibleCategories = categories.filter(c => !game || c.game_id === game.id);
  const selectedCategory = categories.find(c => c.id === params.categoria);
  function update(next: Record<string, string>) {
    if (timer.current) clearTimeout(timer.current);
    const search = new URLSearchParams(window.location.search);
    search.delete("pagina");
    Object.entries(next).forEach(([key, value]) => value ? search.set(key, value) : search.delete(key));
    startTransition(() => router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false }));
  }
  const chips = [
    ...(params.q ? [{ key: "q", label: `Busca: ${params.q}` }] : []),
    ...(!scoped && params.jogo ? [{ key: "jogo", label: `Jogo: ${game?.name ?? "selecionado"}` }] : []),
    ...(!scoped && params.categoria ? [{ key: "categoria", label: `Categoria: ${selectedCategory?.name ?? "selecionada"}` }] : []),
    ...(params.ordem ? [{ key: "ordem", label: orders[params.ordem] ?? "Ordenação" }] : []),
    ...(params.estoque === "1" ? [{ key: "estoque", label: "Somente disponíveis" }] : []),
  ];
  function remove(key: string) {
    if (key === "q") setQuery("");
    update({ [key]: "", ...(key === "jogo" ? { categoria: "" } : {}) });
  }
  return (
    <section aria-label="Busca e filtros" aria-busy={pending} className="catalog-toolbar mb-6">
      <label htmlFor="catalog-search" className="admin-label">{scoped ? "Buscar por nome" : "Buscar na loja"}</label>
      <div className="catalog-search-field relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-zinc-400" />
        <input id="catalog-search" type="search" className="admin-input" placeholder={scoped ? "Busque seu próximo item…" : "Jogo, produto ou categoria…"}
          value={query} maxLength={100} autoComplete="off" enterKeyHint="search"
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); update({ q: query.trim() }); } }}
          onChange={event => { const value = event.target.value; setQuery(value); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => update({ q: value.trim() }), 250); }} />
      </div>
      <div className="catalog-toolbar-actions">
        <button ref={toggle} type="button" className="btn-secondary catalog-filter-toggle" aria-expanded={open} aria-controls="catalog-secondary" onClick={() => setOpen(value => !value)}>
          <Icon name="grid" className="h-4 w-4" /> Filtros{chips.length > 0 ? ` (${chips.length})` : ""}
        </button>
        {chips.length > 0 && <button type="button" className="catalog-clear" onClick={() => {
          if (timer.current) clearTimeout(timer.current); setQuery("");
          startTransition(() => router.replace(pathname, { scroll: false }));
        }}>Limpar filtros</button>}
        <span role="status" className="ml-auto text-xs text-zinc-400">{pending ? "Atualizando produtos…" : ""}</span>
      </div>
      {chips.length > 0 && <div className="catalog-chips" aria-label="Filtros ativos">
        {chips.map(chip => <button key={chip.key} type="button" className="catalog-chip" title={chip.label} aria-label={`Remover filtro ${chip.label}`} onClick={() => remove(chip.key)}>
          <span>{chip.label}</span><span aria-hidden="true">×</span>
        </button>)}
      </div>}
      <div id="catalog-secondary" className={`catalog-secondary${open ? " is-open" : ""}`} onKeyDown={event => {
        if (event.key === "Escape" && window.matchMedia("(max-width: 767px)").matches) { event.preventDefault(); setOpen(false); toggle.current?.focus(); }
      }}>
        <div>
          <label htmlFor="catalog-order" className="admin-label">Ordenar</label>
          <select id="catalog-order" className="admin-input" value={params.ordem ?? ""} onChange={event => update({ ordem: event.target.value, q: query.trim() })}>
            <option value="">Ordem da loja</option>
            {Object.entries(orders).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </div>
        {!scoped && <>
          <div>
            <label htmlFor="catalog-game" className="admin-label">Jogo</label>
            <select id="catalog-game" className="admin-input" value={params.jogo ?? ""} onChange={event => update({ jogo: event.target.value, categoria: "", q: query.trim() })}>
              <option value="">Todos os jogos</option>
              {games.map(g => <option key={g.id} value={g.slug}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="catalog-category" className="admin-label">Categoria</label>
            <select id="catalog-category" className="admin-input" value={params.categoria ?? ""} onChange={event => update({ categoria: event.target.value, q: query.trim() })}>
              <option value="">Todas as categorias</option>
              {visibleCategories.map(category => <option key={category.id} value={category.id}>{game ? category.name : `${games.find(g => g.id === category.game_id)?.name ?? ""} · ${category.name}`}</option>)}
            </select>
          </div>
        </>}
        <label className="flex min-h-11 items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={params.estoque === "1"} onChange={event => update({ estoque: event.target.checked ? "1" : "", q: query.trim() })} /> Somente disponíveis
        </label>
      </div>
    </section>
  );
}
