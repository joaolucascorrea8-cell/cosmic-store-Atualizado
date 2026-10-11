import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import StoreFeedbacks from "./components/StoreFeedbacks";
import Icon from "./components/Icon";
import HomeGameCard from "./components/home/HomeGameCard";
import StoreSearch from "./components/home/StoreSearch";
import HomeOffers from "./components/home/HomeOffers";
import styles from "./components/home/Storefront.module.css";
import { storeServices } from "@/lib/storefront-search";
export const dynamic = "force-dynamic";
export default async function Home() {
  const client = await createClient();
  const [g, f] = await Promise.all([
    client
      .from("games")
      .select("id,name,slug,image_url,display_order")
      .eq("is_active", true)
      .order("display_order")
      .order("name")
      .order("id")
      .limit(4),
    client
      .from("feedbacks")
      .select(
        "id,rating,comment,author_nickname,created_at,source,attachment_path",
      )
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const reviews = await withSignedReviewAttachments(f.data ?? []);
  // A short preview in the Admin's order; the full selection lives in /jogos.
  const visibleGames = (g.data ?? []).slice(0, 4);
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
                <p>Escolha por onde começar. Tem mais na página de jogos.</p>
              </div>
              <Link href="/jogos" className={styles.allGames}>
                Ver todos os jogos
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
                      productCount={null}
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
          <HomeOffers />
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
