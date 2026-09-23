import Link from "next/link";
import {notFound} from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function CategoryPage({params}:{params:Promise<{jogoSlug:string;categoriaSlug:string}>}){
  const {jogoSlug,categoriaSlug}=await params;const client=await createClient();
  const {data:game}=await client.from("games").select("id,name,slug").eq("slug",jogoSlug).eq("is_active",true).single();if(!game)notFound();
  const {data:category}=await client.from("categories").select("id,name").eq("slug",categoriaSlug).eq("game_id",game.id).single();if(!category)notFound();
  const {data:products,error}=await client.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock").eq("category_id",category.id).eq("is_active",true).order("name");
  return <div className="min-h-screen"><SiteHeader/><main className="shell"><nav aria-label="Navegação de localização" className="flex flex-wrap gap-2 pt-7 text-xs text-zinc-500"><Link href="/">Início</Link><span>/</span><Link href="/jogos">Jogos</Link><span>/</span><Link href={`/${game.slug}`}>{game.name}</Link><span>/</span><span className="text-white">{category.name}</span></nav><div className="catalog-page-head"><p className="eyebrow">{game.name.toUpperCase()}</p><h1 className="section-title">{category.name}</h1><p className="section-description">Produtos dessa categoria, organizados para você encontrar o que procura.</p></div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><span className="text-sm text-zinc-400">{products?.length??0} produtos</span><Link href={`/produtos?jogo=${encodeURIComponent(game.slug)}`} className="section-link">Todos os itens de {game.name} ↗</Link></div>{error?<div className="admin-error mt-6">Não foi possível carregar os produtos.</div>:products?.length?<div className="product-grid mt-6 pb-16">{products.map(product=><ProductCard key={product.id} produto={product}/>)}</div>:<div className="empty-store-state my-7 mb-16">Ainda não há itens publicados nesta categoria. <Link href={`/${game.slug}`} className="block pt-3 font-bold text-violet-300">Ver outras categorias ↗</Link></div>}</main><SiteFooter/></div>;
}
