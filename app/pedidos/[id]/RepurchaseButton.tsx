"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/app/context/CartContext";
import type { CartItem } from "@/lib/cart";
export default function RepurchaseButton({ orderId }: { orderId: string }) {
  const { cartLoaded, addItemsToCart } = useCart();
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<string[] | null>(null),
    [error, setError] = useState("");
  return (
    <div className="mt-5 rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-xs leading-6 text-zinc-400">
          Quer repetir a compra? Conferimos os preços e o estoque atuais. Cupons
          anteriores não são reaplicados.
        </p>
        <button
          disabled={busy || !cartLoaded || result !== null}
          className="btn-secondary"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const response = await fetch(
                `/api/orders/${orderId}/repurchase`,
                { cache: "no-store" },
              );
              const data = await response.json();
              if (!response.ok)
                throw new Error(
                  data.error ?? "Não foi possível repetir a compra.",
                );
              const added = addItemsToCart(data.items as CartItem[]);
              setResult([
                added
                  ? `${added} unidade(s) adicionada(s) ao carrinho com os valores atuais.`
                  : "Nenhum item foi adicionado. Confira o estoque ou os limites do carrinho.",
                ...(data.warnings ?? []),
              ]);
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Confira sua conexão.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Conferindo itens…" : "Comprar novamente"}
        </button>
      </div>
      {result && (
        <div role="status" className="mt-3 text-xs leading-6 text-zinc-300">
          {result.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <Link
            href="/carrinho"
            className="mt-2 inline-block font-bold text-violet-300"
          >
            Conferir carrinho →
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
