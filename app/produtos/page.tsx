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

import { matchesProductName, pageNumber } from "@/lib/catalog";
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
  const categories = categoryResult.data ?? [];
  const products = productResult.data ?? [];
  const selectedGame = games.find((game) => game.slug === params.jogo);
  const q = (params.q ?? "").slice(0, 100);
  const effectiveGame = selectedGame;
  const selectedCategory = categories.find(
    (category) =>
      category.id === params.categoria &&
      (!effectiveGame || category.game_id === effectiveGame.id),
  );

  const visible = products
    .filter((product) => {
      const category = categories.find(
        (entry) => entry.id === product.category_id,
      );
      return (
        matchesProductName(product.name, q) &&
        Boolean(
          category && games.some((game) => game.id === category.game_id),
        ) &&
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
            Busque por nome ou escolha o jogo e a categoria para encontrar seu
            item.
          </p>
        </div>
        <CatalogToolbar games={games} categories={categories} params={params} />
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
              <p className="mt-2">Tente outra busca ou remova os filtros.</p>
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
