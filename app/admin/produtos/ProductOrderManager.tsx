"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { saveProductOrder } from "../actions";

type ProductOrderItem = {
  id: string;
  name: string;
  category_id: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
};

type CategoryOption = {
  id: string;
  label: string;
};

type Props = {
  products: ProductOrderItem[];
  categories: CategoryOption[];
};

function reorderVisibleSlots(
  allIds: string[],
  visibleIds: string[],
  nextVisibleIds: string[]
) {
  const visibleSet = new Set(visibleIds);
  let cursor = 0;

  return allIds.map((id) => {
    if (!visibleSet.has(id)) return id;
    const replacement = nextVisibleIds[cursor];
    cursor += 1;
    return replacement;
  });
}

export default function ProductOrderManager({ products, categories }: Props) {
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const [orderedIds, setOrderedIds] = useState(() => products.map((product) => product.id));
  const [categoryId, setCategoryId] = useState("all");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleIds = orderedIds.filter((id) => {
    if (categoryId === "all") return true;
    return productById.get(id)?.category_id === categoryId;
  });

  function setVisibleOrder(nextVisibleIds: string[]) {
    setOrderedIds((current) =>
      reorderVisibleSlots(current, visibleIds, nextVisibleIds)
    );
    setMessage(null);
  }

  function move(id: string, delta: number) {
    const currentIndex = visibleIds.indexOf(id);
    const nextIndex = currentIndex + delta;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleIds.length) return;

    const next = [...visibleIds];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    setVisibleOrder(next);
  }

  function moveToPosition(id: string, position: number) {
    const from = visibleIds.indexOf(id);
    const to = Math.min(Math.max(position - 1, 0), visibleIds.length - 1);
    if (from < 0 || from === to) return;

    const next = [...visibleIds];
    next.splice(from, 1);
    next.splice(to, 0, id);
    setVisibleOrder(next);
  }

  function dropBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...visibleIds];
    const from = next.indexOf(draggedId);
    const target = next.indexOf(targetId);
    if (from < 0 || target < 0) return;

    next.splice(from, 1);
    const targetAfterRemoval = next.indexOf(targetId);
    next.splice(targetAfterRemoval, 0, draggedId);
    setVisibleOrder(next);
    setDraggedId(null);
  }

  function alphabetizeVisible() {
    const next = [...visibleIds].sort((a, b) =>
      (productById.get(a)?.name ?? "").localeCompare(
        productById.get(b)?.name ?? "",
        "pt-BR"
      )
    );
    setVisibleOrder(next);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveProductOrder(orderedIds);
      setMessage(result.error ?? "Ordem salva com sucesso.");
    });
  }

  if (!products.length) {
    return <div className="admin-empty">Cadastre produtos para poder organizar a vitrine.</div>;
  }

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-md">
          <label className="admin-label" htmlFor="order-category-filter">
            Organizar por categoria
          </label>
          <select
            id="order-category-filter"
            className="admin-input"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setMessage(null);
            }}
          >
            <option value="all">Todos os produtos</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="admin-small-button"
            onClick={alphabetizeVisible}
            disabled={isPending || visibleIds.length < 2}
          >
            A-Z nesta lista
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Salvar ordem"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Arraste no computador, use as setas no celular ou digite a posição exata. A mesma ordem é usada na página inicial, no catálogo e nas categorias.
      </p>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.includes("sucesso")
              ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200"
              : "border-red-400/25 bg-red-400/[.07] text-red-200"
          }`}
        >
          {message}
        </p>
      )}

      <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
        {visibleIds.map((id, index) => {
          const product = productById.get(id);
          if (!product) return null;

          return (
            <article
              key={id}
              draggable={!isPending}
              onDragStart={() => setDraggedId(id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropBefore(id)}
              className={`admin-product-order-row ${draggedId === id ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                className="hidden cursor-grab select-none text-lg text-zinc-500 hover:text-violet-300 sm:block"
                aria-label={`Arrastar ${product.name}`}
                title="Arraste para mudar a posição"
                tabIndex={-1}
              >
                ⋮⋮
              </button>

              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-violet-500/10">
                <Image
                  src={product.image_url || "/images/products/placeholder.svg"}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain p-1"
                />
              </div>

              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{product.name}</strong>
                <span className="mt-0.5 block text-[11px] text-zinc-500">
                  {product.is_active ? "Publicado" : "Inativo"}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="hidden sm:inline">Posição</span>
                <input
                  aria-label={`Posição de ${product.name}`}
                  type="number"
                  min={1}
                  max={visibleIds.length}
                  value={index + 1}
                  onChange={(event) => moveToPosition(id, Number(event.target.value))}
                  className="h-9 w-16 rounded-lg border border-white/10 bg-black/25 px-2 text-center text-sm font-bold text-white outline-none focus:border-violet-400"
                />
              </label>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="admin-order-button"
                  onClick={() => move(id, -1)}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${product.name} para cima`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="admin-order-button"
                  onClick={() => move(id, 1)}
                  disabled={index === visibleIds.length - 1 || isPending}
                  aria-label={`Mover ${product.name} para baixo`}
                >
                  ↓
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
