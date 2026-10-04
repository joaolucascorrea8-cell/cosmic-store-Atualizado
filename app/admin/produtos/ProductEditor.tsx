"use client";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProduct, type ProductEditorState } from "../actions";
import { money, parsePrice, slugify } from "@/lib/catalog";
import ProductImageUpload from "./ProductImageUpload";
type Product = {
  id?: string;
  name: string;
  slug: string;
  category_id: string;
  description: string | null;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  image_url: string | null;
  is_active: boolean;
};
type Category = { id: string; name: string; game_id: string };
type Game = { id: string; name: string };
const initial: ProductEditorState = { error: null, success: null };
export default function ProductEditor({
  product,
  categories,
  games,
  returnTo = "/admin/produtos?catalogo=1#catalogo-produtos",
  duplicate = false,
}: {
  product?: Product;
  categories: Category[];
  games: Game[];
  returnTo?: string;
  duplicate?: boolean;
}) {
  const [state, action, pending] = useActionState(saveProduct, initial);
  const [currentId, setCurrentId] = useState(
    duplicate ? "" : (product?.id ?? ""),
  );
  const [name, setName] = useState(
      product ? product.name + (duplicate ? " (cópia)" : "") : "",
    ),
    [price, setPrice] = useState(
      product ? Number(product.price).toFixed(2).replace(".", ",") : "",
    ),
    [stock, setStock] = useState(String(duplicate ? 0 : (product?.stock ?? 0))),
    [unlimited, setUnlimited] = useState(
      duplicate ? false : (product?.unlimited_stock ?? false),
    ),
    [active, setActive] = useState(
      duplicate ? false : (product?.is_active ?? false),
    ),
    [description, setDescription] = useState(product?.description ?? "");
  const [game, setGame] = useState(
      categories.find((c) => c.id === product?.category_id)?.game_id ??
        games[0]?.id ??
        "",
    ),
    [category, setCategory] = useState(product?.category_id ?? ""),
    [image, setImage] = useState(product?.image_url ?? ""),
    [uploading, setUploading] = useState(false),
    [imageKey, setImageKey] = useState(0),
    [customSlug, setCustomSlug] = useState(Boolean(product && !duplicate)),
    [slug, setSlug] = useState(
      duplicate ? slugify(product?.name ?? "") : (product?.slug ?? ""),
    ),
    [dirty, setDirty] = useState(false);
  const saveAction = useRef("stay");
  useEffect(() => {
    if (!state.success) return;
    queueMicrotask(() => {
      setDirty(false);
      if (saveAction.current === "another") {
        setCurrentId("");
        setName("");
        setPrice("");
        setStock("0");
        setUnlimited(false);
        setActive(false);
        setDescription("");
        setImage("");
        setImageKey((key) => key + 1);
        setCustomSlug(false);
        setSlug("");
      } else if (state.id) setCurrentId(state.id);
    });
  }, [state]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const effectiveSlug = customSlug ? slug : slugify(name),
    visibleCategories = categories.filter((c) => c.game_id === game);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form
        action={action}
        data-live-dirty={dirty}
        data-live-busy={pending || uploading}
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          if (uploading || pending) e.preventDefault();
        }}
        className="space-y-5"
      >
        <input type="hidden" name="product_id" value={currentId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <input type="hidden" name="slug" value={effectiveSlug} />
        <input type="hidden" name="auto_slug" value={String(!customSlug)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="editor-game" className="admin-label">
              Jogo
            </label>
            <select
              id="editor-game"
              className="admin-input"
              value={game}
              onChange={(e) => {
                setGame(e.target.value);
                setCategory("");
              }}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="editor-category" className="admin-label">
              Categoria *
            </label>
            <select
              id="editor-category"
              name="category_id"
              className="admin-input"
              value={category}
              required
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Selecione uma categoria</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="editor-name" className="admin-label">
            Nome do produto *
          </label>
          <input
            id="editor-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            className="admin-input"
            placeholder="Ex.: Dragon Permanente"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="editor-price" className="admin-label">
              Preço em reais *
            </label>
            <input
              id="editor-price"
              name="price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="admin-input"
              placeholder="170,00"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Use vírgula ou ponto para os centavos.
            </p>
          </div>
          <div>
            <label htmlFor="editor-stock" className="admin-label">
              Quantidade em estoque
            </label>
            <input
              id="editor-stock"
              name="stock"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={unlimited}
              className="admin-input disabled:opacity-40"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => setUnlimited(e.target.checked)}
              />{" "}
              Estoque ilimitado
            </label>
            <input
              type="hidden"
              name="unlimited_stock"
              value={String(unlimited)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="editor-description" className="admin-label">
            O que o cliente recebe
          </label>
          <textarea
            id="editor-description"
            name="description"
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="admin-input"
            placeholder="Descreva o item e a entrega."
          />
          <p className="mt-1 text-right text-xs text-zinc-500">
            {description.length}/2000
          </p>
        </div>
        <div>
          <p className="admin-label">Imagem</p>
          <ProductImageUpload
            key={imageKey}
            defaultValue={image}
            onChange={(url) => {
              setImage(url);
              setDirty(true);
            }}
            onUploadingChange={setUploading}
          />
        </div>
        <div>
          <label htmlFor="editor-active" className="admin-label">
            Visibilidade
          </label>
          <select
            id="editor-active"
            name="is_active"
            className="admin-input"
            value={String(active)}
            onChange={(e) => setActive(e.target.value === "true")}
          >
            <option value="false">Rascunho — oculto na loja</option>
            <option value="true">Publicado — visível na loja</option>
          </select>
        </div>
        <details className="admin-form-details">
          <summary>
            Opções avançadas <span>⌄</span>
          </summary>
          <label className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={customSlug}
              onChange={(e) => {
                setSlug(effectiveSlug);
                setCustomSlug(e.target.checked);
              }}
            />{" "}
            Definir identificador da página manualmente
          </label>
          <label htmlFor="editor-slug" className="admin-label mt-3">
            Identificador único
          </label>
          <input
            id="editor-slug"
            value={effectiveSlug}
            disabled={!customSlug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={100}
            className="admin-input disabled:opacity-50"
          />
          <p className="mt-2 break-all text-xs text-zinc-500">
            /produto/{effectiveSlug || "nome-do-produto"}
          </p>
        </details>
        {state.error && (
          <p role="alert" className="admin-error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="admin-notice">
            {state.success}
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <button
            name="save_action"
            value="stay"
            disabled={pending || uploading || !categories.length}
            onClick={() => {
              saveAction.current = "stay";
            }}
            className="btn-primary"
          >
            {pending
              ? "Salvando…"
              : currentId
                ? "Salvar produto"
                : "Cadastrar produto"}
          </button>
          <button
            name="save_action"
            value="back"
            disabled={pending || uploading || !categories.length}
            onClick={() => {
              saveAction.current = "back";
              setDirty(false);
            }}
            className="btn-secondary"
          >
            Salvar e voltar
          </button>
          {!currentId && (
            <button
              name="save_action"
              value="another"
              disabled={pending || uploading || !categories.length}
              onClick={() => {
                saveAction.current = "another";
              }}
              className="btn-secondary"
            >
              Salvar e cadastrar outro
            </button>
          )}
          <Link href={returnTo} className="btn-secondary">
            Voltar ao catálogo
          </Link>
        </div>
        {uploading && (
          <p role="status" className="text-xs text-violet-300">
            Aguarde o envio da imagem para salvar.
          </p>
        )}
      </form>
      <aside className="admin-editor-preview overflow-hidden rounded-2xl border border-white/10 bg-[#111119]">
        <div className="relative aspect-square bg-[#171321]">
          <Image
            src={image || "/images/products/placeholder.svg"}
            alt="Prévia do produto"
            fill
            sizes="280px"
            className="object-contain p-6"
          />
        </div>
        <div className="p-5">
          <p className="eyebrow">Prévia da vitrine</p>
          <h2 className="mt-2 break-words text-lg font-bold">
            {name || "Nome do produto"}
          </h2>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-400">
            {description || "Descrição do item"}
          </p>
          <strong className="mt-4 block text-xl">
            {money(parsePrice(price) ?? 0)}
          </strong>
          <p className="mt-2 text-xs text-zinc-500">
            {active ? "Publicado" : "Rascunho"} ·{" "}
            {unlimited ? "Estoque ilimitado" : `${stock || 0} unidades`}
          </p>
        </div>
      </aside>
    </div>
  );
}
