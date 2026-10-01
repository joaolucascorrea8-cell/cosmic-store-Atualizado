import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import CatalogCard from "@/app/components/CatalogCard";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
const getGame = cache(async (slug: string) => {
  const client = await createClient();
  const { data, error } = await client
    .from("games")
    .select("id,name,slug,image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o jogo.");
  return data;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ jogoSlug: string }>;
}): Promise<Metadata> {
  const game = await getGame((await params).jogoSlug);
  return game
    ? {
        title: game.name,
        description: `Explore os produtos e categorias de ${game.name} na Cosmic Store.`,
        alternates: { canonical: `/${game.slug}` },
        openGraph: { images: game.image_url ? [game.image_url] : [] },
      }
    : { title: "Jogo não encontrado", robots: { index: false } };
}
export default async function GamePage({
  params,
}: {
  params: Promise<{ jogoSlug: string }>;
}) {
  const { jogoSlug } = await params;
  const client = await createClient();
  const game = await getGame(jogoSlug);
  if (!game) notFound();
  const { data: categories, error } = await client
    .from("categories")
    .select("id,name,slug,image_url,display_order")
    .eq("game_id", game.id)
    .order("display_order", { ascending: true })
    .order("name");
  const { data: counts } = await client
    .from("products")
    .select("category_id")
    .eq("is_active", true)
    .in(
      "category_id",
      (categories ?? []).map((c) => c.id),
    );
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="shell">
        <nav
          aria-label="Navegação de localização"
          className="flex flex-wrap items-center gap-2 pt-7 text-xs text-zinc-500"
        >
          <Link href="/">Início</Link>
          <span>/</span>
          <Link href="/jogos">Jogos</Link>
          <span>/</span>
          <span className="text-white">{game.name}</span>
        </nav>
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-violet-500/20 bg-[#1a1027] p-7 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(151,80,229,.23),transparent_48%)]" />
          {game.image_url && (
            <Image
              src={game.image_url}
              alt=""
              fill
              sizes="(max-width:1024px) 100vw,80vw"
              className="object-cover opacity-20"
            />
          )}
          <div className="relative max-w-xl">
            <p className="eyebrow">CATÁLOGO POR JOGO</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {game.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Escolha uma categoria para visualizar os itens disponíveis para
              este jogo.
            </p>
            <Link
              href={`/produtos?jogo=${encodeURIComponent(game.slug)}`}
              className="btn-primary mt-6"
            >
              Ver todos os itens ↗
            </Link>
          </div>
        </div>
        <div className="section-heading mt-10">
          <div>
            <p className="eyebrow">ENCONTRE SEU ITEM</p>
            <h2 className="section-title">Categorias de {game.name}</h2>
          </div>
          <span className="text-sm text-zinc-500">
            {categories?.length ?? 0} categorias
          </span>
        </div>
        {error ? (
          <div className="admin-error mt-6">
            Não foi possível carregar as categorias.
          </div>
        ) : categories?.length ? (
          <div className="catalog-grid my-7 pb-12">
            {categories.map((category) => (
              <CatalogCard
                key={category.id}
                href={`/${game.slug}/${category.slug}`}
                name={category.name}
                imageUrl={category.image_url}
                eyebrow={game.name}
                description={`${counts?.filter((p) => p.category_id === category.id).length ?? 0} produtos · Explorar categoria`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-store-state my-7 mb-16">
            Este jogo ainda não possui categorias cadastradas.
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
