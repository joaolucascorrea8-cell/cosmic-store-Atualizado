import CatalogCard from "@/app/components/CatalogCard";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const supabase = await createClient();
  const { data: games } = await supabase.from("games").select("id,name,slug,image_url").eq("is_active", true).order("name");

  return <div className="min-h-screen"><SiteHeader/><main><section className="border-b border-white/[.06] bg-violet-500/[.035]"><div className="catalog-shell py-16 md:py-24"><p className="eyebrow">Catálogo por jogo</p><h1 className="section-title max-w-3xl">Escolha seu universo</h1><p className="mt-4 max-w-2xl text-zinc-400">Entre no seu jogo e encontre categorias, game passes e produtos organizados em um único catálogo.</p></div></section><section className="catalog-shell py-12"><div className="flex justify-between"><h2 className="text-xl font-black">Jogos disponíveis</h2><span className="text-sm text-zinc-500">{games?.length??0} jogo(s)</span></div>{games?.length?<div className="catalog-grid mt-7">{games.map(game=><CatalogCard key={game.id} href={`/${game.slug}`} name={game.name} imageUrl={game.image_url} eyebrow="Jogo" description="Ver categorias e produtos disponíveis."/>)}</div>:<div className="surface mt-8 rounded-2xl border-dashed py-16 text-center text-zinc-500">Nenhum jogo publicado.</div>}</section></main><SiteFooter/></div>;
}
