import { allRows } from "@/lib/query-pages";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import CatalogToolbar from "./CatalogToolbar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Params = {
  q?: string;
  jogo?: string;
  categoria?: string;
  ordem?: string;
  estoque?: string;
  pagina?: string;
};
export const metadata = {
  title: "Produtos",
  alternates: { canonical: "/produtos" },
};

import { pageNumber } from "@/lib/catalog";
import {
  matchesCatalogSearch,
  matchingServices,
} from "@/lib/storefront-search";
import Pagination from "@/app/components/Pagination";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const client = await createClient();
  const [productResult, categoryResult, gameResult] = await Promise.all([
    allRows(
      client
        .from("products")
        .select(
          "id,name,slug,description,price,image_url,stock,unlimited_stock,category_id,display_order",
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true })
        .order("id"),
    ),
    allRows(
      client
        .from("categories")
        .select("id,name,game_id,display_order")
        .order("display_order", { ascending: true })
        .order("name")
        .order("id"),
    ),
    allRows(
      client
        .from("games")
        .select("id,name,slug,display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name")
        .order("id"),
    ),
  ]);

  const games = gameResult.data ?? [];
  const categories = (categoryResult.data ?? []).filter((category) =>
    games.some((game) => game.id === category.game_id),
  );
  const products = productResult.data ?? [];
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const gameById = new Map(games.map((game) => [game.id, game]));
  const selectedGame = games.find((game) => game.slug === params.jogo);
  const q = (params.q ?? "").slice(0, 100);
  const effectiveGame = selectedGame;
  const selectedCategory = categories.find(
    (category) =>
      category.id === params.categoria &&
      (!effectiveGame || category.game_id === effectiveGame.id),
  );
  const discoveryLinks = q.trim()
    ? [
        ...matchingServices(q).map((service) => ({
          href: service.href,
          name: service.name,
          context: service.description,
        })),
        ...games
          .filter(
            (game) =>
              (!params.jogo || game.id === selectedGame?.id) &&
              matchesCatalogSearch(q, game.name),
          )
          .map((game) => ({
            href: `/${game.slug}`,
            name: game.name,
            context: "Explorar jogo",
          })),
        ...categories
          .filter((category) => {
            const game = gameById.get(category.game_id);
            return (
              (!params.jogo || game?.id === selectedGame?.id) &&
              (!params.categoria || category.id === selectedCategory?.id) &&
              matchesCatalogSearch(q, category.name, game?.name)
            );
          })
          .map((category) => ({
            href: `/produtos?jogo=${encodeURIComponent(gameById.get(category.game_id)!.slug)}&categoria=${encodeURIComponent(category.id)}`,
            name: category.name,
            context: gameById.get(category.game_id)!.name,
          })),
      ].slice(0, 8)
    : [];

  const visible = products
    .filter((product) => {
      const category = categoryById.get(product.category_id);
      const game = category ? gameById.get(category.game_id) : undefined;
      return (
        matchesCatalogSearch(q, product.name, category?.name, game?.name) &&
        Boolean(category && game) &&
        (!selectedGame || category?.game_id === selectedGame.id) &&
        (!selectedCategory || product.category_id === selectedCategory.id) &&
        (!params.jogo || Boolean(selectedGame)) &&
        (params.estoque !== "1" || product.unlimited_stock || product.stock > 0)
      );
    })
    .sort((a, b) => {
      if (params.ordem === "menor") return Number(a.price) - Number(b.price);
      if (params.ordem === "maior") return Number(b.price) - Number(a.price);
      if (params.ordem === "nome") return a.name.localeCompare(b.name, "pt-BR");
      if (params.ordem === "nome-desc")
        return b.name.localeCompare(a.name, "pt-BR");
      return (
        Number(a.display_order) - Number(b.display_order) ||
        a.name.localeCompare(b.name, "pt-BR")
      );
    });

  const page = Math.min(
    pageNumber(params.pagina),
    Math.max(1, Math.ceil(visible.length / 24)),
  );
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="catalog-shell">
        <div className="catalog-page-head">
          <p className="eyebrow">CATÁLOGO COSMIC</p>
          <h1 className="section-title">Encontre seu próximo item.</h1>
          <p className="section-description">
            Busque por jogo, produto ou categoria. Robux, contas e outros
            serviços também aparecem na busca.
          </p>
        </div>
        <CatalogToolbar games={games} categories={categories} params={params} />
        {discoveryLinks.length > 0 && (
          <section aria-labelledby="search-destinations" className="mb-6">
            <h2 id="search-destinations" className="mb-3 text-sm font-bold">
              Explore também
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {discoveryLinks.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 transition hover:border-violet-400/50"
                >
                  <strong className="block text-sm text-violet-200">
                    {entry.name} ↗
                  </strong>
                  <span className="mt-1 block text-xs text-zinc-400">
                    {entry.context}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="min-w-0 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-black">Produtos</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {visible.length}{" "}
                {visible.length === 1 ? "item encontrado" : "itens encontrados"}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/combos" className="section-link">
                Ver combos ↗
              </Link>
              <Link href="/jogos" className="section-link">
                Explorar jogos ↗
              </Link>
            </div>
          </div>
          {productResult.error || gameResult.error || categoryResult.error ? (
            <div role="alert" className="admin-error mt-6">
              Não foi possível carregar o catálogo. Tente novamente mais tarde.
            </div>
          ) : visible.length ? (
            <div className="product-grid mt-5">
              {visible.slice((page - 1) * 24, page * 24).map((product) => (
                <ProductCard key={product.id} produto={product} />
              ))}
            </div>
          ) : (
            <div className="empty-store-state mt-5">
              <strong className="block text-lg text-white">
                Nenhum item encontrado.
              </strong>
              <p className="mt-2">
                {discoveryLinks.length
                  ? "Confira os jogos e serviços encontrados acima ou explore o catálogo."
                  : "Tente outra busca ou remova os filtros."}
              </p>
              <Link href="/produtos" className="btn-secondary mt-5">
                Ver todos os produtos
              </Link>
            </div>
          )}
          <Pagination
            page={page}
            total={visible.length}
            pathname="/produtos"
            params={params}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
