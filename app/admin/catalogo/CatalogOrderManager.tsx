"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { saveCategoryOrder, saveGameOrder } from "../actions";

type GameItem = {
  id: string;
  name: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
};

type CategoryItem = {
  id: string;
  game_id: string;
  name: string;
  image_url: string | null;
  display_order: number;
};

type Props = {
  games: GameItem[];
  categories: CategoryItem[];
};

function moveId(ids: string[], id: string, delta: number) {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function moveToPosition(ids: string[], id: string, position: number) {
  const from = ids.indexOf(id);
  const to = Math.min(Math.max(position - 1, 0), Math.max(ids.length - 1, 0));
  if (from < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export default function CatalogOrderManager({ games, categories }: Props) {
  const gameById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const [gameIds, setGameIds] = useState(() => games.map((game) => game.id));
  const [selectedGameId, setSelectedGameId] = useState(() => games[0]?.id ?? "");
  const [categoryIdsByGame, setCategoryIdsByGame] = useState<Record<string, string[]>>(() => {
    const grouped: Record<string, string[]> = {};
    for (const game of games) grouped[game.id] = [];
    for (const category of categories) (grouped[category.game_id] ??= []).push(category.id);
    return grouped;
  });
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [draggedGameId, setDraggedGameId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [isSavingGames, startSavingGames] = useTransition();
  const [isSavingCategories, startSavingCategories] = useTransition();

  const selectedCategoryIds = categoryIdsByGame[selectedGameId] ?? [];

  function saveGames() {
    setGameMessage(null);
    startSavingGames(async () => {
      const result = await saveGameOrder(gameIds);
      setGameMessage(result.error ?? "Ordem dos jogos salva com sucesso.");
    });
  }

  function saveCategories() {
    if (!selectedGameId) return;
    setCategoryMessage(null);
    startSavingCategories(async () => {
      const result = await saveCategoryOrder(selectedGameId, selectedCategoryIds);
      setCategoryMessage(result.error ?? "Ordem das categorias salva com sucesso.");
    });
  }

  function dropGameBefore(targetId: string) {
    if (!draggedGameId || draggedGameId === targetId) return;
    setGameIds((current) => {
      const next = [...current];
      const from = next.indexOf(draggedGameId);
      const target = next.indexOf(targetId);
      if (from < 0 || target < 0) return current;
      next.splice(from, 1);
      next.splice(next.indexOf(targetId), 0, draggedGameId);
      return next;
    });
    setDraggedGameId(null);
    setGameMessage(null);
  }

  function dropCategoryBefore(targetId: string) {
    if (!selectedGameId || !draggedCategoryId || draggedCategoryId === targetId) return;
    setCategoryIdsByGame((current) => {
      const next = [...(current[selectedGameId] ?? [])];
      const from = next.indexOf(draggedCategoryId);
      const target = next.indexOf(targetId);
      if (from < 0 || target < 0) return current;
      next.splice(from, 1);
      next.splice(next.indexOf(targetId), 0, draggedCategoryId);
      return { ...current, [selectedGameId]: next };
    });
    setDraggedCategoryId(null);
    setCategoryMessage(null);
  }

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="admin-label">Ordem dos jogos</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Arraste no PC, use as setas no celular ou digite a posição. Essa ordem aparece na Home, em Jogos e nos seletores.</p>
          </div>
          <button type="button" className="btn-primary" onClick={saveGames} disabled={isSavingGames || gameIds.length < 2}>
            {isSavingGames ? "Salvando..." : "Salvar jogos"}
          </button>
        </div>
        {gameMessage && <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${gameMessage.includes("sucesso") ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200" : "border-red-400/25 bg-red-400/[.07] text-red-200"}`}>{gameMessage}</p>}
        <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
          {gameIds.map((id, index) => {
            const game = gameById.get(id);
            if (!game) return null;
            return <article
              key={id}
              draggable={!isSavingGames}
              onDragStart={() => setDraggedGameId(id)}
              onDragEnd={() => setDraggedGameId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropGameBefore(id)}
              className={`admin-product-order-row ${draggedGameId === id ? "opacity-50" : ""}`}
            >
              <button type="button" className="hidden cursor-grab select-none text-lg text-zinc-500 hover:text-violet-300 sm:block" aria-label={`Arrastar ${game.name}`} title="Arraste para mudar a posição" tabIndex={-1}>⋮⋮</button>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-violet-500/10">
                <Image src={game.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="44px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{game.name}</strong><span className="text-[11px] text-zinc-500">{game.is_active ? "Publicado" : "Oculto"}</span></div>
              <label className="flex items-center gap-2 text-xs text-zinc-500"><span className="hidden sm:inline">Posição</span><input aria-label={`Posição de ${game.name}`} type="number" min={1} max={gameIds.length} value={index + 1} onChange={(event) => { setGameIds((current) => moveToPosition(current, id, Number(event.target.value))); setGameMessage(null); }} className="h-9 w-16 rounded-lg border border-white/10 bg-black/25 px-2 text-center text-sm font-bold text-white outline-none focus:border-violet-400" /></label>
              <div className="flex shrink-0 gap-1"><button type="button" className="admin-order-button" onClick={() => { setGameIds((current) => moveId(current, id, -1)); setGameMessage(null); }} disabled={index === 0 || isSavingGames} aria-label={`Mover ${game.name} para cima`}>↑</button><button type="button" className="admin-order-button" onClick={() => { setGameIds((current) => moveId(current, id, 1)); setGameMessage(null); }} disabled={index === gameIds.length - 1 || isSavingGames} aria-label={`Mover ${game.name} para baixo`}>↓</button></div>
            </article>;
          })}
          {!gameIds.length && <div className="admin-empty">Cadastre jogos para organizar a ordem.</div>}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className="admin-label" htmlFor="category-order-game">Categorias do jogo</label>
            <select id="category-order-game" className="admin-input mt-1" value={selectedGameId} onChange={(event) => { setSelectedGameId(event.target.value); setCategoryMessage(null); }} disabled={!games.length}>
              {!games.length && <option value="">Nenhum jogo</option>}
              {gameIds.map((id) => <option key={id} value={id}>{gameById.get(id)?.name ?? "Jogo"}</option>)}
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={saveCategories} disabled={!selectedGameId || isSavingCategories || selectedCategoryIds.length < 2}>
            {isSavingCategories ? "Salvando..." : "Salvar categorias"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">A ordem é independente para cada jogo. Arraste no PC, use as setas no celular ou informe a posição.</p>
        {categoryMessage && <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${categoryMessage.includes("sucesso") ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200" : "border-red-400/25 bg-red-400/[.07] text-red-200"}`}>{categoryMessage}</p>}
        <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
          {selectedCategoryIds.map((id, index) => {
            const category = categoryById.get(id);
            if (!category) return null;
            return <article
              key={id}
              draggable={!isSavingCategories}
              onDragStart={() => setDraggedCategoryId(id)}
              onDragEnd={() => setDraggedCategoryId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropCategoryBefore(id)}
              className={`admin-product-order-row ${draggedCategoryId === id ? "opacity-50" : ""}`}
            >
              <button type="button" className="hidden cursor-grab select-none text-lg text-zinc-500 hover:text-violet-300 sm:block" aria-label={`Arrastar ${category.name}`} title="Arraste para mudar a posição" tabIndex={-1}>⋮⋮</button>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-violet-500/10"><Image src={category.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="44px" className="object-cover" /></div>
              <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{category.name}</strong><span className="text-[11px] text-zinc-500">{gameById.get(category.game_id)?.name ?? "Jogo"}</span></div>
              <label className="flex items-center gap-2 text-xs text-zinc-500"><span className="hidden sm:inline">Posição</span><input aria-label={`Posição de ${category.name}`} type="number" min={1} max={selectedCategoryIds.length} value={index + 1} onChange={(event) => { setCategoryIdsByGame((current) => ({ ...current, [selectedGameId]: moveToPosition(current[selectedGameId] ?? [], id, Number(event.target.value)) })); setCategoryMessage(null); }} className="h-9 w-16 rounded-lg border border-white/10 bg-black/25 px-2 text-center text-sm font-bold text-white outline-none focus:border-violet-400" /></label>
              <div className="flex shrink-0 gap-1"><button type="button" className="admin-order-button" onClick={() => { setCategoryIdsByGame((current) => ({ ...current, [selectedGameId]: moveId(current[selectedGameId] ?? [], id, -1) })); setCategoryMessage(null); }} disabled={index === 0 || isSavingCategories} aria-label={`Mover ${category.name} para cima`}>↑</button><button type="button" className="admin-order-button" onClick={() => { setCategoryIdsByGame((current) => ({ ...current, [selectedGameId]: moveId(current[selectedGameId] ?? [], id, 1) })); setCategoryMessage(null); }} disabled={index === selectedCategoryIds.length - 1 || isSavingCategories} aria-label={`Mover ${category.name} para baixo`}>↓</button></div>
            </article>;
          })}
          {selectedGameId && !selectedCategoryIds.length && <div className="admin-empty">Este jogo ainda não tem categorias.</div>}
        </div>
      </div>
    </div>
  );
}
