'use client';
import Link from 'next/link';
import { useCart } from '@/app/context/CartContext';

export default function CartButton() {
  const { totalItems } = useCart();

  return (
    <Link 
      href="/carrinho" 
      aria-label={`Carrinho, ${totalItems} ${totalItems === 1 ? "item" : "itens"}`}
      className="relative flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
    >
      <span aria-hidden="true">🛒</span>
      <span className="hidden sm:inline">Carrinho</span>
      {totalItems > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[11px] font-extrabold text-white">
          {totalItems}
        </span>
      )}
    </Link>
  );
}
