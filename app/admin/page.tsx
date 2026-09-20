import Link from "next/link";
import ProductImageUpload from "./produtos/ProductImageUpload";
import {
  createCategory,
  createGame,
  updateCategoryImage,
  updateGameImage,
} from "./actions";
import { createAdminClient } from "@/lib/supabase/admin";

type Game = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
};

type Category = {
  id: string;
  game_id: string;
  name: string;
  slug: string;
  image_url: string | null;
};

export default async function AdminPage() {
  const supabase = createAdminClient();
  const [{ data: games }, { data: categories }] = await Promise.all([
    supabase.from("games").select("id,name,slug,image_url").order("name"),
    supabase.from("categories").select("id,game_id,name,slug,image_url").order("name"),
  ]);

  const gameList = (games ?? []) as Game[];
  const categoryList = (categories ?? []) as Category[];
  const gameNames = new Map(gameList.map((game) => [game.id, game.name]));

  return (
    <main className="min-h-screen p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Gestão da loja</p><h1 className="section-title">Painel Cosmic</h1>
            <p className="mt-2 text-gray-400">Catálogo, pedidos e comunidade em um só lugar.</p>
          </div>
          <Link href="/" className="rounded-lg bg-[#17172b] px-4 py-2 text-sm hover:bg-[#252540]">
            Voltar à loja
          </Link>
        </div>

        <nav className="surface flex flex-wrap gap-3 rounded-3xl p-4">
          <Link href="/admin/produtos" className="rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">Produtos</Link>
          <Link href="/admin/pedidos" className="rounded-xl border border-purple-500/30 px-5 py-3 font-semibold hover:bg-purple-500/10">Pedidos</Link>
          <Link href="/admin/comunidade" className="rounded-xl border border-purple-500/30 px-5 py-3 font-semibold hover:bg-purple-500/10">Comunidade</Link>
          <Link href="/admin/suporte" className="rounded-xl border border-purple-500/30 px-5 py-3 font-semibold hover:bg-purple-500/10">Suporte</Link>
        </nav>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="surface rounded-3xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Cadastrar jogo</h2>
            <form action={createGame} className="mt-6 space-y-5">
              <div><label htmlFor="game_name" className="mb-2 block text-sm text-gray-300">Nome do jogo</label><input id="game_name" name="name" required minLength={2} maxLength={100} placeholder="Ex.: Blox Fruits" className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3"/></div>
              <div><label htmlFor="game_slug" className="mb-2 block text-sm text-gray-300">Identificador</label><input id="game_slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="Ex.: blox-fruits" className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3"/></div>
              <div><p className="mb-2 text-sm text-gray-300">Capa do jogo</p><ProductImageUpload inputId="new_game_image" /></div>
              <button className="rounded-lg bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-500">Cadastrar jogo</button>
            </form>
          </section>

          <section className="surface rounded-3xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold">Cadastrar categoria</h2>
            <form action={createCategory} className="mt-6 space-y-5">
              <div><label htmlFor="game_id" className="mb-2 block text-sm text-gray-300">Jogo</label><select id="game_id" name="game_id" required defaultValue="" className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3"><option value="" disabled>Selecione um jogo</option>{gameList.map(game=><option key={game.id} value={game.id}>{game.name}</option>)}</select></div>
              <div><label htmlFor="category_name" className="mb-2 block text-sm text-gray-300">Nome da categoria</label><input id="category_name" name="category_name" required minLength={2} maxLength={100} placeholder="Ex.: Frutas Permanentes" className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3"/></div>
              <div><label htmlFor="category_slug" className="mb-2 block text-sm text-gray-300">Identificador</label><input id="category_slug" name="category_slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="Ex.: frutas-permanentes" className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3"/></div>
              <div><p className="mb-2 text-sm text-gray-300">Capa da categoria</p><ProductImageUpload inputId="new_category_image" /></div>
              <button className="rounded-lg bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-500">Cadastrar categoria</button>
            </form>
          </section>
        </div>

        <section className="surface mt-8 rounded-3xl p-6 md:p-8">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-purple-400">Capas do catálogo</p><h2 className="mt-2 text-2xl font-semibold">Jogos</h2><p className="mt-2 text-sm text-gray-400">Troque a imagem exibida nas páginas inicial e Jogos.</p></div>
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {gameList.map((game) => <form key={game.id} action={updateGameImage} className="rounded-xl border border-white/10 bg-[#080812] p-4"><input type="hidden" name="game_id" value={game.id}/><h3 className="mb-3 font-bold">{game.name}</h3><ProductImageUpload inputId={`game_image_${game.id}`} defaultValue={game.image_url}/><button className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-500">Salvar capa do jogo</button></form>)}
            {!gameList.length&&<p className="text-gray-500">Nenhum jogo cadastrado.</p>}
          </div>
        </section>

        <section className="surface mt-8 rounded-3xl p-6 md:p-8">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-purple-400">Capas do catálogo</p><h2 className="mt-2 text-2xl font-semibold">Categorias</h2><p className="mt-2 text-sm text-gray-400">Use uma imagem diferente para Frutas Permanentes, Game Pass e outras categorias.</p></div>
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categoryList.map((category) => <form key={category.id} action={updateCategoryImage} className="rounded-xl border border-white/10 bg-[#080812] p-4"><input type="hidden" name="category_id" value={category.id}/><p className="text-xs font-bold uppercase tracking-wider text-purple-400">{gameNames.get(category.game_id) ?? "Jogo"}</p><h3 className="mb-3 mt-1 font-bold">{category.name}</h3><ProductImageUpload inputId={`category_image_${category.id}`} defaultValue={category.image_url}/><button className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-500">Salvar capa da categoria</button></form>)}
            {!categoryList.length&&<p className="text-gray-500">Nenhuma categoria cadastrada.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
