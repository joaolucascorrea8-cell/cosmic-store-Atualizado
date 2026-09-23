import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
type Params = { q?: string; jogo?: string; categoria?: string; ordem?: string };
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const client = await createClient();
  const [productResult, categoryResult, gameResult] = await Promise.all([
    client.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock,category_id").eq("is_active",true).order("name"),
    client.from("categories").select("id,name,game_id").order("name"),
    client.from("games").select("id,name,slug").eq("is_active",true).order("name"),
  ]);
  const games = gameResult.data ?? [];const categories = categoryResult.data ?? [];const products = productResult.data ?? [];
  const selectedGame = games.find(game => game.slug === params.jogo);
  const q = (params.q ?? "").trim().toLocaleLowerCase("pt-BR").slice(0,100);
  const selectedCategory = categories.find(category => category.id === params.categoria && (!selectedGame || category.game_id === selectedGame.id));
  const visible = products.filter(product => {
    const category = categories.find(entry => entry.id === product.category_id);
    return (!q || `${product.name} ${product.description ?? ""} ${category?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(q)) && (!selectedGame || category?.game_id === selectedGame.id) && (!selectedCategory || product.category_id === selectedCategory.id) && (!params.jogo || !!selectedGame);
  }).sort((a,b) => params.ordem === "menor" ? Number(a.price)-Number(b.price) : params.ordem === "maior" ? Number(b.price)-Number(a.price) : a.name.localeCompare(b.name,"pt-BR"));
  return <div className="min-h-screen"><SiteHeader /><main className="catalog-shell"><div className="catalog-page-head"><p className="eyebrow">CATÁLOGO COSMIC</p><h1 className="section-title">Encontre seu próximo item.</h1><p className="section-description">Tudo em um só lugar: busque pelo nome, selecione um jogo e organize por preço.</p></div><div className="grid items-start gap-7 pb-16 lg:grid-cols-[250px_minmax(0,1fr)]"><aside className="catalog-filters"><form className="space-y-5"><div><label className="admin-label" htmlFor="catalog-search">Buscar itens</label><input className="admin-input" type="search" id="catalog-search" name="q" defaultValue={params.q ?? ""} placeholder="Ex.: Dragon, game pass..." /></div><div><label className="admin-label" htmlFor="catalog-game">Jogo</label><select className="admin-input" id="catalog-game" name="jogo" defaultValue={params.jogo ?? ""}><option value="">Todos os jogos</option>{games.map(game=><option key={game.id} value={game.slug}>{game.name}</option>)}</select></div><div><label className="admin-label" htmlFor="catalog-category">Categoria</label><select className="admin-input" id="catalog-category" name="categoria" defaultValue={params.categoria ?? ""}><option value="">Todas as categorias</option>{categories.filter(category=>!selectedGame || category.game_id === selectedGame.id).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div><label className="admin-label" htmlFor="catalog-order">Ordenar por</label><select className="admin-input" id="catalog-order" name="ordem" defaultValue={params.ordem ?? ""}><option value="">Nome</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></div><button type="submit" className="btn-primary w-full">Aplicar filtros ↗</button><Link href="/produtos" className="block text-center text-xs font-semibold text-zinc-400 hover:text-white">Limpar filtros</Link></form></aside><section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><h2 className="font-black">Todos os produtos</h2><p className="mt-1 text-xs text-zinc-500">{visible.length} {visible.length === 1 ? "item encontrado" : "itens encontrados"}</p></div><Link href="/jogos" className="section-link">Explorar jogos ↗</Link></div>{productResult.error || gameResult.error || categoryResult.error ? <div role="alert" className="admin-error mt-6">Não foi possível carregar o catálogo. Tente novamente mais tarde.</div> : visible.length ? <div className="product-grid mt-5">{visible.map(product=><ProductCard key={product.id} produto={product}/>)}</div> : <div className="empty-store-state mt-5"><strong className="block text-lg text-white">Nenhum item encontrado.</strong><p className="mt-2">Tente outra busca ou remova os filtros.</p><Link href="/produtos" className="btn-secondary mt-5">Ver todos os produtos</Link></div>}</section></div></main><SiteFooter /></div>;
}
