import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import CatalogToolbar from "./CatalogToolbar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Params = { q?: string; jogo?: string; categoria?: string; ordem?: string };

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const client = await createClient();
  const [productResult, categoryResult, gameResult] = await Promise.all([
    client.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock,category_id,display_order").eq("is_active", true).order("display_order", { ascending: true }).order("name", { ascending: true }),
    client.from("categories").select("id,name,game_id,display_order").order("display_order", { ascending: true }).order("name"),
    client.from("games").select("id,name,slug,display_order").eq("is_active", true).order("display_order", { ascending: true }).order("name"),
  ]);

  const games = gameResult.data ?? [];
  const categories = categoryResult.data ?? [];
  const products = productResult.data ?? [];
  const selectedGame = games.find((game) => game.slug === params.jogo);
  const q = normalizeSearch((params.q ?? "").slice(0, 100));
  const effectiveGame = selectedGame ?? (games.length === 1 ? games[0] : undefined);
  const selectedCategory = categories.find((category) => category.id === params.categoria && Boolean(effectiveGame) && category.game_id === effectiveGame?.id);

  const visible = products.filter((product) => {
    const category = categories.find((entry) => entry.id === product.category_id);
    const normalizedName = normalizeSearch(product.name);
    const nameMatches = !q || (q.includes(" ") ? normalizedName.includes(q) : normalizedName.split(/\s+/).some((word) => word.startsWith(q)));
    return nameMatches && (!selectedGame || category?.game_id === selectedGame.id) && (!selectedCategory || product.category_id === selectedCategory.id) && (!params.jogo || Boolean(selectedGame));
  }).sort((a, b) => {
    if (params.ordem === "menor") return Number(a.price) - Number(b.price);
    if (params.ordem === "maior") return Number(b.price) - Number(a.price);
    if (params.ordem === "nome") return a.name.localeCompare(b.name, "pt-BR");
    if (params.ordem === "nome-desc") return b.name.localeCompare(a.name, "pt-BR");
    return Number(a.display_order) - Number(b.display_order) || a.name.localeCompare(b.name, "pt-BR");
  });

  return <div className="min-h-screen"><SiteHeader /><main className="catalog-shell">
    <div className="catalog-page-head"><p className="eyebrow">CATÁLOGO COSMIC</p><h1 className="section-title">Encontre seu próximo item.</h1><p className="section-description">Pesquise pelo nome em tempo real e refine por categoria, jogo ou ordem sem ocupar a tela com filtros desnecessários.</p></div>
    <CatalogToolbar games={games} categories={categories} params={params} />
    <section className="min-w-0 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><h2 className="font-black">Produtos</h2><p className="mt-1 text-xs text-zinc-500">{visible.length} {visible.length === 1 ? "item encontrado" : "itens encontrados"}</p></div><div className="flex gap-3"><Link href="/combos" className="section-link">Ver combos ↗</Link><Link href="/jogos" className="section-link">Explorar jogos ↗</Link></div></div>
      {productResult.error || gameResult.error || categoryResult.error ? <div role="alert" className="admin-error mt-6">Não foi possível carregar o catálogo. Tente novamente mais tarde.</div> : visible.length ? <div className="product-grid mt-5">{visible.map((product) => <ProductCard key={product.id} produto={product} />)}</div> : <div className="empty-store-state mt-5"><strong className="block text-lg text-white">Nenhum item encontrado.</strong><p className="mt-2">Tente outra busca ou remova os filtros.</p><Link href="/produtos" className="btn-secondary mt-5">Ver todos os produtos</Link></div>}
    </section>
  </main><SiteFooter /></div>;
}
