import Link from "next/link";
import ComboArtwork from "./ComboArtwork";
import { comboMaxQuantity, comboProduct, type ComboNestedItem } from "@/lib/combos";

type Combo = { id: string; name: string; slug: string; description: string | null; price: number; compare_at_price: number; image_url: string | null; combo_items: ComboNestedItem[] | null };
const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ComboCard({ combo }: { combo: Combo }) {
  const max = comboMaxQuantity(combo.combo_items);
  const products = (combo.combo_items ?? []).map((item) => comboProduct(item.products)).filter(Boolean).map((product) => ({ id: product!.id, name: product!.name, image_url: product!.image_url }));
  return <article className="product-tile group flex min-w-0 flex-col overflow-hidden">
    <Link href={`/combo/${combo.slug}`} className="product-tile-image relative block aspect-square overflow-hidden">
      {combo.image_url ? <img src={combo.image_url} alt={combo.name} className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-[1.05]" /> : <ComboArtwork products={products} comboName={combo.name} className="transition-transform duration-300 group-hover:scale-[1.03]" />}
      <span className="absolute left-3 top-3 rounded-md border border-violet-400/30 bg-[#160f22]/90 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200">COMBO</span>
    </Link>
    <div className="flex flex-1 flex-col p-4"><Link href={`/combo/${combo.slug}`} className="line-clamp-2 min-h-11 text-sm font-black sm:text-base">{combo.name}</Link><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-[1.15rem] text-zinc-500">{combo.description || "Pacote especial com preço promocional."}</p><div className="mt-auto border-t border-white/[.07] pt-3"><span className="block text-xs text-zinc-500 line-through">{money(combo.compare_at_price)}</span><p className="text-lg font-black text-white">{money(combo.price)}</p><p className={`mt-1 text-[11px] ${max > 0 ? "text-emerald-300" : "text-amber-300"}`}>{max > 0 ? "Disponível" : "Indisponível"}</p></div></div>
  </article>;
}
