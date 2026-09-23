"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";

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
  const { addToCart, items, cartLoaded } = useCart();
  const [added, setAdded] = useState(false);
  const maximum = produto.unlimited_stock ? 99 : Math.max(0, Math.min(99, produto.stock ?? 0));
  const soldOut = maximum === 0;
  const existing = items.find(item => item.id === produto.id);
  const atLimit = cartLoaded && !!existing && existing.quantity >= maximum;
  return <div className="space-y-1.5">
    <button
      type="button"
      disabled={!cartLoaded || soldOut || atLimit}
      aria-label={soldOut ? `${produto.name} está esgotado` : atLimit ? `Limite no carrinho para ${produto.name}` : `Adicionar ${produto.name} ao carrinho`}
      onClick={() => {
        addToCart({
          id: produto.id,
          name: produto.name,
          price: Number(produto.price),
          image_url: produto.image_url ?? null,
          max_quantity: maximum,
        });
        setAdded(true);
      }}
      className={`w-full min-h-11 bg-violet-600 font-bold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 ${compact ? "rounded-lg px-2 py-2 text-[11px]" : "rounded-xl px-4 py-3 text-sm"}`}
    >
      {soldOut ? "Esgotado" : atLimit ? "Limite no carrinho" : added ? "✓ Adicionado" : compact ? "Adicionar" : "Adicionar ao carrinho"}
    </button>
    {added && <Link href="/carrinho" className="block text-center text-[11px] font-semibold text-violet-300 hover:text-white">Ver carrinho →</Link>}
  </div>;
}
