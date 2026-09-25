import Link from "next/link";
import CatalogCard from "@/app/components/CatalogCard";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function GamesPage() {
  const client = await createClient();
  const { data: games, error } = await client.from("games").select("id,name,slug,image_url,display_order").eq("is_active", true).order("display_order", { ascending: true }).order("name");
  return <div className="min-h-screen"><SiteHeader /><main className="shell"><div className="catalog-page-head"><Link href="/produtos" className="text-xs font-semibold text-zinc-400 hover:text-white">← Voltar ao catálogo</Link><p className="eyebrow mt-7">SELECIONE SEU UNIVERSO</p><h1 className="section-title">Qual é o seu jogo?</h1><p className="section-description">Navegue diretamente pelas categorias de cada jogo, sem perder tempo procurando.</p></div><div className="mb-6 flex justify-between gap-3"><h2 className="font-black">Jogos disponíveis</h2><span className="text-sm text-zinc-400">{games?.length ?? 0} jogos</span></div>{error ? <div className="admin-error">Não foi possível carregar os jogos.</div> : games?.length ? <div className="catalog-grid pb-16">{games.map(game=><CatalogCard key={game.id} href={`/${game.slug}`} name={game.name} imageUrl={game.image_url} eyebrow="CATÁLOGO POR JOGO" description="Categorias e itens disponíveis ↗" />)}</div> : <div className="empty-store-state mb-16">Estamos preparando nossos jogos. Volte em breve.</div>}</main><SiteFooter /></div>;
}
