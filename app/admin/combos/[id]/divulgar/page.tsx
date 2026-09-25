import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PendingButton from "@/app/admin/components/PendingButton";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildComboPromotionBody, type ComboPromotionProduct } from "@/lib/combo-promotions";
import { promoteCombo } from "../../actions";

function nested<T>(value: T | T[] | null | undefined) { return Array.isArray(value) ? value[0] : value; }
const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function DivulgarComboPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("combos").select("id,name,slug,price,compare_at_price,image_url,is_active,ends_at,combo_items(quantity,products(id,name,image_url,is_active))").eq("id", id).maybeSingle();
  if (!data) notFound();

  const products = (data.combo_items ?? []).map((item: any) => {
    const product = nested(item.products) as { id: string; name: string; image_url: string | null; is_active: boolean } | undefined;
    return product ? { id: product.id, name: product.name, image_url: product.image_url, is_active: product.is_active, quantity: Number(item.quantity) } : null;
  }).filter(Boolean) as Array<ComboPromotionProduct & { id: string; is_active: boolean }>;

  const body = buildComboPromotionBody({ comboName: data.name, products, price: Number(data.price), compareAtPrice: Number(data.compare_at_price) });
  const canPromote = data.is_active && (!data.ends_at || new Date(data.ends_at).getTime() > Date.now()) && products.every((product) => product.is_active);

  return <main className="admin-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">COMBOS</p><h1 className="admin-title">Divulgar novamente</h1><p className="admin-description">Reenvie este combo para o canal de ofertas do Discord, por e-mail, ou pelos dois.</p></div><Link href="/admin/combos" className="btn-secondary">← Voltar para combos</Link></div>

    <section className="admin-panel mt-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <form action={promoteCombo} className="space-y-5">
          <input type="hidden" name="combo_id" value={data.id} />
          <div><label className="admin-label">Combo</label><div className="rounded-xl border border-white/10 bg-[#0d0b12] p-4"><strong>{data.name}</strong><p className="mt-1 text-xs text-zinc-500"><span className="line-through">{money(Number(data.compare_at_price))}</span> <span className="ml-2 font-black text-violet-200">{money(Number(data.price))}</span></p></div></div>
          <div><label className="admin-label">Onde divulgar?</label><div className="grid gap-3 sm:grid-cols-2"><label className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 text-sm font-bold"><input type="checkbox" name="send_discord" defaultChecked className="accent-violet-500" />Discord<small className="ml-auto font-normal text-zinc-500">canal do webhook</small></label><label className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 text-sm font-bold"><input type="checkbox" name="send_email" className="accent-violet-500" />E-mail<small className="ml-auto font-normal text-zinc-500">clientes cadastrados</small></label></div></div>
          <div><label className="admin-label" htmlFor="promotion-body">Texto da divulgação</label><textarea id="promotion-body" name="promotion_body" className="admin-input min-h-72" defaultValue={body} minLength={2} maxLength={3000} required /><p className="mt-1 text-xs text-zinc-500">O link direto do combo é adicionado automaticamente.</p></div>
          {!canPromote && <p className="admin-error">Este combo precisa estar ativo, dentro da validade e com todos os produtos ativos antes de ser divulgado.</p>}
          <PendingButton className={`btn-primary ${!canPromote ? "pointer-events-none opacity-50" : ""}`}>Divulgar combo</PendingButton>
        </form>

        <aside className="rounded-2xl border border-violet-500/20 bg-[#0e0b13] p-5"><p className="eyebrow">PRÉVIA</p><h2 className="mt-2 text-2xl font-black">{data.name}</h2><p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-400">{body}</p><div className={`mt-5 grid gap-2 ${products.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{products.slice(0, 4).map((product, index) => <div key={product.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[.03] p-2"><div className="relative mx-auto aspect-square max-w-28"><Image src={product.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="112px" className="object-contain" /></div><strong className="mt-1 block truncate text-center text-xs">{product.quantity}× {product.name}</strong>{index === 3 && products.length > 4 && <span className="absolute right-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black">+{products.length - 4}</span>}</div>)}</div></aside>
      </div>
    </section>
  </main>;
}
