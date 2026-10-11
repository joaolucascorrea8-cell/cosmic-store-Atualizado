import { allRows } from "@/lib/query-pages";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
import { ACTIVE_COMBO_WINDOW_FILTER, type ComboNestedItem } from "@/lib/combos";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import ProductCard from "./components/ProductCard";
import StoreFeedbacks from "./components/StoreFeedbacks";
import ComboCard from "./components/ComboCard";
import Icon from "./components/Icon";
import HomeGameCard from "./components/home/HomeGameCard";
import StoreSearch from "./components/home/StoreSearch";
import HomeOffers from "./components/home/HomeOffers";
import styles from "./components/home/Storefront.module.css";
import { storeServices } from "@/lib/storefront-search";
export const dynamic = "force-dynamic";
export default async function Home() {
  const client = await createClient();
  const [g, c, p, f, s, b] = await Promise.all([
    allRows(
      client
        .from("games")
        .select("id,name,slug,image_url,display_order")
        .eq("is_active", true)
        .order("display_order")
        .order("name")
        .order("id"),
    ),
    allRows(
      client
        .from("categories")
        .select("id,name,slug,game_id,image_url,display_order")
        .order("display_order")
        .order("name")
        .order("id"),
    ),
    allRows(
      client
        .from("products")
        .select(
          "id,name,slug,description,price,image_url,stock,unlimited_stock,display_order,category_id",
        )
        .eq("is_active", true)
        .order("display_order")
        .order("name")
        .order("id"),
    ),
    client
      .from("feedbacks")
      .select(
        "id,rating,comment,author_nickname,created_at,source,attachment_path",
      )
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(3),
    client
      .from("store_settings")
      .select("featured_product_id")
      .eq("id", true)
      .maybeSingle(),
    client
      .from("combos")
      .select(
        "id,name,slug,description,price,compare_at_price,image_url,combo_items(quantity,products(id,name,image_url,stock,unlimited_stock,is_active))",
      )
      .eq("is_active", true)
      .or(ACTIVE_COMBO_WINDOW_FILTER)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);
  const games = g.data ?? [],
    categories = (c.data ?? []).filter((category) =>
      games.some((game) => game.id === category.game_id),
    );
  const products = (p.data ?? []).filter((product) =>
    categories.some((category) => category.id === product.category_id),
  );
  const featured =
    products.find((product) => product.id === s.data?.featured_product_id) ??
    products.find(
      (product) =>
        product.image_url && (product.unlimited_stock || product.stock > 0),
    ) ??
    products[0];
  const featuredCategory = categories.find(
      (category) => category.id === featured?.category_id,
    ),
    featuredGame = games.find((game) => game.id === featuredCategory?.game_id);
  const reviews = await withSignedReviewAttachments(f.data ?? []);
  const combos = (b.data ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    compare_at_price: number;
    image_url: string | null;
    combo_items: ComboNestedItem[];
  }[];
  const catalogError = Boolean(g.error || c.error || p.error);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const gameById = new Map(games.map((game) => [game.id, game]));
  const productCounts = new Map<string, number>();
  for (const product of products) {
    const gameId = categoryById.get(product.category_id)?.game_id;
    if (gameId) productCounts.set(gameId, (productCounts.get(gameId) ?? 0) + 1);
  }
  // Keep the Admin's order. New games and categories arrive through the same queries.
  const visibleGames = games.slice(0, 6);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className={styles.home}>
        <div className="shell">
          <div className={styles.opening}>
            <div>
              <span className={styles.kicker}>SEU UNIVERSO. SUA LOJA.</span>
              <h1>
                O próximo nível <span>é seu.</span>
              </h1>
              <p>Itens para seus jogos, Robux e contas. Tudo na Cosmic.</p>
            </div>
            <StoreSearch />
          </div>
          <nav aria-label="Explore a loja" className={styles.shortcuts}>
            <a href="#jogos">
              <Icon name="grid" />
              Itens de jogos
            </a>
            {storeServices.map((service) => (
              <Link href={service.href} key={service.href}>
                <Icon name={service.icon} />
                {service.name}
              </Link>
            ))}
          </nav>
          <section
            id="jogos"
            className={`${styles.games} scroll-mt-24`}
            aria-labelledby="jogos-title"
          >
            <div className={styles.sectionHead}>
              <div>
                <h2 id="jogos-title">Qual é o seu jogo?</h2>
                <p>Entre no seu universo e encontre seus itens.</p>
              </div>
              <Link href="/jogos">
                Todos os jogos
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
            {g.error ? (
              <div role="alert" className="empty-store-state">
                Não foi possível carregar os jogos agora. Tente novamente em
                instantes.
              </div>
            ) : visibleGames.length ? (
              <>
                <div className={styles.gameGrid}>
                  {visibleGames.map((game, index) => (
                    <HomeGameCard
                      key={game.id}
                      game={game}
                      eager={index < 2}
                      productCount={
                        catalogError ? null : (productCounts.get(game.id) ?? 0)
                      }
                    />
                  ))}
                </div>
                {visibleGames.length > 2 && (
                  <p className={styles.scrollHint}>
                    Deslize para explorar
                    <Icon name="arrow" className="h-3 w-3" />
                  </p>
                )}
              </>
            ) : (
              <div className="empty-store-state">
                Estamos preparando nossos jogos. Enquanto isso, explore as
                outras opções da loja.
              </div>
            )}
          </section>
          <HomeOffers featured={featured} gameName={featuredGame?.name} />
          <section className={styles.catalog} aria-labelledby="produtos-title">
            <div className={styles.sectionHead}>
              <div>
                <h2 id="produtos-title">Encontre seu próximo item</h2>
                <p>Explore o catálogo e adicione seus favoritos ao carrinho.</p>
              </div>
              <Link href="/produtos">
                Ver todos
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
            {categories.length > 0 && (
              <nav
                aria-label="Atalhos para categorias"
                className={styles.categoryLinks}
              >
                {categories.slice(0, 6).map((category) => {
                  const game = gameById.get(category.game_id)!;
                  return (
                    <Link
                      key={category.id}
                      href={`/${game.slug}/${category.slug}`}
                    >
                      {category.name}
                      <span>{game.name}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
            {catalogError ? (
              <div role="alert" className="empty-store-state">
                Não foi possível carregar todos os produtos. Tente novamente em
                instantes.
              </div>
            ) : products.length ? (
              <div className={styles.productGrid}>
                {products.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} produto={product} />
                ))}
              </div>
            ) : (
              <div className="empty-store-state">
                Os produtos aparecerão aqui quando forem publicados.
              </div>
            )}
          </section>
          {combos.length > 0 && (
            <section
              className={styles.comboSection}
              aria-labelledby="combos-title"
            >
              <div className={styles.sectionHead}>
                <div>
                  <h2 id="combos-title">Mais itens, um só combo</h2>
                  <p>Veja o que acompanha cada pacote e escolha o seu.</p>
                </div>
                <Link href="/combos">
                  Ver combos
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
              <div className={styles.comboGrid}>
                {combos.map((combo) => (
                  <ComboCard key={combo.id} combo={combo} />
                ))}
              </div>
            </section>
          )}
          <section
            className={styles.confidence}
            aria-label="Como funciona sua compra"
          >
            <div>
              <Icon name="coins" />
              <div>
                <h2>Pagamento via Pix</h2>
                <p>Confira o valor e as instruções antes de pagar.</p>
              </div>
            </div>
            <div>
              <Icon name="package" />
              <div>
                <h2>Acompanhe cada etapa</h2>
                <p>Veja o pagamento e a entrega na área de pedidos.</p>
              </div>
            </div>
            <div>
              <Icon name="chat" />
              <div>
                <h2>Suporte de verdade</h2>
                <p>Converse com a equipe pelo suporte da loja.</p>
              </div>
            </div>
          </section>
        </div>
        {reviews.length > 0 && (
          <div className={styles.reviews}>
            <StoreFeedbacks feedbacks={reviews} />
          </div>
        )}
        <div className="shell">
          <section className={styles.help} aria-labelledby="ajuda-title">
            <div>
              <h2 id="ajuda-title">A gente te ajuda a escolher.</h2>
              <p>
                Dúvidas sobre um item, o Pix ou a entrega? Fale com a Cosmic.
              </p>
            </div>
            <div>
              <Link href="/ajuda" className="btn-secondary">
                Como comprar
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link href="/suporte" className="btn-secondary">
                Falar com a equipe
              </Link>
            </div>
          </section>
          <section
            className={styles.privacy}
            aria-labelledby="conta-e-privacidade"
          >
            <h2 id="conta-e-privacidade">Sua conta e sua privacidade</h2>
            <p>
              Google e Discord são utilizados para autenticação e identificação
              da sua conta. O Login Google utiliza somente dados básicos, como
              nome, e-mail, identificador e foto de perfil quando
              disponibilizada.
            </p>
            <p>
              A Cosmic Store não acessa sua senha, Gmail, Drive, contatos,
              calendário, fotos ou documentos. O Google é utilizado
              exclusivamente para login, sem geração de imagens, inteligência
              artificial ou outros serviços.
            </p>
            <div className={styles.privacyLinks}>
              <Link href="/privacidade">Política de Privacidade ↗</Link>
              <Link href="/termos">Termos de uso ↗</Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
