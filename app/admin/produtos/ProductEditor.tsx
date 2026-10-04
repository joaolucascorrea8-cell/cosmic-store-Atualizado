"use client";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProduct, type ProductEditorState } from "../actions";
import { money, parsePrice, slugify } from "@/lib/catalog";
import { applyDescriptionTemplate } from "@/lib/description-templates";
import { robuxPrice, readRobuxRate } from "@/lib/robux-pricing";
import ProductImageUpload from "./ProductImageUpload";
type Product = {
  id?: string;
  name: string;
  slug: string;
  category_id: string;
  description: string | null;
  delivery_hours?: number | null;
  delivery_instructions?: string;
  robux_quantity?: number | null;
  pricing_locked?: boolean;
  pricing_rate?: number | null;
  ops_version?: number;
  low_stock_threshold?: number;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  image_url: string | null;
  is_active: boolean;
};
type Category = {
  id: string;
  name: string;
  game_id: string;
  description_template?: string;
};
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
  const [deliveryHours, setDeliveryHours] = useState(
    String(product?.delivery_hours ?? ""),
  );
  const [instructions, setInstructions] = useState(
    product?.delivery_instructions ?? "",
  );
  const [robux, setRobux] = useState(String(product?.robux_quantity ?? ""));
  const [baseRate, setBaseRate] = useState(String(product?.pricing_rate ?? ""));
  const [revision, setRevision] = useState(product?.ops_version ?? 0);
  const [calcRate, setCalcRate] = useState("34,00");
  const [locked, setLocked] = useState(product?.pricing_locked ?? false);
  const [lowStock, setLowStock] = useState(
    String(product?.low_stock_threshold ?? 2),
  );
  const [calcError, setCalcError] = useState("");
  const template = categories.find(
    (c) => c.id === category,
  )?.description_template;
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
        setDeliveryHours("");
        setBaseRate("");
        setRevision(0);
        setInstructions("");
        setRobux("");
        setLocked(false);
        setLowStock("2");
        setCalcError("");
        setImage("");
        setImageKey((key) => key + 1);
        setCustomSlug(false);
        setSlug("");
      } else if (state.id) {
        setCurrentId(state.id);
        setRevision((old) => state.revision ?? old);
        if (state.locked !== undefined) setLocked(state.locked);
        if (state.rate !== undefined) setBaseRate(String(state.rate ?? ""));
      }
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
        <input type="hidden" name="ops_version" value={revision} />
        <input type="hidden" name="pricing_rate" value={baseRate} />
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
              onChange={(e) => {
                setPrice(e.target.value);
                if (currentId) setLocked(true);
              }}
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
          <label htmlFor="editor-delivery" className="admin-label">
            Prazo de entrega em horas (opcional)
          </label>
          <input
            id="editor-delivery"
            name="delivery_hours"
            type="number"
            min={1}
            max={720}
            value={deliveryHours}
            onChange={(e) => setDeliveryHours(e.target.value)}
            className="admin-input"
            placeholder="Usar o prazo do jogo ou da loja"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Horas corridas após a confirmação do pagamento.
          </p>
        </div>

        <details className="rounded-xl border border-white/10 p-4">
          <summary className="cursor-pointer font-bold">
            Preço por Robux e estoque
          </summary>
          <p className="mt-3 text-xs text-zinc-400">
            A cotação acompanha a tabela do bot, incluindo os itens abaixo de
            1K. Reajustes por categoria ficam em Produtos → Preços por Robux.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="admin-label">
              Quantidade de Robux (opcional)
              <input
                name="robux_quantity"
                type="number"
                min="1"
                max="1000000"
                className="admin-input mt-2"
                value={robux}
                onChange={(e) => setRobux(e.target.value)}
              />
            </label>
            <label className="admin-label">
              Cotação de 1K para calcular (R$)
              <input
                className="admin-input mt-2"
                inputMode="decimal"
                value={calcRate}
                onChange={(e) => setCalcRate(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="admin-small-button mt-3"
            onClick={() => {
              const rate = readRobuxRate(calcRate);
              try {
                if (!rate) throw new Error("Confira a cotação.");
                const amount = robuxPrice(Number(robux), rate);
                if (
                  price &&
                  !confirm("Substituir o preço pelo valor calculado?")
                )
                  return;
                setPrice(amount.toFixed(2).replace(".", ","));
                setBaseRate(String(rate));
                if (currentId) setLocked(true);
                setDirty(true);
                setCalcError("");
              } catch (e) {
                setCalcError(
                  e instanceof Error ? e.message : "Confira os valores.",
                );
              }
            }}
          >
            Usar preço calculado
          </button>
          {calcError && (
            <p role="alert" className="admin-error mt-3">
              {calcError}
            </p>
          )}
          <input type="hidden" name="pricing_locked" value={String(locked)} />
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setLocked(e.target.checked)}
            />
            Proteger este produto dos reajustes por categoria
          </label>
          <p className="mt-2 text-xs text-zinc-400">
            Alterar o preço de um produto existente ativa essa proteção. Salve
            primeiro e, se desejar voltar aos reajustes, desmarque a proteção e
            salve novamente.
          </p>
          <label className="admin-label mt-4 block">
            Avisar estoque baixo a partir de
            <input
              name="low_stock_threshold"
              type="number"
              min="0"
              max="100000"
              className="admin-input mt-2"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
          </label>
        </details>
        <label className="admin-label block">
          Instruções de entrega deste produto
          <textarea
            name="delivery_instructions"
            maxLength={2000}
            rows={4}
            className="admin-input mt-2"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Servidor para entrar, requisitos e como receber o item."
          />
          <span className="mt-2 block text-xs font-normal text-zinc-400">
            Vazio usa as instruções do jogo. A orientação fica registrada nos
            novos pedidos.
          </span>
        </label>
        <div>
          <label htmlFor="editor-description" className="admin-label">
            O que o cliente recebe
          </label>
          {template && (
            <button
              type="button"
              className="admin-small-button mb-2"
              onClick={() => {
                if (
                  description &&
                  !window.confirm(
                    "Substituir a descrição atual pelo modelo desta categoria?",
                  )
                )
                  return;
                setDescription(
                  applyDescriptionTemplate(
                    template,
                    name,
                    games.find((g) => g.id === game)?.name ?? "",
                  ),
                );
                setDirty(true);
              }}
            >
              Usar modelo da categoria
            </button>
          )}
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
