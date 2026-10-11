import Image from "next/image";
import Link from "next/link";
import Icon from "../Icon";
import styles from "./Storefront.module.css";

type Props = {
  game: { name: string; slug: string; image_url: string | null };
  productCount: number | null;
  eager?: boolean;
};

export default function HomeGameCard({
  game,
  productCount,
  eager = false,
}: Props) {
  return (
    <Link
      href={`/${game.slug}`}
      className={styles.gameCard}
      aria-label={`Explorar ${game.name}`}
    >
      <div className={styles.gameArt}>
        <Icon name="gamepad" className={styles.gameFallback} />
        {game.image_url && (
          <Image
            src={game.image_url}
            alt=""
            fill
            sizes="(max-width: 639px) 44vw, (max-width: 1199px) 31vw, 240px"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            className={styles.gameImage}
          />
        )}
        <span className={styles.gameOpen}>
          <Icon name="arrow" className="h-4 w-4" />
        </span>
      </div>
      <div className={styles.gameCaption}>
        <h3>{game.name}</h3>
        <p>
          {productCount === null
            ? "Explorar jogo"
            : productCount === 0
              ? "Explorar categorias"
              : `${productCount} ${productCount === 1 ? "item no catálogo" : "itens no catálogo"}`}
        </p>
      </div>
    </Link>
  );
}
