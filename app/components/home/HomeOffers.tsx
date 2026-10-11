import Image from "next/image";
import Link from "next/link";
import { money } from "@/lib/catalog";
import Icon from "../Icon";
import styles from "./Storefront.module.css";

type Props = {
  featured?: {
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
  };
  gameName?: string;
};

export default function HomeOffers({ featured, gameName }: Props) {
  return (
    <section
      className={`${styles.offers} ${!featured ? styles.offersTwo : ""}`}
      aria-label="Robux, contas e destaque da loja"
    >
      <Link href="/robux" className={`${styles.offer} ${styles.robuxOffer}`}>
        <div className={styles.offerCopy}>
          <span className={styles.offerKicker}>DO SEU JEITO</span>
          <h2>
            Seu próximo upgrade
            <br />
            começa com Robux.
          </h2>
          <p>Escolha a quantidade. Confira o valor.</p>
          <span className={styles.offerCta}>
            Comprar Robux <Icon name="arrow" className="h-4 w-4" />
          </span>
        </div>
        <div className={styles.coinArt} aria-hidden="true">
          <span className={styles.coinBack} />
          <span className={styles.coinFront}>
            <span />
          </span>
        </div>
      </Link>
      <Link
        href="/robux/contas"
        className={`${styles.offer} ${styles.accountOffer}`}
      >
        <div className={styles.offerCopy}>
          <span className={styles.offerKicker}>OUTRA FORMA DE COMPRAR</span>
          <h2>
            Contas
            <br />
            com Robux
          </h2>
          <p>Escolha uma conta pronta com saldo.</p>
          <span className={styles.offerCta}>
            Explorar contas <Icon name="arrow" className="h-4 w-4" />
          </span>
        </div>
        <div className={styles.accountArt} aria-hidden="true">
          <Icon name="user" />
          <span>
            <Icon name="coins" />
          </span>
        </div>
      </Link>
      {featured && (
        <Link
          href={`/produto/${featured.slug}`}
          className={`${styles.offer} ${styles.featuredOffer}`}
        >
          <span className={styles.offerKicker}>DESTAQUE COSMIC</span>
          <div className={styles.featuredBody}>
            <div className={styles.featuredArt}>
              <Image
                src={featured.image_url || "/images/products/placeholder.svg"}
                alt=""
                fill
                sizes="(max-width: 639px) 130px, (max-width: 899px) 180px, 140px"
                className="object-contain"
              />
            </div>
            <div className={styles.featuredCopy}>
              {gameName && <p>{gameName}</p>}
              <h2>{featured.name}</h2>
              <strong>{money(featured.price)}</strong>
              <span className={styles.offerCta}>
                Ver item <Icon name="arrow" className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
      )}
    </section>
  );
}
