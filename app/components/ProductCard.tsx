import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/app/components/AddToCartButton";

type Product = { id: string; name: string; description: string; price: number; slug: string; image_url?: string | null; stock?: number; unlimited_stock?: boolean };

export default function ProductCard({ produto }: { produto: Product }) {
  const soldOut = !produto.unlimited_stock && Number(produto.stock ?? 0) <= 0;
  return <article className="product-tile group flex min-w-0 flex-col overflow-hidden">
    <Link href={`/produto/${produto.slug}`} className="product-tile-image relative block aspect-square overflow-hidden" aria-label={`Ver ${produto.name}`}><Image src={produto.image_url || "/images/products/placeholder.svg"} alt={produto.name} fill sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw" className="object-contain p-5 transition-transform duration-300 group-hover:scale-[1.06]" /><span className={`absolute left-3 top-3 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${soldOut ? "bg-zinc-800 text-zinc-300" : "border border-emerald-400/20 bg-[#11291e] text-emerald-300"}`}>{soldOut ? "Esgotado" : "Disponível"}</span></Link>
    <div className="flex flex-1 flex-col p-4"><Link href={`/produto/${produto.slug}`} className="line-clamp-2 min-h-11 text-sm font-bold leading-5 transition hover:text-violet-300 sm:text-base">{produto.name}</Link><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-[1.15rem] text-zinc-500">{produto.description || "Item digital para o seu jogo."}</p><div className="mt-auto border-t border-white/[.07] pt-3"><p className="mb-3 text-lg font-black tracking-tight text-white">{Number(produto.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p><AddToCartButton produto={produto} compact /></div></div>
  </article>;
}
