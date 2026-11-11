export function storeOrigin() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://cosmic-store-blush.vercel.app").origin;
}
export const staticStorePaths = ["", "/produtos", "/jogos", "/robux", "/servidores", "/avaliacoes", "/ajuda", "/termos", "/privacidade", "/reembolso"];
export function catalogSitemapPaths(
  games: { id: string; slug: string }[],
  categories: { id: string; slug: string; game_id: string | null }[],
  products: { slug: string; category_id: string | null }[],
) {
  const byGame = new Map(games.map(g => [g.id, g]));
  const visibleCategories = categories.filter(c => c.game_id && byGame.has(c.game_id));
  const byCategory = new Set(visibleCategories.map(c => c.id));
  return [...new Set([...staticStorePaths,
    ...games.map(g => `/${g.slug}`),
    ...visibleCategories.map(c => `/${byGame.get(c.game_id!)!.slug}/${c.slug}`),
    ...products.filter(p => p.category_id && byCategory.has(p.category_id)).map(p => `/produto/${p.slug}`),
  ])];
}
export function hasCatalogVariants(params: Record<string, string | undefined>) {
  return ["q", "jogo", "categoria", "ordem", "estoque", "pagina"].some(k => Boolean(params[k]));
}
