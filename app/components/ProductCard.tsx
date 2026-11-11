import ProductIdentity from "./ProductIdentity";
import { productLabel, type ProductContext } from "@/lib/product-context";
import ProductPreferenceButton from "./ProductPreferenceButton";
import Image from "@/app/components/StoreImage";
import Link from "next/link";
import AddToCartButton from "@/app/components/AddToCartButton";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  slug: string;
  image_url?: string | null;
  stock?: number;
  unlimited_stock?: boolean;
};

export default function ProductCard({ produto, context }: { produto: Product; context?: ProductContext | null }) {
  const soldOut = !produto.unlimited_stock && Number(produto.stock ?? 0) <= 0;
  return (
    <article className="product-tile group relative flex min-w-0 flex-col overflow-hidden">
      <Link
        href={`/produto/${produto.slug}`}
        prefetch={false}
        className="product-tile-image relative block aspect-square overflow-hidden"
        aria-label={`Ver ${productLabel(produto.name, context)}`}
      >
        <Image
          src={produto.image_url || "/images/products/placeholder.svg"}
          alt={produto.name}
          fill
          sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw"
          className="object-contain p-5 transition-transform duration-300 group-hover:scale-[1.06]"
        />
        <span
          className={`absolute left-3 top-3 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${soldOut ? "bg-zinc-800 text-zinc-300" : "border border-emerald-400/20 bg-[#11291e] text-emerald-300"}`}
        >
          {soldOut ? "Esgotado" : "Disponível"}
        </span>
      </Link>
      <div className="absolute right-2 top-2 z-10">
        <ProductPreferenceButton id={produto.id} compact />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Link
          href={`/produto/${produto.slug}`}
        prefetch={false}
          className="product-name line-clamp-2 min-h-11 text-sm font-bold leading-5 transition hover:text-violet-300 sm:text-base"
        >
          {produto.name}
        </Link>
        <ProductIdentity context={context} />
        <p className="product-description mt-1 line-clamp-2 min-h-9 text-xs leading-[1.15rem] text-zinc-500">
          {produto.description || "Item digital para o seu jogo."}
        </p>
        <div className="mt-auto border-t border-white/[.07] pt-3">
          <p className="mb-3 text-lg font-black tracking-tight text-white">
            {Number(produto.price).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
          <AddToCartButton produto={produto} context={context} compact />
        </div>
      </div>
    </article>
  );
}
