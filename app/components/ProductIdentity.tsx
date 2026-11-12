import type { ProductContext } from "@/lib/product-context";
export default function ProductIdentity({ context, loading = false }: { context?: ProductContext | null; loading?: boolean }) {
  return <span className="product-identity" data-product-context>
    {context ? <><strong>{context.game}</strong><span aria-hidden="true"> · </span><span>{context.category}</span></> : loading ? "Confirmando jogo e categoria…" : "Jogo e categoria não disponíveis"}
  </span>;
}
