'use client';
import { useCart } from '@/app/context/CartContext';

interface AddToCartButtonProps {
  produto: {
    id: string;
    name: string;
    price: number;
    image_url?: string | null;
    stock?: number;
    unlimited_stock?: boolean;
  };
  compact?: boolean;
}

export default function AddToCartButton({ produto, compact = false }: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const soldOut = !produto.unlimited_stock && (produto.stock ?? 0) <= 0;

  return (
    <button
      type="button"
      disabled={soldOut}
      aria-label={soldOut ? `${produto.name} está esgotado` : `Adicionar ${produto.name} ao carrinho`}
      onClick={() => addToCart({
        id: produto.id,
        name: produto.name,
        price: Number(produto.price),
        image_url: produto.image_url ?? null,
      })}
      className={`w-full min-h-11 bg-violet-600 font-bold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 ${
        compact
          ? "rounded-lg px-2 py-2 text-[11px]"
          : "rounded-xl px-4 py-3 text-sm"
      }`}
    >
      {soldOut ? "Esgotado" : compact ? "Adicionar" : "Adicionar ao carrinho"}
    </button>
  );
}
