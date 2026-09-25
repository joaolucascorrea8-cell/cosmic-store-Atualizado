import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProduct, deleteProduct } from "../actions";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import ProductImageUpload from "./ProductImageUpload";
import PendingButton from "../components/PendingButton";
import ProductBasics from "../components/ProductBasics";
import ProductOrderManager from "./ProductOrderManager";

type Product = { id: string; name: string; slug: string; category_id: string; price: number; stock: number; unlimited_stock: boolean; is_active: boolean; image_url: string | null; display_order: number };
type Category = { id: string; name: string; game_id: string; display_order: number };
type Game = { id: string; name: string; display_order: number };
type Params = { sucesso?: string; q?: string; status?: string; category?: string; p?: string; novo?: string };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const params = await searchParams;
  const client = createAdminClient();
  const [productResult, categoryResult, gameResult] = await Promise.all([
    client.from("products").select("id,name,slug,category_id,price,stock,unlimited_stock,is_active,image_url,display_order").order("display_order", { ascending: true }).order("name", { ascending: true }),
    client.from("categories").select("id,name,game_id,display_order").order("display_order", { ascending: true }).order("name"),
    client.from("games").select("id,name,display_order").order("display_order", { ascending: true }).order("name"),
  ]);

  const products = (productResult.data ?? []) as Product[];
  const games = (gameResult.data ?? []) as Game[];
  const gamePosition = new Map(games.map((game, index) => [game.id, index]));
  const categories = ((categoryResult.data ?? []) as Category[]).sort(
    (a, b) =>
      (gamePosition.get(a.game_id) ?? 9999) - (gamePosition.get(b.game_id) ?? 9999) ||
      Number(a.display_order) - Number(b.display_order) ||
      a.name.localeCompare(b.name, "pt-BR")
  );
  const gameNames = new Map(games.map((game) => [game.id, game.name]));
  const categoryNames = new Map(categories.map((category) => [category.id, `${gameNames.get(category.game_id) ?? "Jogo"} · ${category.name}`]));
  const displayPositions = new Map(products.map((product, index) => [product.id, index + 1]));

  const q = (params.q ?? "").trim().toLowerCase();
  const status = params.status ?? "";
  const category = params.category ?? "";
  const filtered = products.filter((product) =>
    (!q || `${product.name} ${product.slug} ${categoryNames.get(product.category_id) ?? ""}`.toLowerCase().includes(q)) &&
    (!category || product.category_id === category) &&
    (!status || (status === "active" ? product.is_active : status === "inactive" ? !product.is_active : status === "out" ? !product.unlimited_stock && product.stock < 1 : true))
  );

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Number.parseInt(params.p ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const pagedProducts = filtered.slice((page - 1) * pageSize, page * pageSize);
  const inventoryOpen = Boolean(params.q || params.status || params.category || params.p);

  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (status) query.set("status", status);
    if (category) query.set("category", category);
    query.set("p", String(nextPage));
    const suffix = query.toString();
    return `/admin/produtos${suffix ? `?${suffix}` : ""}#estoque-catalogo`;
  }

  return <main className="admin-page">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">GESTÃO DE ITENS</p><h1 className="admin-title">Produtos</h1><p className="admin-description">Organize a vitrine e abra estoque, filtros ou cadastro somente quando precisar.</p></div>
      <Link href="/admin/produtos?novo=1#novo-produto" className="btn-primary">+ Novo produto</Link>
    </div>

    {params.sucesso && <p role="status" className="admin-notice mt-5">{params.sucesso === "produto-cadastrado" ? "Produto cadastrado com sucesso." : params.sucesso === "produto-excluido" ? "Produto excluído com sucesso." : "Produto atualizado com sucesso."}</p>}
    {(productResult.error || categoryResult.error || gameResult.error) && <p role="alert" className="admin-error mt-5">Não foi possível carregar parte do catálogo. Atualize a página.</p>}

    {!productResult.error && <section className="admin-panel mt-7">
      <div className="admin-panel-heading"><div><p className="eyebrow">ORDEM DA VITRINE</p><h2 className="mt-1">Organizar produtos</h2><p>Defina exatamente qual item aparece primeiro, segundo, terceiro e assim por diante.</p></div></div>
      <ProductOrderManager products={products.map(({ id, name, category_id, image_url, is_active, display_order }) => ({ id, name, category_id, image_url, is_active, display_order }))} categories={categories.map((item) => ({ id: item.id, label: categoryNames.get(item.id) ?? item.name }))} />
    </section>}

    <details id="estoque-catalogo" className="admin-form-details mt-6" open={inventoryOpen}>
      <summary>
        <span className="min-w-0"><strong className="block text-sm text-white">Estoque e catálogo</strong><small className="mt-1 block font-normal text-zinc-500">{products.length} produtos · {products.filter((p) => p.is_active).length} publicados · {products.filter((p) => !p.unlimited_stock && p.stock < 1).length} esgotados</small></span>
        <span className="shrink-0">Abrir gestão ⌄</span>
      </summary>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-zinc-500">A lista mostra até {pageSize} produtos por página para o painel continuar leve e fácil de navegar.</p>
          <Link href="/admin/catalogo" className="text-xs font-bold text-violet-300 hover:text-white">Gerenciar jogos e categorias ↗</Link>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_230px_170px_auto_auto]"><input type="hidden" name="p" value="1" />
          <label htmlFor="product-search" className="sr-only">Buscar produto</label>
          <input className="admin-input" id="product-search" name="q" defaultValue={params.q ?? ""} placeholder="Buscar por nome ou categoria" />
          <label htmlFor="filter-category" className="sr-only">Filtrar categoria</label>
          <select className="admin-input" id="filter-category" name="category" defaultValue={category}><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.id} value={item.id}>{categoryNames.get(item.id)}</option>)}</select>
          <label htmlFor="filter-status" className="sr-only">Filtrar status</label>
          <select className="admin-input" id="filter-status" name="status" defaultValue={status}><option value="">Todos os status</option><option value="active">Publicados</option><option value="inactive">Inativos</option><option value="out">Esgotados</option></select>
          <button type="submit" className="btn-primary">Filtrar</button>
          {(q || status || category) ? <Link href="/admin/produtos?p=1#estoque-catalogo" className="btn-secondary text-center">Limpar</Link> : <span />}
        </form>

        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500"><p role="status">{filtered.length} resultado(s)</p>{filtered.length > pageSize && <p>Página {page} de {totalPages}</p>}</div>
          {pagedProducts.map((product) => <article key={product.id} className="admin-product-row">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-violet-500/10"><Image src={product.image_url || "/images/products/placeholder.svg"} alt="" fill sizes="56px" className="object-contain p-1" /></div>
            <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{product.name}</h3><p className="mt-1 truncate text-xs text-zinc-500">{categoryNames.get(product.category_id) ?? "Categoria não encontrada"}</p><p className="mt-1 text-xs text-zinc-400">Ordem #{displayPositions.get(product.id)} · {product.unlimited_stock ? "Estoque ilimitado" : `${product.stock} em estoque`} · <span className={product.is_active ? "text-emerald-300" : "text-amber-300"}>{product.is_active ? "Publicado" : "Inativo"}</span></p></div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2"><strong className="w-full text-right text-sm sm:w-auto">{Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><Link href={`/admin/produtos/${product.id}/editar`} className="admin-small-button">Editar ↗</Link>{!product.is_active && <form action={deleteProduct}><input name="product_id" type="hidden" value={product.id} /><ConfirmDeleteButton /></form>}</div>
          </article>)}
          {!filtered.length && <div className="admin-empty">Nenhum produto corresponde aos filtros. <Link className="text-violet-300 underline" href="/admin/produtos?p=1#estoque-catalogo">Limpar filtros</Link></div>}
        </div>

        {totalPages > 1 && <nav aria-label="Paginação do catálogo administrativo" className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link aria-disabled={page <= 1} className={`admin-small-button ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(Math.max(1, page - 1))}>← Anterior</Link>
          {Array.from({ length: totalPages }, (_, index) => index + 1).filter((number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1).map((number, index, visiblePages) => <span key={number} className="contents">{index > 0 && number - visiblePages[index - 1] > 1 && <span className="px-1 text-zinc-600">…</span>}<Link href={pageHref(number)} aria-current={number === page ? "page" : undefined} className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-xs font-black ${number === page ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-white/10 bg-white/[.03] text-zinc-400 hover:text-white"}`}>{number}</Link></span>)}
          <Link aria-disabled={page >= totalPages} className={`admin-small-button ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(Math.min(totalPages, page + 1))}>Próxima →</Link>
        </nav>}
      </div>
    </details>

    <details className="admin-form-details mt-6" id="novo-produto" open={params.novo === "1"}>
      <summary><span><strong className="block text-sm text-white">Cadastrar novo produto</strong><small className="mt-1 block font-normal text-zinc-500">Abra somente quando for adicionar um item novo.</small></span><span>+ Novo item ⌄</span></summary>
      <div className="mt-5 border-t border-white/10 pt-5">
        {!categories.length && <div className="admin-error">Cadastre um jogo e uma categoria antes de criar produtos. <Link href="/admin/catalogo" className="underline">Abrir catálogo ↗</Link></div>}
        <form action={createProduct} className="mt-5 space-y-5">
          <div><label className="admin-label" htmlFor="create-product-category">Jogo e categoria</label><select id="create-product-category" className="admin-input" name="category_id" defaultValue="" disabled={!categories.length} required><option value="" disabled>Selecione uma categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{categoryNames.get(item.id)}</option>)}</select></div>
          <ProductBasics />
          <div><label className="admin-label" htmlFor="product-description">Descrição do que o cliente recebe</label><textarea className="admin-input min-h-24" id="product-description" name="description" maxLength={2000} rows={3} placeholder="Descreva o item e a forma de entrega." /></div>
          <div><p className="admin-label">Imagem do produto</p><ProductImageUpload inputId="product_image" /></div>
          <div><label className="admin-label" htmlFor="create-product-status">Visibilidade</label><select className="admin-input" id="create-product-status" name="is_active" defaultValue="false"><option value="false">Rascunho — não publicar ainda</option><option value="true">Publicado — disponível na loja</option></select><p className="mt-1.5 text-xs text-zinc-500">Comece como rascunho se precisar conferir preço e imagem.</p></div>
          <PendingButton className="btn-primary w-full">Cadastrar produto</PendingButton>
        </form>
      </div>
    </details>
  </main>;
}
