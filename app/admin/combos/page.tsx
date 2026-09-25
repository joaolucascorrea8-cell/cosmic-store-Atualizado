import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import ProductImageUpload from "@/app/admin/produtos/ProductImageUpload";
import PendingButton from "@/app/admin/components/PendingButton";
import { createCombo, toggleCombo } from "./actions";

type Product = { id:string; name:string; price:number; image_url:string|null; is_active:boolean };
type ComboItem = { quantity:number; products:{name:string}|{name:string}[]|null };
type Combo = { id:string; name:string; slug:string; price:number; compare_at_price:number; image_url:string|null; is_active:boolean; starts_at:string|null; ends_at:string|null; combo_items:ComboItem[]|null };
const money = (value:number) => Number(value).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});

export default async function AdminCombos({searchParams}:{searchParams:Promise<{created?:string}>}) {
  await requireAdmin();
  const params = await searchParams;
  const admin = createAdminClient();
  const [{data:products},{data:combos}] = await Promise.all([
    admin.from("products").select("id,name,price,image_url,is_active").order("display_order").order("name"),
    admin.from("combos").select("id,name,slug,price,compare_at_price,image_url,is_active,starts_at,ends_at,combo_items(quantity,products(name))").order("created_at",{ascending:false}),
  ]);
  const productRows=(products??[]) as Product[];
  const comboRows=(combos??[]) as unknown as Combo[];
  return <main className="admin-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">PACOTES PROMOCIONAIS</p><h1 className="admin-title">Combos</h1><p className="admin-description">Agrupe produtos, defina um preço especial e depois transforme o combo em uma campanha.</p></div><Link href="/admin/campanhas" className="btn-secondary">Ir para campanhas ↗</Link></div>
    {params.created&&<p role="status" className="admin-notice mt-5">Combo criado com sucesso. <Link className="font-black underline" href={`/admin/campanhas?source=combo:${params.created}`}>Criar campanha agora ↗</Link></p>}
    <section className="admin-panel mt-6" id="novo-combo"><div className="admin-panel-heading"><div><h2>Novo combo</h2><p>A soma normal é calculada automaticamente pelos produtos selecionados.</p></div></div>
      <form action={createCombo} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="admin-label" htmlFor="combo-name">Nome do combo</label><input id="combo-name" name="name" className="admin-input" minLength={2} maxLength={120} placeholder="Ex.: Combo Dragon + Gamepass" required/></div><div><label className="admin-label" htmlFor="combo-slug">Identificador (URL)</label><input id="combo-slug" name="slug" className="admin-input" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="combo-dragon-gamepass" required/></div></div>
        <div><label className="admin-label" htmlFor="combo-description">Descrição</label><textarea id="combo-description" name="description" className="admin-input min-h-28" maxLength={3000} placeholder="Explique o que o cliente recebe neste combo."/></div>
        <div className="grid gap-4 sm:grid-cols-3"><div><label className="admin-label" htmlFor="combo-price">Preço do combo</label><input id="combo-price" name="price" className="admin-input" type="number" min="0.01" step="0.01" required/></div><div><label className="admin-label" htmlFor="combo-start">Começa em (opcional)</label><input id="combo-start" name="starts_at" className="admin-input" type="datetime-local"/></div><div><label className="admin-label" htmlFor="combo-end">Termina em (opcional)</label><input id="combo-end" name="ends_at" className="admin-input" type="datetime-local"/></div></div>
        <div><label className="admin-label">Imagem/capa do combo (opcional)</label><ProductImageUpload inputId="combo_image_url"/></div>
        <div><div className="flex items-end justify-between gap-4"><div><label className="admin-label">Produtos do combo</label><p className="text-xs text-zinc-500">Marque os itens e ajuste a quantidade. A loja usa o estoque real deles na confirmação do pagamento.</p></div></div><div className="mt-3 max-h-[420px] space-y-2 overflow-auto rounded-xl border border-white/10 p-2">{productRows.map(product=><label key={product.id} className={`flex items-center gap-3 rounded-xl border p-3 ${product.is_active?"border-white/10 bg-white/[.02]":"border-amber-500/20 bg-amber-500/5 opacity-70"}`}><input type="checkbox" name="product_ids" value={product.id} className="h-4 w-4 accent-violet-500"/><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/20"><Image src={product.image_url||"/images/products/placeholder.svg"} alt="" fill sizes="48px" className="object-contain p-1"/></div><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{product.name}</strong><small className="text-zinc-500">{money(product.price)}{!product.is_active?" · inativo":""}</small></span><span className="flex items-center gap-2 text-xs text-zinc-400">Qtd.<input name={`qty_${product.id}`} defaultValue="1" type="number" min="1" max="99" className="w-16 rounded-lg border border-white/10 bg-[#080812] px-2 py-2 text-center text-white"/></span></label>)}</div></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="is_active" value="true" defaultChecked className="accent-violet-500"/>Publicar combo imediatamente</label><PendingButton className="btn-primary">Criar combo</PendingButton></div>
      </form>
    </section>
    <section className="admin-panel mt-6"><div className="admin-panel-heading"><div><h2>Combos cadastrados</h2><p>{comboRows.length} combo(s).</p></div></div><div className="mt-5 space-y-3">{comboRows.map(combo=>{const items=(combo.combo_items??[]).map(item=>{const p=Array.isArray(item.products)?item.products[0]:item.products;return `${item.quantity}× ${p?.name??"Produto"}`;});return <article key={combo.id} className="admin-product-row"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-violet-500/10"><Image src={combo.image_url||"/images/products/placeholder.svg"} alt="" fill sizes="64px" className="object-contain p-1"/></div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black">{combo.name}</h3><p className="mt-1 line-clamp-1 text-xs text-zinc-500">{items.join(" · ")}</p><p className="mt-1 text-xs"><span className="text-zinc-500 line-through">{money(combo.compare_at_price)}</span> <strong className="ml-2 text-violet-200">{money(combo.price)}</strong> · <span className={combo.is_active?"text-emerald-300":"text-amber-300"}>{combo.is_active?"Publicado":"Inativo"}</span></p></div><div className="flex shrink-0 flex-wrap justify-end gap-2"><Link href={`/combo/${combo.slug}`} className="admin-small-button">Ver ↗</Link><Link href={`/admin/campanhas?source=combo:${combo.id}`} className="admin-small-button">Criar campanha</Link><form action={toggleCombo}><input type="hidden" name="combo_id" value={combo.id}/><input type="hidden" name="active" value={String(!combo.is_active)}/><PendingButton className="admin-small-button">{combo.is_active?"Desativar":"Ativar"}</PendingButton></form></div></article>})}{!comboRows.length&&<p className="admin-empty">Nenhum combo criado ainda.</p>}</div></section>
  </main>;
}
