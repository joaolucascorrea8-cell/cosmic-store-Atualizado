import { notFound } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CategoryPage({params}:{params:Promise<{jogoSlug:string;categoriaSlug:string}>}) {
  const {jogoSlug,categoriaSlug}=await params;
  const supabase=await createClient();
  const {data:game}=await supabase.from("games").select("id,name").eq("slug",jogoSlug).single();
  if(!game) notFound();
  const {data:category}=await supabase.from("categories").select("id,name").eq("slug",categoriaSlug).eq("game_id",game.id).single();
  if(!category) notFound();
  const {data:products}=await supabase.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock").eq("category_id",category.id).eq("is_active",true).order("name");
  return <div className="min-h-screen"><SiteHeader/><main className="catalog-shell py-8 md:py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">{game.name}</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-black md:text-4xl">{category.name}</h1><span className="text-sm text-zinc-500">{products?.length ?? 0} produto(s)</span></div>{products?.length?<div className="product-grid mt-7">{products.map(product=><ProductCard key={product.id} produto={product}/>)}</div>:<div className="mt-8 rounded-2xl border border-dashed border-white/15 py-14 text-center text-zinc-500">Nenhum produto ativo nesta categoria.</div>}</main><SiteFooter/></div>;
}
