import { allRows } from "@/lib/query-pages";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import ProductEditor from "./ProductEditor";
import ProductOrderManager from "./ProductOrderManager";

type Product = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  description: string | null;
  delivery_hours: number | null;
  low_stock_threshold: number;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  is_active: boolean;
  image_url: string | null;
  display_order: number;
};
type Category = {
  id: string;
  name: string;
  game_id: string;
  description_template: string;
  display_order: number;
};
type Game = { id: string; name: string; display_order: number };
type Params = {
  sucesso?: string;
  novo?: string;
  catalogo?: string;
  q?: string;
  status?: string;
  category?: string;
  duplicar?: string;
};

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const client = createAdminClient();
  const [productResult, categoryResult, gameResult, settingsResult] =
    await Promise.all([
      allRows(
        client
          .from("products")
          .select(
            "id,name,slug,description,category_id,price,stock,unlimited_stock,is_active,image_url,delivery_hours,delivery_instructions,robux_quantity,pricing_locked,pricing_rate,ops_version,low_stock_threshold,display_order",
          )
          .order("display_order", { ascending: true })
          .order("name", { ascending: true })
          .order("id"),
      ),
      allRows(
        client
          .from("categories")
          .select("id,name,game_id,description_template,display_order")
          .order("display_order", { ascending: true })
          .order("name")
          .order("id"),
      ),
      allRows(
        client
          .from("games")
          .select("id,name,display_order")
          .order("display_order", { ascending: true })
          .order("name")
          .order("id"),
      ),
      client
        .from("store_settings")
        .select("featured_product_id")
        .eq("id", true)
        .maybeSingle(),
    ]);

  const products = (productResult.data ?? []) as Product[];
  const games = (gameResult.data ?? []) as Game[];
  const gamePosition = new Map(games.map((game, index) => [game.id, index]));
  const categories = ((categoryResult.data ?? []) as Category[]).sort(
    (a, b) =>
      (gamePosition.get(a.game_id) ?? 9999) -
        (gamePosition.get(b.game_id) ?? 9999) ||
      Number(a.display_order) - Number(b.display_order) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  const gameNames = new Map(games.map((game) => [game.id, game.name]));
  const categoryNames = new Map(
    categories.map((category) => [
      category.id,
      `${gameNames.get(category.game_id) ?? "Jogo"} · ${category.name}`,
    ]),
  );
  const lowStockCount = products.filter(
    (product) =>
      !product.unlimited_stock && product.stock > 0 && product.stock <= product.low_stock_threshold,
  ).length;
  const outCount = products.filter(
    (product) => !product.unlimited_stock && product.stock < 1,
  ).length;
  const allowedStatus = ["active", "inactive", "out", "low"].includes(
    params.status ?? "",
  )
    ? (params.status as "active" | "inactive" | "out" | "low")
    : "all";
  const allowedCategory = categories.some((item) => item.id === params.category)
    ? params.category!
    : "all";
  const catalogOpen =
    params.catalogo === "1" ||
    Boolean(params.sucesso || params.q || params.status || params.category);

  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">GESTÃO DE ITENS</p>
          <h1 className="admin-title">Produtos</h1>
      <div className="mt-4 flex flex-wrap gap-2"><Link className="admin-small-button" href="/admin/produtos/precos">Reajustar pelo Robux</Link><Link className="admin-small-button" href="/admin/produtos/importar">Importar planilha</Link><Link className="admin-small-button" href="/admin/historico">Histórico de alterações</Link></div>
          <p className="admin-description">
            Vitrine, ordem, estoque e status agora ficam juntos. Abra somente a
            área que precisar.
          </p>
        </div>
        <Link
          href="/admin/produtos?novo=1#novo-produto"
          className="btn-primary"
        >
          + Novo produto
        </Link>
      </div>

      {params.sucesso && (
        <p role="status" className="admin-notice mt-5">
          {params.sucesso === "produto-cadastrado"
            ? "Produto cadastrado com sucesso."
            : params.sucesso === "produto-excluido"
              ? "Produto excluído com sucesso."
              : "Produto atualizado com sucesso."}
        </p>
      )}
      {(productResult.error || categoryResult.error || gameResult.error) && (
        <p role="alert" className="admin-error mt-5">
          Não foi possível carregar parte do catálogo. Atualize a página.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-stat">
          <span>Total</span>
          <strong>{products.length}</strong>
          <small>produtos cadastrados</small>
        </div>
        <div className="admin-stat">
          <span>Publicados</span>
          <strong>{products.filter((p) => p.is_active).length}</strong>
          <small>visíveis na loja</small>
        </div>
        <div className="admin-stat">
          <span>Esgotados</span>
          <strong>{outCount}</strong>
          <small>precisam de estoque</small>
        </div>
        <div className="admin-stat">
          <span>Estoque baixo</span>
          <strong>{lowStockCount}</strong>
          <small>1 ou 2 unidades</small>
        </div>
      </div>

      {!productResult.error && (
        <details
          id="catalogo-produtos"
          className="admin-form-details mt-6"
          open={catalogOpen}
        >
          <summary>
            <span className="min-w-0">
              <strong className="block text-sm text-white">
                Catálogo de produtos
              </strong>
              <small className="mt-1 block font-normal text-zinc-500">
                Ordene a vitrine, filtre, confira preço, ajuste estoque/status e
                abra a edição completa no mesmo lugar.
              </small>
            </span>
            <span className="shrink-0">Abrir gestão ⌄</span>
          </summary>
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-zinc-500">
                Se você editar um produto e voltar, a busca e os filtros usados
                nesta lista são restaurados automaticamente.
              </p>
              <Link
                href="/admin/catalogo"
                className="text-xs font-bold text-violet-300 hover:text-white"
              >
                Jogos e categorias ↗
              </Link>
            </div>
            <ProductOrderManager
              products={products.map(
                ({
                  id,
                  name,
                  category_id,
                  image_url,
                  is_active,
                  display_order,
                  price,
                  stock,
                  unlimited_stock,
                }) => ({
                  id,
                  name,
                  category_id,
                  image_url,
                  is_active,
                  display_order,
                  price: Number(price),
                  stock,
                  unlimited_stock,
                }),
              )}
              games={games}
              featuredId={settingsResult.data?.featured_product_id}
              categories={categories.map((item) => ({
                id: item.id,
                game_id: item.game_id,
                label: categoryNames.get(item.id) ?? item.name,
              }))}
              initialSearch={params.q ?? ""}
              initialCategoryId={allowedCategory}
              initialStatus={allowedStatus}
            />
          </div>
        </details>
      )}

      <details
        className="admin-form-details mt-6"
        id="novo-produto"
        open={params.novo === "1"}
      >
        <summary>
          <span>
            <strong className="block text-sm text-white">
              Cadastrar novo produto
            </strong>
            <small className="mt-1 block font-normal text-zinc-500">
              Fica fechado até você precisar adicionar um item.
            </small>
          </span>
          <span>+ Novo item ⌄</span>
        </summary>
        <div className="mt-5 border-t border-white/10 pt-5">
          {!categories.length && (
            <div className="admin-error">
              Cadastre um jogo e uma categoria antes de criar produtos.{" "}
              <Link href="/admin/catalogo" className="underline">
                Abrir catálogo ↗
              </Link>
            </div>
          )}
          <ProductEditor
            categories={categories}
            games={games}
            product={products.find((p) => p.id === params.duplicar)}
            duplicate={Boolean(params.duplicar)}
          />
        </div>
      </details>
    </main>
  );
}
