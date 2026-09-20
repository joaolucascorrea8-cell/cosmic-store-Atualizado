import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock").eq("is_active", true).order("name");
  return <div className="min-h-screen"><SiteHeader/><main><section className="border-b border-white/[.06] bg-violet-500/[.035]"><div className="catalog-shell py-14 md:py-20"><p className="eyebrow">Catálogo completo</p><h1 className="section-title">Todos os produtos</h1><p className="mt-3 max-w-2xl text-zinc-500">Explore toda a vitrine ou entre em um jogo para navegar por categorias.</p></div></section><section className="catalog-shell py-10"><div className="flex items-center justify-between"><h2 className="font-black">Vitrine Cosmic</h2><span className="text-sm text-zinc-500">{products?.length??0} produto(s)</span></div>{products?.length?<div className="product-grid mt-7">{products.map(product=><ProductCard key={product.id} produto={product}/>)}</div>:<div className="surface mt-8 rounded-2xl border-dashed py-16 text-center text-zinc-500">Nenhum produto disponível no momento.</div>}</section></main><SiteFooter/></div>;
}
