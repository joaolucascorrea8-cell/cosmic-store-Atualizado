"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkUpdateProducts,
  deleteProduct,
  saveProductOrder,
  setFeaturedProduct,
  updateProductQuick,
} from "../actions";
import { matchesProductName, parsePrice } from "@/lib/catalog";
import Icon from "@/app/components/Icon";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
export type ManagedProduct = {
  id: string;
  name: string;
  slug?: string;
  category_id: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  price: number;
  stock: number;
  low_stock_threshold?: number;
  unlimited_stock: boolean;
};
type Category = { id: string; label: string; game_id?: string };
type Game = { id: string; name: string };
type Filters = { q: string; category: string; game: string; status: string };
const storageKey = "cosmic-admin-catalog-filters-v2";
function QuickProduct({
  product,
  onResult,
  pending,
}: {
  product: ManagedProduct;
  onResult: (message: string, error?: boolean) => void;
  pending: boolean;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(
      Number(product.price).toFixed(2).replace(".", ","),
    ),
    [stock, setStock] = useState(String(product.stock)),
    [unlimited, setUnlimited] = useState(product.unlimited_stock),
    [active, setActive] = useState(product.is_active),
    [busy, start] = useTransition();
  const cleanSnapshot = useRef(product);
  const dirty =
    price !== Number(product.price).toFixed(2).replace(".", ",") ||
    stock !== String(product.stock) ||
    unlimited !== product.unlimited_stock ||
    active !== product.is_active;
  useEffect(() => {
    const previous = cleanSnapshot.current;
    cleanSnapshot.current = product;
    if (
      price !== Number(previous.price).toFixed(2).replace(".", ",") ||
      stock !== String(previous.stock) ||
      unlimited !== previous.unlimited_stock ||
      active !== previous.is_active
    )
      return;
    queueMicrotask(() => {
      setPrice(Number(product.price).toFixed(2).replace(".", ","));
      setStock(String(product.stock));
      setUnlimited(product.unlimited_stock);
      setActive(product.is_active);
    });
    // The last server values are compared before accepting new server props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);
  return (
    <div
      className="admin-product-actions"
      data-live-dirty={dirty}
      data-live-busy={busy}
    >
      <label className="text-[10px] text-zinc-500">
        Preço
        <input
          aria-label={`Preço de ${product.name}`}
          inputMode="decimal"
          className="admin-input mt-1 min-h-9! py-1!"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <label className="text-[10px] text-zinc-500">
        Estoque
        <input
          aria-label={`Estoque de ${product.name}`}
          type="number"
          min={0}
          className="admin-input mt-1 min-h-9! py-1!"
          value={stock}
          disabled={unlimited}
          onChange={(e) => setStock(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
        />{" "}
        Ilimitado
      </label>
      <label className="flex items-center gap-1 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />{" "}
        Publicado
      </label>
      <button
        type="button"
        disabled={pending || busy || !dirty}
        className="admin-small-button disabled:opacity-40"
        onClick={() =>
          start(async () => {
            try {
              const result = await updateProductQuick({
                productId: product.id,
                price,
                stock: Number(stock),
                unlimitedStock: unlimited,
                isActive: active,
              });
              onResult(
                result.error ?? `Alterações de ${product.name} salvas.`,
                Boolean(result.error),
              );
              if (!result.error) {
                const normalized = parsePrice(price);
                if (normalized !== null) setPrice(normalized.toFixed(2).replace(".", ","));
                setStock(String(Number(stock)));
                router.refresh();
              }
            } catch {
              onResult("Não foi possível salvar. Tente novamente.", true);
            }
          })
        }
      >
        {busy ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
export default function ProductOrderManager({
  products,
  categories,
  games = [],
  featuredId,
  initialSearch = "",
  initialCategoryId = "all",
  initialStatus = "all",
}: {
  products: ManagedProduct[];
  categories: Category[];
  games?: Game[];
  featuredId?: string | null;
  initialSearch?: string;
  initialCategoryId?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(products),
    [filters, setFilters] = useState<Filters>({
      q: initialSearch,
      category: initialCategoryId,
      game: "all",
      status: initialStatus,
    }),
    [loaded, setLoaded] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [bulkAction, setBulkAction] = useState("publish"),
    [bulkValue, setBulkValue] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [pending, start] = useTransition();
  const drag = useRef<string | null>(null);
  const [baseOrder, setBaseOrder] = useState(
    products.map((p) => p.id).join(","),
  );
  const dirty = rows.map((p) => p.id).join(",") !== baseOrder;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (
          !initialSearch &&
          initialCategoryId === "all" &&
          initialStatus === "all"
        ) {
          const saved = JSON.parse(
            sessionStorage.getItem(storageKey) ?? "null",
          );
          if (saved && typeof saved === "object")
            setFilters({
              q: typeof saved.q === "string" ? saved.q : "",
              category: categories.some((c) => c.id === saved.category)
                ? saved.category
                : "all",
              game: games.some((g) => g.id === saved.game) ? saved.game : "all",
              status: ["all", "active", "inactive", "out", "low"].includes(
                saved.status,
              )
                ? saved.status
                : "all",
            });
        }
      } catch {}
      setLoaded(true);
    });
  }, [initialSearch, initialCategoryId, initialStatus, categories, games]);
  useEffect(() => {
    if (loaded)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(filters));
      } catch {}
  }, [filters, loaded]);
  useEffect(() => {
    queueMicrotask(() =>
      setRows((current) => {
        if (current.map((p) => p.id).join(",") === baseOrder) return products;
        const lookup = new Map(products.map((p) => [p.id, p]));
        return [
          ...current
            .map((p) => lookup.get(p.id))
            .filter((p): p is ManagedProduct => Boolean(p)),
          ...products.filter((p) => !current.some((x) => x.id === p.id)),
        ];
      }),
    );
    queueMicrotask(() => setBaseOrder(products.map((p) => p.id).join(",")));
  }, [products, baseOrder]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const visible = rows.filter(
    (p) =>
      matchesProductName(p.name, filters.q) &&
      (filters.category === "all" || p.category_id === filters.category) &&
      (filters.game === "all" ||
        categories.find((c) => c.id === p.category_id)?.game_id ===
          filters.game) &&
      (filters.status === "all" ||
        (filters.status === "active" && p.is_active) ||
        (filters.status === "inactive" && !p.is_active) ||
        (filters.status === "out" && !p.unlimited_stock && p.stock === 0) ||
        (filters.status === "low" &&
          !p.unlimited_stock &&
          p.stock > 0 &&
          p.stock <= (p.low_stock_threshold ?? 2))),
  );
  const result = (value: string, error = false) => {
    setMessage(value);
    setFailed(error);
  };
  function move(id: string, index: number) {
    const ids = visible.map((p) => p.id),
      from = ids.indexOf(id);
    if (from < 0 || index < 0 || index >= ids.length || from === index) return;
    ids.splice(index, 0, ids.splice(from, 1)[0]);
    const lookup = new Map(rows.map((p) => [p.id, p])),
      slots = new Set(ids);
    let n = 0;
    setRows(rows.map((p) => (slots.has(p.id) ? lookup.get(ids[n++])! : p)));
  }
  const returnTo = "/admin/produtos?catalogo=1#catalogo-produtos";
  const updateFilters = (change: Partial<Filters>) =>
    setFilters((current) => ({ ...current, ...change }));
  return (
    <div data-live-dirty={dirty} data-live-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="admin-label">Buscar produto</span>
          <input
            type="search"
            placeholder="Nome do produto…"
            value={filters.q}
            maxLength={100}
            onChange={(e) => updateFilters({ q: e.target.value })}
            className="admin-input"
          />
        </label>
        <label>
          <span className="admin-label">Jogo</span>
          <select
            value={filters.game}
            onChange={(e) =>
              updateFilters({ game: e.target.value, category: "all" })
            }
            className="admin-input"
          >
            <option value="all">Todos os jogos</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="admin-label">Categoria</span>
          <select
            value={filters.category}
            onChange={(e) => updateFilters({ category: e.target.value })}
            className="admin-input"
          >
            <option value="all">Todas as categorias</option>
            {categories
              .filter(
                (c) => filters.game === "all" || c.game_id === filters.game,
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="admin-label">Visibilidade e estoque</span>
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="admin-input"
          >
            <option value="all">Todos os produtos</option>
            <option value="active">Publicados</option>
            <option value="inactive">Rascunhos</option>
            <option value="out">Esgotados</option>
            <option value="low">Estoque baixo</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-zinc-400">
          {visible.length} de {rows.length} produtos
        </span>
        <button
          type="button"
          className="text-violet-300"
          onClick={() =>
            setFilters({ q: "", category: "all", game: "all", status: "all" })
          }
        >
          Limpar filtros
        </button>
        <button
          type="button"
          className="ml-auto admin-small-button"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              try {
                const response = await saveProductOrder(rows.map((p) => p.id));
                result(
                  response.error ?? "Ordem da vitrine salva.",
                  Boolean(response.error),
                );
                if (!response.error) router.refresh();
              } catch {
                result("Não foi possível salvar a ordem.", true);
              }
            })
          }
        >
          {pending ? "Salvando…" : dirty ? "Salvar nova ordem" : "Ordem salva"}
        </button>
        {dirty && (
          <button
            type="button"
            className="text-zinc-400"
            onClick={() => setRows(products)}
          >
            Desfazer ordem
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            aria-label="Selecionar todos os resultados"
            checked={
              visible.length > 0 &&
              visible.every((p) => selected.includes(p.id))
            }
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? Array.from(
                      new Set([...selected, ...visible.map((p) => p.id)]),
                    )
                  : selected.filter((id) => !visible.some((p) => p.id === id)),
              )
            }
          />{" "}
          {selected.length} selecionados
        </label>
        <select
          aria-label="Ação em lote"
          className="admin-input w-auto! min-h-9! py-1! text-xs!"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
        >
          <option value="publish">Publicar</option>
          <option value="hide">Ocultar</option>
          <option value="stock">Definir estoque</option>
          <option value="price_percent">Ajustar preço em %</option>
        </select>
        {["stock", "price_percent"].includes(bulkAction) && (
          <input
            aria-label={
              bulkAction === "stock" ? "Novo estoque" : "Percentual de ajuste"
            }
            className="admin-input w-28! min-h-9! py-1!"
            inputMode="decimal"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder={bulkAction === "stock" ? "Unidades" : "Ex.: 5 ou -5"}
          />
        )}
        <button
          type="button"
          disabled={pending || !selected.length}
          className="admin-small-button disabled:opacity-40"
          onClick={() => {
            if (
              !window.confirm(
                `Aplicar esta alteração a ${selected.length} produtos?`,
              )
            )
              return;
            start(async () => {
              try {
                const response = await bulkUpdateProducts(
                  selected,
                  bulkAction,
                  bulkValue,
                );
                result(
                  response.error ??
                    "Alteração aplicada aos produtos selecionados.",
                  Boolean(response.error),
                );
                if (!response.error) {
                  setSelected([]);
                  router.refresh();
                }
              } catch {
                result("Não foi possível aplicar a alteração.", true);
              }
            });
          }}
        >
          Aplicar
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-xs text-zinc-400"
          >
            Limpar seleção
          </button>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">
        Arraste no computador ou use as setas e a posição. Ao filtrar, a
        ordenação preserva os lugares dos outros produtos.
      </p>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`${failed ? "admin-error" : "admin-notice"} mt-3`}
        >
          {message}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {visible.map((p, index) => (
          <article
            key={p.id}
            className="admin-product-order-row"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag.current) move(drag.current, index);
              drag.current = null;
            }}
          >
            <input
              type="checkbox"
              aria-label={`Selecionar ${p.name}`}
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, p.id]
                    : ids.filter((id) => id !== p.id),
                )
              }
            />
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                draggable
                onDragStart={() => {
                  drag.current = p.id;
                }}
                onDragEnd={() => {
                  drag.current = null;
                }}
                aria-label={`Arrastar ${p.name}`}
                className="text-zinc-500"
              >
                ⠿
              </button>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`Mover ${p.name} para cima`}
                  onClick={() => move(p.id, index - 1)}
                  className="admin-order-button h-7! w-7!"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === visible.length - 1}
                  aria-label={`Mover ${p.name} para baixo`}
                  onClick={() => move(p.id, index + 1)}
                  className="admin-order-button h-7! w-7!"
                >
                  ↓
                </button>
              </div>
              <input
                type="number"
                min={1}
                max={visible.length}
                key={`${p.id}-${index}`}
                defaultValue={index + 1}
                aria-label={`Posição de ${p.name}`}
                className="w-14 rounded border border-white/10 bg-black/20 p-1 text-center text-xs"
                onBlur={(e) =>
                  move(
                    p.id,
                    Math.max(
                      0,
                      Math.min(visible.length - 1, Number(e.target.value) - 1),
                    ),
                  )
                }
              />
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#1a1527]">
                <Image
                  src={p.image_url || "/images/products/placeholder.svg"}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              </div>
              <div className="min-w-0">
                <strong className="block break-words text-sm">{p.name}</strong>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {categories.find((c) => c.id === p.category_id)?.label}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/produtos/${p.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
                    className="text-xs font-semibold text-violet-300"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/admin/produtos?novo=1&duplicar=${p.id}#novo-produto`}
                    className="text-xs text-zinc-400"
                  >
                    Duplicar
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-xs text-zinc-400"
                    onClick={() =>
                      start(async () => {
                        try {
                          const response = await setFeaturedProduct(
                            featuredId === p.id ? null : p.id,
                          );
                          result(
                            response.error ?? "Destaque da Home atualizado.",
                            Boolean(response.error),
                          );
                          if (!response.error) router.refresh();
                        } catch {
                          result(
                            "Não foi possível atualizar o destaque.",
                            true,
                          );
                        }
                      })
                    }
                  >
                    <Icon
                      name="star"
                      className={`inline h-3 w-3 ${featuredId === p.id ? "fill-violet-400 text-violet-400" : ""}`}
                    />{" "}
                    {featuredId === p.id ? "Em destaque" : "Destacar"}
                  </button>
                  {!p.is_active && (
                    <form action={deleteProduct}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <ConfirmDeleteButton />
                    </form>
                  )}
                </div>
              </div>
            </div>
            <QuickProduct
              key={`${p.id}:${p.price}:${p.stock}:${p.unlimited_stock}:${p.is_active}`}
              product={p}
              pending={pending}
              onResult={result}
            />
          </article>
        ))}
      </div>
      {!visible.length && (
        <p className="admin-empty">Nenhum produto corresponde aos filtros.</p>
      )}
    </div>
  );
}
