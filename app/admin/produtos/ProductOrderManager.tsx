"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct, saveProductOrder, updateProductQuick } from "../actions";
import ConfirmDeleteButton from "./ConfirmDeleteButton";

type ProductItem = {
  id: string;
  name: string;
  category_id: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  price: number;
  stock: number;
  unlimited_stock: boolean;
};

type CategoryOption = { id: string; label: string };
type Props = { products: ProductItem[]; categories: CategoryOption[]; initialSearch?: string; initialCategoryId?: string; initialStatus?: StatusFilter };
type StatusFilter = "all" | "active" | "inactive" | "out" | "low";

const FILTER_KEY = "cosmic-admin-products-filter-v2";

function reorderVisibleSlots(allIds: string[], visibleIds: string[], nextVisibleIds: string[]) {
  const visibleSet = new Set(visibleIds);
  let cursor = 0;
  return allIds.map((id) => visibleSet.has(id) ? nextVisibleIds[cursor++] : id);
}

function money(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductOrderManager({ products, categories, initialSearch = "", initialCategoryId = "all", initialStatus = "all" }: Props) {
  const router = useRouter();
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const [orderedIds, setOrderedIds] = useState(() => products.map((product) => product.id));
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [filtersReady, setFiltersReady] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [quickStock, setQuickStock] = useState("0");
  const [quickUnlimited, setQuickUnlimited] = useState(false);
  const [quickActive, setQuickActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isQuickPending, startQuickTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY);
      const hasInitialFilter = Boolean(initialSearch || initialCategoryId !== "all" || initialStatus !== "all");
      if (saved && !hasInitialFilter) {
        const parsed = JSON.parse(saved) as { search?: string; categoryId?: string; status?: StatusFilter };
        if (typeof parsed.search === "string") setSearch(parsed.search);
        if (typeof parsed.categoryId === "string") setCategoryId(parsed.categoryId);
        if (["all", "active", "inactive", "out", "low"].includes(String(parsed.status))) setStatus(parsed.status as StatusFilter);
      }
    } catch {
      // Filtros antigos inválidos são ignorados.
    } finally {
      setFiltersReady(true);
    }
  }, [initialCategoryId, initialSearch, initialStatus]);

  useEffect(() => {
    if (!filtersReady) return;
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ search, categoryId, status }));
  }, [filtersReady, search, categoryId, status]);

  useEffect(() => {
    setOrderedIds(products.map((product) => product.id));
  }, [products]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const visibleIds = orderedIds.filter((id) => {
    const product = productById.get(id);
    if (!product) return false;
    if (categoryId !== "all" && product.category_id !== categoryId) return false;
    if (normalizedSearch && !`${product.name} ${categories.find((item) => item.id === product.category_id)?.label ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)) return false;
    if (status === "active" && !product.is_active) return false;
    if (status === "inactive" && product.is_active) return false;
    if (status === "out" && (product.unlimited_stock || product.stock > 0)) return false;
    if (status === "low" && (product.unlimited_stock || product.stock < 1 || product.stock > 2)) return false;
    return true;
  });

  function setVisibleOrder(nextVisibleIds: string[]) {
    setOrderedIds((current) => reorderVisibleSlots(current, visibleIds, nextVisibleIds));
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
    next.splice(next.indexOf(targetId), 0, draggedId);
    setVisibleOrder(next);
    setDraggedId(null);
  }

  function alphabetizeVisible() {
    setVisibleOrder([...visibleIds].sort((a, b) => (productById.get(a)?.name ?? "").localeCompare(productById.get(b)?.name ?? "", "pt-BR")));
  }

  function saveOrder() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveProductOrder(orderedIds);
      setMessage(result.error ?? "Ordem da vitrine salva com sucesso.");
    });
  }

  function openQuick(product: ProductItem) {
    if (quickId === product.id) {
      setQuickId(null);
      setQuickMessage(null);
      return;
    }
    setQuickId(product.id);
    setQuickStock(String(product.stock));
    setQuickUnlimited(product.unlimited_stock);
    setQuickActive(product.is_active);
    setQuickMessage(null);
  }

  function saveQuick(productId: string) {
    setQuickMessage(null);
    const stock = Number(quickStock);
    if (!quickUnlimited && (!Number.isSafeInteger(stock) || stock < 0)) {
      setQuickMessage("Informe uma quantidade válida.");
      return;
    }
    startQuickTransition(async () => {
      const result = await updateProductQuick({ productId, stock, unlimitedStock: quickUnlimited, isActive: quickActive });
      if (result.error) {
        setQuickMessage(result.error);
        return;
      }
      setQuickMessage("Estoque e status salvos.");
      router.refresh();
    });
  }

  if (!products.length) return <div className="admin-empty">Cadastre produtos para começar a organizar o catálogo.</div>;

  return (
    <div className="mt-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_240px_170px_auto] lg:items-end">
        <div>
          <label className="admin-label" htmlFor="catalog-product-search">Buscar produto</label>
          <input id="catalog-product-search" className="admin-input" value={search} onChange={(event) => { setSearch(event.target.value); setMessage(null); }} placeholder="Nome, jogo ou categoria" />
        </div>
        <div>
          <label className="admin-label" htmlFor="catalog-category-filter">Jogo e categoria</label>
          <select id="catalog-category-filter" className="admin-input" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setMessage(null); }}>
            <option value="all">Todas as categorias</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </div>
        <div>
          <label className="admin-label" htmlFor="catalog-status-filter">Status</label>
          <select id="catalog-status-filter" className="admin-input" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setMessage(null); }}>
            <option value="all">Todos</option><option value="active">Publicados</option><option value="inactive">Inativos</option><option value="out">Esgotados</option><option value="low">Estoque baixo</option>
          </select>
        </div>
        <button type="button" className="admin-small-button min-h-11" onClick={() => { setSearch(""); setCategoryId("all"); setStatus("all"); }}>Limpar filtros</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-black/15 p-3">
        <p className="text-xs leading-5 text-zinc-500"><strong className="text-zinc-300">{visibleIds.length}</strong> produto(s) visível(is). Arraste no PC, use as setas no celular ou informe a posição.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="admin-small-button" onClick={alphabetizeVisible} disabled={isPending || visibleIds.length < 2}>A-Z nesta lista</button>
          <button type="button" className="btn-primary" onClick={saveOrder} disabled={isPending}>{isPending ? "Salvando..." : "Salvar ordem"}</button>
        </div>
      </div>

      {message && <p role="status" className={`mt-3 rounded-lg border px-4 py-3 text-sm ${message.includes("sucesso") ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200" : "border-red-400/25 bg-red-400/[.07] text-red-200"}`}>{message}</p>}

      <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
        {!visibleIds.length && <div className="admin-empty">Nenhum produto corresponde aos filtros.</div>}
        {visibleIds.map((id, index) => {
          const product = productById.get(id);
          if (!product) return null;
          const categoryLabel = categories.find((item) => item.id === product.category_id)?.label ?? "Categoria não encontrada";
          const stockLabel = product.unlimited_stock ? "Ilimitado" : product.stock < 1 ? "Esgotado" : product.stock <= 2 ? `${product.stock} · baixo` : `${product.stock} em estoque`;
          const returnTo = "/admin/produtos?catalogo=1#catalogo-produtos";

          return <div key={id} className="rounded-xl border border-white/[.075] bg-[#0d0b12]">
            <article draggable={!isPending} onDragStart={() => setDraggedId(id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropBefore(id)} className={`admin-product-order-row border-0 bg-transparent ${draggedId === id ? "opacity-50" : ""}`}>
              <button type="button" className="hidden cursor-grab select-none text-lg text-zinc-500 hover:text-violet-300 sm:block" aria-label={`Arrastar ${product.name}`} title="Arraste para mudar a posição" tabIndex={-1}>⋮⋮</button>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-violet-500/10"><Image src={product.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="48px" className="object-contain p-1" /></div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{product.name}</strong>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{categoryLabel}</span>
                <span className="mt-1 block text-[11px] text-zinc-400">{money(product.price)} · {stockLabel} · <span className={product.is_active ? "text-emerald-300" : "text-amber-300"}>{product.is_active ? "Publicado" : "Inativo"}</span></span>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-500"><span className="hidden xl:inline">Posição</span><input aria-label={`Posição de ${product.name}`} type="number" min={1} max={visibleIds.length} value={index + 1} onChange={(event) => moveToPosition(id, Number(event.target.value))} className="h-9 w-16 rounded-lg border border-white/10 bg-black/25 px-2 text-center text-sm font-bold text-white outline-none focus:border-violet-400" /></label>
              <div className="flex shrink-0 gap-1"><button type="button" className="admin-order-button" onClick={() => move(id, -1)} disabled={index === 0 || isPending} aria-label={`Mover ${product.name} para cima`}>↑</button><button type="button" className="admin-order-button" onClick={() => move(id, 1)} disabled={index === visibleIds.length - 1 || isPending} aria-label={`Mover ${product.name} para baixo`}>↓</button></div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <button type="button" onClick={() => openQuick(product)} className="admin-small-button">Estoque</button>
                <Link href={`/admin/produtos/${product.id}/editar?returnTo=${encodeURIComponent(returnTo)}`} className="admin-small-button">Editar ↗</Link>
                {!product.is_active && <form action={deleteProduct}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="return_to" value={returnTo} /><ConfirmDeleteButton /></form>}
              </div>
            </article>

            {quickId === product.id && <div className="grid gap-3 border-t border-white/[.07] p-3 sm:grid-cols-[180px_1fr_170px_auto] sm:items-end">
              <div><label className="admin-label" htmlFor={`quick-type-${id}`}>Tipo de estoque</label><select id={`quick-type-${id}`} className="admin-input" value={quickUnlimited ? "true" : "false"} onChange={(event) => setQuickUnlimited(event.target.value === "true")}><option value="false">Limitado</option><option value="true">Ilimitado</option></select></div>
              <div><label className="admin-label" htmlFor={`quick-stock-${id}`}>Quantidade</label><input id={`quick-stock-${id}`} className="admin-input" type="number" min="0" step="1" value={quickStock} onChange={(event) => setQuickStock(event.target.value)} disabled={quickUnlimited} /></div>
              <div><label className="admin-label" htmlFor={`quick-active-${id}`}>Visibilidade</label><select id={`quick-active-${id}`} className="admin-input" value={quickActive ? "true" : "false"} onChange={(event) => setQuickActive(event.target.value === "true")}><option value="true">Publicado</option><option value="false">Inativo</option></select></div>
              <button type="button" className="btn-primary min-h-11" disabled={isQuickPending} onClick={() => saveQuick(product.id)}>{isQuickPending ? "Salvando..." : "Salvar ajustes"}</button>
              {quickMessage && <p role="status" className={`sm:col-span-4 text-xs ${quickMessage.includes("salvos") ? "text-emerald-300" : "text-red-300"}`}>{quickMessage}</p>}
            </div>}
          </div>;
        })}
      </div>
    </div>
  );
}
