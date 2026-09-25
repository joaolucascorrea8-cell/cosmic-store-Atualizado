import Link from "next/link";
import ProductImageUpload from "../produtos/ProductImageUpload";
import {
  createGame,
  createCategory,
  updateGameImage,
  updateCategoryImage,
  updateGameDetails,
  updateCategoryDetails,
  deleteEmptyGame,
  deleteEmptyCategory,
} from "../actions";
import NamedSlugFields from "../components/NamedSlugFields";
import PendingButton from "../components/PendingButton";
import ConfirmRemoveButton from "../components/ConfirmRemoveButton";
import CatalogOrderManager from "./CatalogOrderManager";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

type Game = { id: string; name: string; slug: string; image_url: string | null; is_active: boolean; display_order: number };
type Category = { id: string; game_id: string; name: string; slug: string; image_url: string | null; display_order: number };
type ProductRef = { category_id: string };

export default async function CatalogAdmin({ searchParams }: {
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const client = createAdminClient();
  const [gameResult, categoryResult, productResult] = await Promise.all([
    client.from("games").select("id,name,slug,image_url,is_active,display_order").order("display_order", { ascending: true }).order("name"),
    client.from("categories").select("id,game_id,name,slug,image_url,display_order").order("display_order", { ascending: true }).order("name"),
    client.from("products").select("category_id"),
  ]);
  const games = (gameResult.data ?? []) as Game[];
  const gamePosition = new Map(games.map((game, index) => [game.id, index]));
  const categories = ((categoryResult.data ?? []) as Category[]).sort(
    (a, b) =>
      (gamePosition.get(a.game_id) ?? 9999) - (gamePosition.get(b.game_id) ?? 9999) ||
      Number(a.display_order) - Number(b.display_order) ||
      a.name.localeCompare(b.name, "pt-BR")
  );
  const products = (productResult.data ?? []) as ProductRef[];
  const gameNames = new Map(games.map(game => [game.id, game.name]));

  return <main className="admin-page">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">ORGANIZAÇÃO DA LOJA</p>
        <h1 className="admin-title">Jogos e categorias</h1>
        <p className="admin-description">Organize jogos, categorias e suas capas. O cadastro de produtos fica separado para facilitar a gestão.</p>
      </div>
      <Link href="/admin/produtos" className="btn-secondary">Ir para produtos ↗</Link>
    </div>
    {(params.created || params.updated) && <p role="status" className="admin-notice mt-5">Alterações do catálogo salvas com sucesso.</p>}
    {(gameResult.error || categoryResult.error || productResult.error) && <p role="alert" className="admin-error mt-5">Falha ao carregar o catálogo. Recarregue a página antes de editar.</p>}

    {!gameResult.error && !categoryResult.error && <section className="admin-panel mt-7">
      <div className="admin-panel-heading">
        <div><p className="eyebrow">ORDEM NA LOJA</p><h2 className="mt-1">Organizar jogos e categorias</h2><p>Defina a ordem dos jogos e, dentro de cada jogo, a ordem das categorias.</p></div>
      </div>
      <CatalogOrderManager
        games={games.map(({ id, name, image_url, is_active, display_order }) => ({ id, name, image_url, is_active, display_order }))}
        categories={categories.map(({ id, game_id, name, image_url, display_order }) => ({ id, game_id, name, image_url, display_order }))}
      />
    </section>}

    <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><p className="eyebrow">ETAPA 01</p><h2 className="mt-1">Jogos</h2><p>{games.length} cadastrado(s). Comece criando um jogo.</p></div>
        </div>
        <details className="admin-form-details mt-5">
          <summary>+ Cadastrar novo jogo <span>⌄</span></summary>
          <form action={createGame} className="mt-5 space-y-4">
            <NamedSlugFields prefix="create-game" type="game" />
            <div><p className="admin-label">Capa do jogo (opcional)</p><ProductImageUpload inputId="new_game_image" /></div>
            <PendingButton className="btn-primary w-full">Cadastrar jogo</PendingButton>
          </form>
        </details>
        <div className="mt-5 max-h-[640px] space-y-2 overflow-y-auto pr-1">
          {games.map(game => {
            const childCount = categories.filter(item => item.game_id === game.id).length;
            return <details key={game.id} className="admin-item-details">
              <summary>
                <span className="admin-mini-preview">{game.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={game.image_url} alt="" /> : game.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{game.name}</strong>
                  <small className="text-zinc-500">{childCount} categoria(s) · {game.is_active ? "Publicado" : "Oculto"}</small>
                </span>
                <span className="text-xs text-violet-300">Gerenciar ⌄</span>
              </summary>
              <div className="mt-4 space-y-5 border-t border-white/10 pt-4">
                <form action={updateGameDetails} className="space-y-3">
                  <input type="hidden" name="game_id" value={game.id} />
                  <div><label className="admin-label" htmlFor={`edit-game-name-${game.id}`}>Nome do jogo</label><input className="admin-input" id={`edit-game-name-${game.id}`} name="name" defaultValue={game.name} minLength={2} maxLength={100} required /></div>
                  <div><label className="admin-label" htmlFor={`edit-game-slug-${game.id}`}>URL do jogo</label><input className="admin-input" id={`edit-game-slug-${game.id}`} name="slug" defaultValue={game.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /><p className="mt-1 text-xs text-zinc-500">Ao alterar, links antigos deixarão de funcionar.</p></div>
                  <div><label className="admin-label" htmlFor={`edit-game-active-${game.id}`}>Visibilidade</label><select className="admin-input" id={`edit-game-active-${game.id}`} name="is_active" defaultValue={String(game.is_active)}><option value="true">Publicado</option><option value="false">Oculto</option></select></div>
                  <PendingButton className="admin-small-button w-full">Salvar dados</PendingButton>
                </form>
                <form action={updateGameImage} className="space-y-3 border-t border-white/10 pt-4">
                  <input type="hidden" name="game_id" value={game.id} />
                  <p className="admin-label">Capa do jogo</p>
                  <ProductImageUpload inputId={`game-image-${game.id}`} defaultValue={game.image_url} />
                  <PendingButton className="admin-small-button w-full">Salvar capa</PendingButton>
                </form>
                <form action={deleteEmptyGame} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <input type="hidden" name="game_id" value={game.id} />
                  <span className="text-xs text-zinc-500">{childCount ? "Remova as categorias antes de excluir." : "Sem categorias vinculadas."}</span>
                  <ConfirmRemoveButton name={`o jogo ${game.name}`} disabled={childCount > 0 || !!categoryResult.error} />
                </form>
              </div>
            </details>;
          })}
          {!games.length && <p className="admin-empty">Nenhum jogo cadastrado. Use o formulário acima.</p>}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><p className="eyebrow">ETAPA 02</p><h2 className="mt-1">Categorias</h2><p>{categories.length} cadastrada(s). Organize por jogo.</p></div>
        </div>
        <details className="admin-form-details mt-5">
          <summary>+ Cadastrar nova categoria <span>⌄</span></summary>
          {games.length ? <form action={createCategory} className="mt-5 space-y-4">
            <div><label className="admin-label" htmlFor="category-game">Jogo</label><select id="category-game" name="game_id" defaultValue="" required className="admin-input"><option disabled value="">Selecione o jogo</option>{games.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}</select></div>
            <NamedSlugFields prefix="create-category" type="category" />
            <div><p className="admin-label">Capa da categoria (opcional)</p><ProductImageUpload inputId="new_category_image" /></div>
            <PendingButton className="btn-primary w-full">Cadastrar categoria</PendingButton>
          </form> : <p className="mt-4 text-sm text-amber-200">Cadastre um jogo antes de criar categorias.</p>}
        </details>
        <div className="mt-5 max-h-[640px] space-y-2 overflow-y-auto pr-1">
          {categories.map(category => {
            const productCount = products.filter(item => item.category_id === category.id).length;
            return <details key={category.id} className="admin-item-details">
              <summary>
                <span className="admin-mini-preview">{category.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={category.image_url} alt="" /> : category.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1"><small className="text-[10px] text-violet-300">{gameNames.get(category.game_id) ?? "Jogo"}</small><strong className="block truncate text-sm">{category.name}</strong><small className="text-zinc-500">{productCount} produto(s)</small></span>
                <span className="text-xs text-violet-300">Gerenciar ⌄</span>
              </summary>
              <div className="mt-4 space-y-5 border-t border-white/10 pt-4">
                <form action={updateCategoryDetails} className="space-y-3">
                  <input type="hidden" name="category_id" value={category.id} />
                  <div><label className="admin-label" htmlFor={`edit-category-name-${category.id}`}>Nome da categoria</label><input className="admin-input" id={`edit-category-name-${category.id}`} name="name" defaultValue={category.name} minLength={2} maxLength={100} required /></div>
                  <div><label className="admin-label" htmlFor={`edit-category-slug-${category.id}`}>URL da categoria</label><input className="admin-input" id={`edit-category-slug-${category.id}`} name="slug" defaultValue={category.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></div>
                  <PendingButton className="admin-small-button w-full">Salvar dados</PendingButton>
                </form>
                <form action={updateCategoryImage} className="space-y-3 border-t border-white/10 pt-4">
                  <input type="hidden" name="category_id" value={category.id} />
                  <p className="admin-label">Capa da categoria</p>
                  <ProductImageUpload inputId={`category-image-${category.id}`} defaultValue={category.image_url} />
                  <PendingButton className="admin-small-button w-full">Salvar capa</PendingButton>
                </form>
                <form action={deleteEmptyCategory} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <input type="hidden" name="category_id" value={category.id} />
                  <span className="text-xs text-zinc-500">{productCount ? "Remova os produtos antes de excluir." : "Sem produtos vinculados."}</span>
                  <ConfirmRemoveButton name={`a categoria ${category.name}`} disabled={productCount > 0 || !!productResult.error} />
                </form>
              </div>
            </details>;
          })}
          {!categories.length && <p className="admin-empty">Nenhuma categoria cadastrada.</p>}
        </div>
      </section>
    </div>
    <p className="mt-6 text-sm text-zinc-500">Para editar preços, estoque e fotos dos itens, acesse <Link className="text-violet-300 underline" href="/admin/produtos">Gerenciar produtos</Link>.</p>
  </main>;
}
