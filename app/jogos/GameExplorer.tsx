"use client";
import { useState } from "react";
import { normalizeSearch } from "@/lib/catalog";
import CatalogCard from "@/app/components/CatalogCard";
export default function GameExplorer({
  games,
}: {
  games: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    productCount: number;
    categoryCount: number;
  }[];
}) {
  const [q, setQ] = useState("");
  const visible = games.filter((game) =>
    normalizeSearch(game.name).includes(normalizeSearch(q)),
  );
  return (
    <>
      <label htmlFor="game-search" className="sr-only">
        Buscar jogo
      </label>
      <input
        id="game-search"
        type="search"
        className="admin-input mb-5 max-w-lg"
        placeholder="Buscar jogo…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="catalog-grid pb-12">
        {visible.map((game) => (
          <CatalogCard
            key={game.id}
            href={`/${game.slug}`}
            name={game.name}
            imageUrl={game.image_url}
            eyebrow={`${game.categoryCount} categorias`}
            description={`${game.productCount} produtos no catálogo`}
          />
        ))}
      </div>
      {!visible.length && (
        <div className="empty-store-state mb-12">Nenhum jogo encontrado.</div>
      )}
    </>
  );
}
