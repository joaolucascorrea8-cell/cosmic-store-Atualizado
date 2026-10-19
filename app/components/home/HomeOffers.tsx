import Link from "next/link";
import Icon from "../Icon";
import styles from "./Storefront.module.css";

export default function HomeOffers() {
  return (
    <section
      className={`${styles.offers} ${styles.singleOffer}`}
      aria-label="Comprar Robux"
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
    </section>
  );
}
