import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import PendingButton from "@/app/admin/components/PendingButton";
import ComboArtwork from "@/app/components/ComboArtwork";
import ComboBuilder from "./ComboBuilder";
import { toggleCombo } from "./actions";

type Product = { id: string; name: string; price: number; image_url: string | null; is_active: boolean; category_id: string | null };
type Category = { id: string; name: string; game_id: string | null };
type Game = { id: string; name: string };
type ComboItem = { quantity: number; products: { id: string; name: string; image_url: string | null } | { id: string; name: string; image_url: string | null }[] | null };
type Combo = { id: string; name: string; slug: string; price: number; compare_at_price: number; image_url: string | null; is_active: boolean; ends_at: string | null; combo_items: ComboItem[] | null };

const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function nested<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCombos({ searchParams }: { searchParams: Promise<{ created?: string; message?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const admin = createAdminClient();

  const [{ data: products }, { data: categories }, { data: games }, { data: combos }] = await Promise.all([
    admin.from("products").select("id,name,price,image_url,is_active,category_id").order("display_order").order("name"),
    admin.from("categories").select("id,name,game_id,display_order").order("display_order", { ascending: true }).order("name"),
    admin.from("games").select("id,name,display_order").order("display_order", { ascending: true }).order("name"),
    admin.from("combos").select("id,name,slug,price,compare_at_price,image_url,is_active,ends_at,combo_items(quantity,products(id,name,image_url))").order("created_at", { ascending: false }),
  ]);

  const productRows = (products ?? []) as Product[];
  const categoryRows = (categories ?? []) as Category[];
  const gameRows = (games ?? []) as Game[];
  const comboRows = (combos ?? []) as unknown as Combo[];

  return <main className="admin-page">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">PACOTES PROMOCIONAIS</p><h1 className="admin-title">Combos</h1><p className="admin-description">Crie o pacote, escolha os produtos, defina o preço e, se quiser, divulgue no Discord e por e-mail na mesma tela.</p></div>
      <Link href="/combos" className="btn-secondary">Ver combos na loja ↗</Link>
    </div>

    {(params.created || params.message) && <div role="status" className="admin-notice mt-5"><strong>{params.created ? "Combo criado com sucesso." : "Atualização concluída."}</strong>{params.message && <span className="mt-1 block text-sm">{params.message}</span>}</div>}

    <section className="admin-panel mt-6" id="novo-combo">
      <div className="admin-panel-heading"><div><h2>Novo combo</h2><p>A divulgação fica no próprio combo para manter o painel simples e organizado.</p></div></div>
      <div className="mt-5"><ComboBuilder products={productRows} categories={categoryRows} games={gameRows} /></div>
    </section>

    <section className="admin-panel mt-6">
      <div className="admin-panel-heading"><div><h2>Combos cadastrados</h2><p>{comboRows.length} combo(s). Use “Divulgar novamente” quando quiser anunciar um combo já criado.</p></div></div>
      <div className="mt-5 space-y-3">
        {comboRows.map((combo) => {
          const itemRows = (combo.combo_items ?? []).map((item) => ({ quantity: item.quantity, product: nested(item.products) })).filter((row) => row.product);
          const items = itemRows.map((row) => `${row.quantity}× ${row.product!.name}`);
          const artProducts = itemRows.map((row) => row.product!).filter(Boolean);
          return <article key={combo.id} className="admin-product-row">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-violet-500/[.05]">
              {combo.image_url ? <img src={combo.image_url} alt="" className="h-full w-full object-contain p-1" /> : <ComboArtwork products={artProducts} comboName={combo.name} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black">{combo.name}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${combo.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{combo.is_active ? "Publicado" : "Inativo"}</span></div>
              <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{items.join(" · ")}</p>
              <p className="mt-1 text-xs"><span className="text-zinc-500 line-through">{money(combo.compare_at_price)}</span> <strong className="ml-2 text-violet-200">{money(combo.price)}</strong>{combo.ends_at && <span className="ml-2 text-zinc-500">· termina {new Date(combo.ends_at).toLocaleDateString("pt-BR")}</span>}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Link href={`/combo/${combo.slug}`} className="admin-small-button">Ver ↗</Link>
              <Link href={`/admin/combos/${combo.id}/divulgar`} className="admin-small-button">Divulgar novamente</Link>
              <form action={toggleCombo}><input type="hidden" name="combo_id" value={combo.id} /><input type="hidden" name="active" value={String(!combo.is_active)} /><PendingButton className="admin-small-button">{combo.is_active ? "Desativar" : "Ativar"}</PendingButton></form>
            </div>
          </article>;
        })}
        {!comboRows.length && <p className="admin-empty">Nenhum combo criado ainda.</p>}
      </div>
    </section>
  </main>;
}
