import Link from "next/link";
import { notFound } from "next/navigation";
import CatalogCard from "@/app/components/CatalogCard";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ jogoSlug: string }> }) {
  const { jogoSlug } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase.from("games").select("id,name,slug,image_url").eq("slug", jogoSlug).eq("is_active", true).single();
  if (!game) notFound();
  const { data: categories } = await supabase.from("categories").select("id,name,slug,image_url").eq("game_id", game.id).order("name");

  return <div className="min-h-screen"><SiteHeader/><main className="catalog-shell py-10 md:py-14"><Link href="/jogos" className="text-sm font-bold text-zinc-500 hover:text-white">← Todos os jogos</Link><p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-violet-400">Catálogo</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-4xl font-black">{game.name}</h1><p className="mt-3 text-zinc-400">Escolha uma categoria para ver os produtos.</p></div><span className="text-sm text-zinc-500">{categories?.length ?? 0} categoria(s)</span></div>{categories?.length?<div className="catalog-grid mt-8">{categories.map(category=><CatalogCard key={category.id} href={`/${game.slug}/${category.slug}`} name={category.name} imageUrl={category.image_url} eyebrow={game.name} description="Abrir esta categoria e visualizar todos os produtos."/>)}</div>:<div className="mt-8 rounded-2xl border border-dashed border-white/15 py-14 text-center text-zinc-500">Nenhuma categoria publicada.</div>}</main><SiteFooter/></div>;
}
