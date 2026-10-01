import { allRows } from "@/lib/query-pages";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import GameExplorer from "./GameExplorer";
export const dynamic = "force-dynamic";
export const metadata = { title: "Jogos", alternates: { canonical: "/jogos" } };
export default async function GamesPage() {
  const client = await createClient();
  const [g, c, p] = await Promise.all([
    client
      .from("games")
      .select("id,name,slug,image_url")
      .eq("is_active", true)
      .order("display_order")
      .order("name"),
    allRows(client.from("categories").select("id,game_id").order("id")),
    allRows(
      client
        .from("products")
        .select("category_id")
        .eq("is_active", true)
        .order("id"),
    ),
  ]);
  const games = (g.data ?? []).map((game) => {
    const cats = (c.data ?? []).filter((cat) => cat.game_id === game.id);
    return {
      ...game,
      categoryCount: cats.length,
      productCount: (p.data ?? []).filter((product) =>
        cats.some((cat) => cat.id === product.category_id),
      ).length,
    };
  });
  return (
    <div>
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="shell">
        <div className="catalog-page-head">
          <p className="eyebrow">Seu universo</p>
          <h1 className="section-title">Qual é o seu jogo?</h1>
          <p className="section-description">
            Entre no jogo para explorar categorias e itens disponíveis.
          </p>
        </div>
        {g.error || c.error || p.error ? (
          <div className="admin-error mb-12">
            Não foi possível carregar o catálogo de jogos.
          </div>
        ) : (
          <GameExplorer games={games} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
