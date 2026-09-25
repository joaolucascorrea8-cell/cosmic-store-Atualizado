"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import ProductImageUpload from "@/app/admin/produtos/ProductImageUpload";
import PendingButton from "@/app/admin/components/PendingButton";
import { createCombo } from "./actions";

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  category_id: string | null;
};

type Category = { id: string; name: string; game_id: string | null };
type Game = { id: string; name: string };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function matchesName(name: string, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  const normalizedName = normalize(name);
  if (normalizedQuery.includes(" ")) return normalizedName.includes(normalizedQuery);
  return normalizedName.split(/\s+/).some((word) => word.startsWith(normalizedQuery));
}

const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ComboBuilder({ products, categories, games }: { products: Product[]; categories: Category[]; games: Game[] }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [gameId, setGameId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sendEmail, setSendEmail] = useState(false);
  const [sendDiscord, setSendDiscord] = useState(false);
  const [promotionEdited, setPromotionEdited] = useState(false);
  const [customPromotion, setCustomPromotion] = useState("");

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const filteredCategories = useMemo(() => categories.filter((category) => !gameId || category.game_id === gameId), [categories, gameId]);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const category = product.category_id ? categoryMap.get(product.category_id) : undefined;
    const matchesGame = !gameId || category?.game_id === gameId;
    const matchesCategory = !categoryId || product.category_id === categoryId;
    const matchesStatus = status === "all" || (status === "active" ? product.is_active : !product.is_active);
    return matchesName(product.name, query) && matchesGame && matchesCategory && matchesStatus;
  }), [products, categoryMap, query, status, gameId, categoryId]);

  const selectedProducts = useMemo(() => products.filter((product) => selectedIds.has(product.id)), [products, selectedIds]);
  const compareAtPrice = useMemo(() => selectedProducts.reduce((sum, product) => sum + Number(product.price) * (quantities[product.id] ?? 1), 0), [selectedProducts, quantities]);
  const comboPrice = Number(price) || 0;
  const saving = Math.max(0, compareAtPrice - comboPrice);

  const automaticPromotion = useMemo(() => {
    const items = selectedProducts.map((product) => `• ${quantities[product.id] ?? 1}× ${product.name}`).join("\n");
    const priceLine = comboPrice > 0
      ? compareAtPrice > comboPrice ? `De ${money(compareAtPrice)} por ${money(comboPrice)}` : `Por ${money(comboPrice)}`
      : "Preço especial do combo";
    return `🌌 COSMIC STORE — NOVO COMBO! 🚀\n\n🔥 ${name || "Novo combo"}\n\nUma nova oferta acabou de chegar na Cosmic Store!\n\n${items || "• Selecione os produtos do combo"}\n\n${priceLine}\n\n⏳ Aproveite enquanto estiver disponível.\n\n💬 Precisou de ajuda? Fale com nossa equipe pelo suporte da loja.`;
  }, [selectedProducts, quantities, comboPrice, compareAtPrice, name]);

  const promotionText = promotionEdited ? customPromotion : automaticPromotion;
  const previewProducts = selectedProducts.slice(0, 4);

  return <form action={createCombo} className="space-y-6">
    <section className="rounded-2xl border border-white/10 bg-white/[.02] p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">1</span><div><h3 className="font-black">Informações do combo</h3><p className="mt-1 text-xs leading-5 text-zinc-500">O link é criado automaticamente pelo nome. O combo começa a valer assim que for publicado.</p></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><label className="admin-label" htmlFor="combo-name">Nome do combo</label><input id="combo-name" name="name" className="admin-input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} placeholder="Ex.: Combo Dragon + Gamepass" required /></div>
        <div><label className="admin-label" htmlFor="combo-price">Preço do combo</label><input id="combo-price" name="price" className="admin-input" value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0.01" step="0.01" placeholder="0,00" required /></div>
      </div>
      <div className="mt-4"><label className="admin-label" htmlFor="combo-description">O que o cliente recebe?</label><textarea id="combo-description" name="description" className="admin-input min-h-28" maxLength={3000} placeholder="Explique o combo de forma simples: itens incluídos, observações de entrega e o que o cliente recebe." /></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_260px]">
        <div><label className="admin-label">Capa do combo <span className="font-normal text-zinc-500">(opcional)</span></label><ProductImageUpload inputId="combo_image_url" /><p className="mt-2 text-xs leading-5 text-zinc-500">A capa é a arte principal do combo. Se você não enviar uma, a loja monta a apresentação automaticamente com as imagens dos produtos selecionados.</p></div>
        <div className="rounded-xl border border-white/10 bg-[#0d0b12] p-4"><p className="text-xs font-black uppercase tracking-wider text-zinc-500">Validade</p><strong className="mt-2 block text-sm">Começa: agora</strong><p className="mt-1 text-xs text-zinc-500">Sem precisar preencher data inicial.</p><label className="admin-label mt-4" htmlFor="combo-end">Termina em <span className="font-normal text-zinc-500">(opcional)</span></label><input id="combo-end" name="ends_at" className="admin-input" type="datetime-local" /><p className="mt-1 text-[11px] text-zinc-500">Deixe vazio se o combo não tiver data para acabar.</p></div>
      </div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">2</span><div><h3 className="font-black">Produtos do combo</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Busque por nome e refine por jogo, categoria ou status. Itens marcados continuam selecionados enquanto você procura outros.</p></div></div><span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-xs font-bold text-zinc-300">{selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}</span></div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_180px_210px_170px]">
        <div className="relative"><input className="admin-input pr-10" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome: D, DR, DRA, Dragon..." autoComplete="off" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500 hover:text-white">×</button>}</div>
        {games.length > 1 ? <select className="admin-input" value={gameId} onChange={(event) => { setGameId(event.target.value); setCategoryId(""); }}><option value="">Todos os jogos</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select> : <div className="flex min-h-12 items-center rounded-xl border border-white/10 bg-white/[.025] px-3 text-sm font-bold text-zinc-300">{games[0]?.name ?? "Todos os jogos"}</div>}
        <select className="admin-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas as categorias</option>{filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Ativos e inativos</option><option value="active">Somente ativos</option><option value="inactive">Somente inativos</option></select>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500"><span>{visibleProducts.length} produto{visibleProducts.length === 1 ? "" : "s"} encontrado{visibleProducts.length === 1 ? "" : "s"}</span><span>Busca atualiza a lista a cada letra digitada.</span></div>

      <div className="mt-3 max-h-[460px] space-y-2 overflow-auto rounded-xl border border-white/10 p-2">
        {products.map((product) => {
          const visible = visibleProducts.some((item) => item.id === product.id);
          const checked = selectedIds.has(product.id);
          return <label key={product.id} className={`${visible ? "flex" : "hidden"} items-center gap-3 rounded-xl border p-3 ${checked ? "border-violet-500/40 bg-violet-500/[.08]" : product.is_active ? "border-white/10 bg-white/[.02]" : "border-amber-500/20 bg-amber-500/5 opacity-70"}`}>
            <input type="checkbox" name="product_ids" value={product.id} checked={checked} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(product.id); else next.delete(product.id); return next; })} className="h-4 w-4 accent-violet-500" />
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/20"><Image src={product.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="48px" className="object-contain p-1" /></div>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{product.name}</strong><small className="text-zinc-500">{money(product.price)}{!product.is_active ? " · inativo" : ""}</small></span>
            <span className="flex items-center gap-2 text-xs text-zinc-400">Qtd.<input name={`qty_${product.id}`} value={quantities[product.id] ?? 1} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.max(1, Math.min(99, Number(event.target.value) || 1)) }))} type="number" min="1" max="99" className="w-16 rounded-lg border border-white/10 bg-[#080812] px-2 py-2 text-center text-white" /></span>
          </label>;
        })}
        {visibleProducts.length === 0 && <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">Nenhum produto com esses filtros.</div>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-[#0d0b12] p-3"><span className="text-[11px] uppercase tracking-wider text-zinc-500">Separadamente</span><strong className="mt-1 block">{money(compareAtPrice)}</strong></div><div className="rounded-xl border border-violet-500/20 bg-violet-500/[.05] p-3"><span className="text-[11px] uppercase tracking-wider text-zinc-500">Preço do combo</span><strong className="mt-1 block text-violet-200">{comboPrice ? money(comboPrice) : "—"}</strong></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] p-3"><span className="text-[11px] uppercase tracking-wider text-zinc-500">Economia</span><strong className="mt-1 block text-emerald-300">{comboPrice && saving > 0 ? money(saving) : "—"}</strong></div></div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.02] p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">3</span><div><h3 className="font-black">Publicação e divulgação</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Criar o combo já pode publicá-lo na loja e divulgar no canal do Discord e/ou por e-mail. A divulgação fica aqui no próprio combo.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-[#0d0b12] px-4 text-sm font-bold"><input type="checkbox" name="is_active" defaultChecked className="accent-violet-500" /><span>Publicar combo imediatamente<small className="mt-1 block font-normal text-zinc-500">Ele já aparece em /combos.</small></span></label>
        <label className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-sm font-bold ${sendDiscord ? "border-violet-500/40 bg-violet-500/[.08]" : "border-white/10 bg-[#0d0b12]"}`}><input type="checkbox" name="send_discord" checked={sendDiscord} onChange={(event) => setSendDiscord(event.target.checked)} className="accent-violet-500" /><span>Divulgar no Discord<small className="mt-1 block font-normal text-zinc-500">Publica no canal do webhook.</small></span></label>
        <label className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-sm font-bold ${sendEmail ? "border-violet-500/40 bg-violet-500/[.08]" : "border-white/10 bg-[#0d0b12]"}`}><input type="checkbox" name="send_email" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="accent-violet-500" /><span>Divulgar por e-mail<small className="mt-1 block font-normal text-zinc-500">Envia aos clientes cadastrados.</small></span></label>
      </div>

      {(sendEmail || sendDiscord) && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <div><div className="flex flex-wrap items-center justify-between gap-2"><label className="admin-label" htmlFor="promotion-body">Texto da divulgação</label><button type="button" onClick={() => { setPromotionEdited(false); setCustomPromotion(""); }} className="text-xs font-bold text-violet-300 hover:text-violet-200">Restaurar texto automático</button></div><textarea id="promotion-body" name="promotion_body" className="admin-input min-h-64" value={promotionText} onChange={(event) => { setPromotionEdited(true); setCustomPromotion(event.target.value); }} maxLength={3000} required /><p className="mt-1 text-xs text-zinc-500">O link direto do combo é acrescentado automaticamente no Discord e no e-mail.</p></div>
        <div className="rounded-2xl border border-violet-500/20 bg-[#0e0b13] p-4"><p className="eyebrow">PRÉVIA RÁPIDA</p><h4 className="mt-2 text-xl font-black">{name || "Nome do combo"}</h4><p className="mt-3 whitespace-pre-line text-xs leading-5 text-zinc-400">{promotionText}</p>{previewProducts.length > 0 && <div className={`mt-4 grid gap-2 ${previewProducts.length === 1 ? "grid-cols-1" : previewProducts.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>{previewProducts.map((product, index) => <div key={product.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[.03] p-2"><div className="relative mx-auto aspect-square max-w-24"><Image src={product.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="96px" className="object-contain" /></div><strong className="mt-1 block truncate text-center text-[11px]">{quantities[product.id] ?? 1}× {product.name}</strong>{index === 3 && selectedProducts.length > 4 && <span className="absolute right-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black">+{selectedProducts.length - 4}</span>}</div>)}</div>}<div className="mt-4 border-t border-white/10 pt-3"><span className="text-xs text-zinc-500 line-through">{compareAtPrice > comboPrice && comboPrice > 0 ? money(compareAtPrice) : ""}</span><strong className="block text-xl">{comboPrice ? money(comboPrice) : "Preço do combo"}</strong></div></div>
      </div>}
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[.05] p-4"><div><strong className="text-sm">Pronto para criar?</strong><p className="mt-1 text-xs text-zinc-500">Se E-mail/Discord estiverem marcados, a divulgação acontece junto com a criação.</p></div><PendingButton className="btn-primary">Criar combo</PendingButton></div>
  </form>;
}
