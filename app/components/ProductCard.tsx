import Image from 'next/image';
import Link from 'next/link';
import AddToCartButton from '@/app/components/AddToCartButton';


interface ProductCardProps {
  produto: {
    id: string;
    name: string;        // Ajustado para inglês
    description: string; // Ajustado para inglês
    price: number;       // Ajustado para inglês
    slug: string;
    image_url?: string | null;
    stock?: number;
    unlimited_stock?: boolean;
  };
}

export default function ProductCard({ produto }: ProductCardProps) {
  return (
    <article className="card-hover surface group flex min-w-0 flex-col overflow-hidden rounded-2xl text-white">
      
      {/* Imagem Quadrada Compacta (Vitrine Profissional) */}
      <Link href={`/produto/${produto.slug}`} aria-hidden="true" tabIndex={-1} className="relative block aspect-square w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(139,92,246,.26),transparent_58%),#171020]">
        <Image 
          src={produto.image_url || '/images/products/placeholder.svg'} 
          alt=""
          fill
          sizes="(max-width: 639px) 50vw, (max-width: 899px) 33vw, (max-width: 1199px) 25vw, (max-width: 1499px) 17vw, 12.5vw"
          className="object-contain p-3 transition-transform duration-500 group-hover:scale-108"
        />
      </Link>
      
      {/* Textos Informativos */}
      <div className="flex flex-1 flex-col border-t border-white/[.06] p-3">
        <span className="truncate text-xs font-bold uppercase tracking-wider text-violet-400">
          {produto.unlimited_stock ? "Estoque ilimitado" : `${produto.stock ?? 0} disponíveis`}
        </span>
        <Link href={`/produto/${produto.slug}`} className="mt-1.5 line-clamp-2 min-h-10 text-sm font-black hover:text-violet-300">
          {produto.name}
        </Link>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-xs leading-5 text-zinc-400">
          {produto.description || 'Sem descrição disponível.'}
        </p>
        <p className="mt-3 text-sm font-extrabold">{Number(produto.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        <div className="mt-2"><AddToCartButton produto={produto} compact /></div>
      </div>
    </article>
  );
}
