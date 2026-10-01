import { allRows } from "@/lib/query-pages";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { matchesProductName, pageNumber } from "@/lib/catalog";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import Pagination from "@/app/components/Pagination";
import CatalogToolbar, {
  type CatalogParams,
} from "@/app/produtos/CatalogToolbar";
export const dynamic = "force-dynamic";
const getCategory = cache(async (gameSlug: string, categorySlug: string) => {
  const client = await createClient();
  const { data: game } = await client
    .from("games")
    .select("id,name,slug")
    .eq("slug", gameSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!game) return null;
  const { data: category } = await client
    .from("categories")
    .select("id,name,slug")
    .eq("slug", categorySlug)
    .eq("game_id", game.id)
    .maybeSingle();
  return category ? { game, category } : null;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ jogoSlug: string; categoriaSlug: string }>;
}) {
  const p = await params,
    row = await getCategory(p.jogoSlug, p.categoriaSlug);
  return row
    ? {
        title: `${row.category.name} · ${row.game.name}`,
        alternates: { canonical: `/${p.jogoSlug}/${p.categoriaSlug}` },
      }
    : { title: "Categoria não encontrada", robots: { index: false } };
}
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ jogoSlug: string; categoriaSlug: string }>;
  searchParams: Promise<CatalogParams>;
}) {
  const p = await params,
    q = await searchParams,
    row = await getCategory(p.jogoSlug, p.categoriaSlug);
  if (!row) notFound();
  const { game, category } = row,
    client = await createClient();
  const { data, error } = await allRows(
    client
      .from("products")
      .select(
        "id,name,slug,description,price,image_url,stock,unlimited_stock,display_order",
      )
      .eq("category_id", category.id)
      .eq("is_active", true)
      .order("display_order")
      .order("name")
      .order("id"),
  );
  const products = (data ?? [])
    .filter(
      (product) =>
        matchesProductName(product.name, (q.q ?? "").slice(0, 100)) &&
        (q.estoque !== "1" || product.unlimited_stock || product.stock > 0),
    )
    .sort((a, b) =>
      q.ordem === "menor"
        ? Number(a.price) - Number(b.price)
        : q.ordem === "maior"
          ? Number(b.price) - Number(a.price)
          : q.ordem === "nome"
            ? a.name.localeCompare(b.name, "pt-BR")
            : q.ordem === "nome-desc"
              ? b.name.localeCompare(a.name, "pt-BR")
              : Number(a.display_order) - Number(b.display_order),
    );
  const page = Math.min(
    pageNumber(q.pagina),
    Math.max(1, Math.ceil(products.length / 24)),
  );
  return (
    <div>
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="shell">
        <nav
          aria-label="Navegação de localização"
          className="flex flex-wrap gap-2 pt-7 text-xs text-zinc-500"
        >
          <Link href="/">Início</Link>
          <span>/</span>
          <Link href="/jogos">Jogos</Link>
          <span>/</span>
          <Link href={`/${game.slug}`}>{game.name}</Link>
          <span>/</span>
          <span className="text-zinc-200">{category.name}</span>
        </nav>
        <div className="catalog-page-head">
          <p className="eyebrow">{game.name}</p>
          <h1 className="section-title">{category.name}</h1>
          <p className="section-description">
            Encontre seu próximo item para {game.name}.
          </p>
        </div>
        <CatalogToolbar games={[game]} categories={[]} params={q} scoped />
        <p className="mb-5 text-xs text-zinc-400">
          {products.length} produtos encontrados
        </p>
        {error ? (
          <div role="alert" className="admin-error">
            Não foi possível carregar os produtos.
          </div>
        ) : products.length ? (
          <div className="product-grid">
            {products.slice((page - 1) * 24, page * 24).map((product) => (
              <ProductCard key={product.id} produto={product} />
            ))}
          </div>
        ) : (
          <div className="empty-store-state">
            <strong>Nenhum item encontrado</strong>
            <Link href={`/${game.slug}`} className="mt-3 block text-violet-300">
              Explorar outras categorias ↗
            </Link>
          </div>
        )}
        <div className="pb-12">
          <Pagination
            page={page}
            total={products.length}
            pathname={`/${p.jogoSlug}/${p.categoriaSlug}`}
            params={q}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
