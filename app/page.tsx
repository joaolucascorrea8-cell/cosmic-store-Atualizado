import { allRows } from "@/lib/query-pages";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
import { ACTIVE_COMBO_WINDOW_FILTER, type ComboNestedItem } from "@/lib/combos";
import { money } from "@/lib/catalog";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import ProductCard from "./components/ProductCard";
import CatalogCard from "./components/CatalogCard";
import StoreFeedbacks from "./components/StoreFeedbacks";
import ComboCard from "./components/ComboCard";
import Icon from "./components/Icon";
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
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1}>
        <section className="shell hero-stage grid items-center gap-8 py-8 md:py-12 lg:grid-cols-[.96fr_1.04fr] lg:gap-12">
          <div className="min-w-0 max-w-xl">
            <p className="hero-kicker">
              <Icon name="gamepad" className="h-4 w-4" /> COSMIC STORE
            </p>
            <h1 className="hero-headline mt-5">
              Seu jogo.
              <br />
              Seu próximo <span>upgrade.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-zinc-400 sm:text-base">
              Frutas, passes e itens para seus jogos favoritos. Escolha no
              catálogo, pague com Pix e acompanhe a entrega por aqui.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/jogos">
                Explorar jogos <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link className="btn-secondary" href="/produtos">
                Ver produtos
              </Link>
            </div>
            <p className="mt-5 text-xs text-zinc-500">
              Roblox, Blox Fruits e mais possibilidades para jogar.
            </p>
          </div>
          <div className="hero-art relative overflow-hidden border border-white/10">
            <div className="hero-art-grid" />
            <div className="hero-orbit" />
            <span className="absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold">
              {featuredGame?.name ?? "Universo Cosmic"}
            </span>
            <Image
              src={
                featured?.image_url ||
                "/images/products/20560-perm-dragon-blox-fruits.png"
              }
              alt={featured?.name ?? "Destaque da Cosmic Store"}
              fill
              priority
              sizes="(max-width:1024px) 100vw,50vw"
              className="hero-art-image object-contain"
            />
            <div className="hero-art-bottom absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
              <p className="eyebrow">Em destaque</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                    {featured?.name ?? "Descubra seu próximo item"}
                  </h2>
                  {featured && (
                    <p className="mt-1 text-sm text-zinc-300">
                      {money(featured.price)}
                    </p>
                  )}
                </div>
                <Link
                  href={featured ? `/produto/${featured.slug}` : "/jogos"}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-zinc-950"
                  aria-label="Ver destaque"
                >
                  <Icon name="arrow" />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <div className="shell trust-strip">
          <div>
            <Icon name="coins" />
            <span>
              Pagamento via Pix<small>Valor e instruções no checkout</small>
            </span>
          </div>
          <div>
            <Icon name="package" />
            <span>
              Entrega acompanhada<small>Andamento na área de pedidos</small>
            </span>
          </div>
          <div>
            <Icon name="chat" />
            <span>
              Suporte direto<small>Converse com a equipe no site</small>
            </span>
          </div>
        </div>
        <section className="shell store-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Seu universo</p>
              <h2 className="section-title">Escolha o jogo</h2>
            </div>
            <Link href="/jogos" className="section-link">
              Todos os jogos ↗
            </Link>
          </div>
          <div className="catalog-grid mt-6">
            {games.slice(0, 3).map((game) => (
              <CatalogCard
                key={game.id}
                href={`/${game.slug}`}
                name={game.name}
                imageUrl={game.image_url}
                eyebrow="Jogo disponível"
                description="Explore categorias e produtos"
              />
            ))}
          </div>
          {!games.length && (
            <div className="empty-store-state mt-5">
              Estamos preparando nossos jogos. Volte em breve.
            </div>
          )}
        </section>
        {categories.length > 0 && (
          <section className="shell">
            <p className="eyebrow">Encontre mais rápido</p>
            <div className="category-shortcuts mt-4">
              {categories.slice(0, 6).map((category) => {
                const game = games.find(
                  (game) => game.id === category.game_id,
                )!;
                return (
                  <Link
                    key={category.id}
                    href={`/${game.slug}/${category.slug}`}
                    className="category-shortcut"
                  >
                    <Icon
                      name="grid"
                      className="h-5 w-5 shrink-0 text-violet-300"
                    />
                    <span className="min-w-0">
                      <strong className="block text-xs">{category.name}</strong>
                      <small className="text-zinc-500">{game.name}</small>
                    </span>
                    <Icon
                      name="chevron"
                      className="ml-auto h-4 w-4 shrink-0 text-zinc-500"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        <section className="shell store-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vitrine Cosmic</p>
              <h2 className="section-title">Para o seu próximo jogo</h2>
            </div>
            <Link href="/produtos" className="section-link">
              Ver todos ↗
            </Link>
          </div>
          {products.length ? (
            <div className="product-grid mt-6">
              {products.slice(0, 8).map((product) => (
                <ProductCard key={product.id} produto={product} />
              ))}
            </div>
          ) : (
            <div className="empty-store-state mt-6">
              Os produtos aparecerão aqui quando forem publicados.
            </div>
          )}
        </section>
        {combos.length > 0 && (
          <section className="shell pb-10">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Itens juntos, preço especial</p>
                <h2 className="section-title">Combos da vez</h2>
              </div>
              <Link href="/combos" className="section-link">
                Ver combos ↗
              </Link>
            </div>
            <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {combos.map((combo) => (
                <ComboCard key={combo.id} combo={combo} />
              ))}
              <div
                className={`flex flex-col justify-center rounded-2xl border border-white/10 bg-[#15121d] p-6 ${combos.length === 1 ? "lg:col-span-2" : ""}`}
              >
                <Icon name="tag" className="h-7 w-7 text-violet-300" />
                <h3 className="mt-4 text-xl font-bold">
                  Mais itens para jogar
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Veja exatamente o que acompanha cada combo e escolha o seu.
                </p>
                <Link href="/combos" className="btn-secondary mt-6">
                  Explorar combos
                </Link>
              </div>
            </div>
          </section>
        )}
        <section className="shell pb-10">
          <div className="grid gap-5 rounded-2xl border border-white/10 p-5 sm:grid-cols-3 sm:p-7">
            {[
              ["01", "Escolha seu item", "Explore jogos e categorias."],
              [
                "02",
                "Pague com Pix",
                "Informe o nickname e envie o comprovante.",
              ],
              [
                "03",
                "Acompanhe a entrega",
                "A equipe confirma e entrega pelo pedido.",
              ],
            ].map(([n, title, description]) => (
              <div key={n}>
                <span className="text-xs font-semibold text-violet-300">
                  {n}
                </span>
                <h3 className="mt-2 text-sm font-bold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="pb-10">
          <StoreFeedbacks feedbacks={reviews} />
        </section>
        <section className="shell pb-10">
          <div className="help-banner">
            <div>
              <p className="eyebrow">Estamos por aqui</p>
              <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                Alguma dúvida antes de comprar?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Veja como funcionam o Pix, os produtos e a entrega.
              </p>
            </div>
            <Link href="/ajuda" className="btn-secondary">
              Central de ajuda <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </section>
        <section className="shell pb-6" aria-labelledby="conta-e-privacidade">
          <div className="rounded-xl border border-white/10 bg-white/[.015] p-5">
            <h2 id="conta-e-privacidade" className="text-sm font-bold">
              Sua conta e sua privacidade
            </h2>
            <p className="mt-2 text-xs leading-6 text-zinc-400">
              Google e Discord são utilizados para autenticação e identificação
              da sua conta. O Login Google utiliza somente dados básicos, como
              nome, e-mail, identificador e foto de perfil quando
              disponibilizada.
            </p>
            <p className="mt-1 text-xs leading-6 text-zinc-400">
              A Cosmic Store não acessa sua senha, Gmail, Drive, contatos,
              calendário, fotos ou documentos. O Google é utilizado
              exclusivamente para login, sem geração de imagens, inteligência
              artificial ou outros serviços.
            </p>
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-violet-300">
              <Link href="/privacidade">Política de Privacidade ↗</Link>
              <Link href="/termos">Termos de uso ↗</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
