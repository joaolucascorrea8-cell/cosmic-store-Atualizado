import Icon from "../Icon";
import styles from "./Storefront.module.css";

export default function StoreSearch() {
  return (
    <form
      action="/produtos"
      method="get"
      role="search"
      className={styles.search}
    >
      <label htmlFor="buscar" className="sr-only">
        Buscar jogos, produtos e categorias
      </label>
      <Icon name="search" className="h-5 w-5 shrink-0 text-violet-300" />
      <input
        id="buscar"
        name="q"
        type="search"
        maxLength={100}
        placeholder="Qual jogo ou item você procura?"
        autoComplete="off"
        enterKeyHint="search"
      />
      <button type="submit" aria-label="Buscar na loja">
        <span>Buscar</span>
        <Icon name="arrow" className="h-4 w-4" />
      </button>
    </form>
  );
}
