import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/safe-redirect";
import EditProductForm from "./EditProductForm";

function safeReturnTo(value: string | undefined) {
  const fallback = "/admin/produtos#estoque-catalogo";
  const safe = safeInternalPath(value, fallback);
  return safe === "/admin/produtos" || safe.startsWith("/admin/produtos?") || safe.startsWith("/admin/produtos#") ? safe : fallback;
}

export default async function EditarProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo);
  const supabase = createAdminClient();

  const [productResult, categoryResult, gameResult] = await Promise.all([
    supabase.from("products").select("id,name,slug,category_id,description,price,stock,unlimited_stock,image_url,is_active").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,name,game_id,display_order").order("display_order", { ascending: true }).order("name"),
    supabase.from("games").select("id,name,display_order").order("display_order", { ascending: true }).order("name"),
  ]);

  if (productResult.error) {
    console.error("Erro ao carregar produto:", productResult.error.code);
    throw new Error("Não foi possível carregar o produto.");
  }
  if (!productResult.data) notFound();

  const games = gameResult.data ?? [];
  const gameNames = new Map(games.map((game) => [game.id, game.name]));
  const categories = (categoryResult.data ?? []).map((category) => ({
    id: category.id,
    label: `${gameNames.get(category.game_id) ?? "Jogo"} · ${category.name}`,
  }));

  return (
    <main className="min-h-screen bg-[#080812] p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href={returnTo} className="text-sm text-purple-400 hover:text-purple-300">← Voltar aos produtos com os mesmos filtros</Link>

        <h1 className="mt-8 text-3xl font-bold">Editar produto: {productResult.data.name}</h1>
        <p className="mt-3 break-all text-sm text-gray-400">ID do produto: {id}</p>
        <p className="mt-2 text-xs text-zinc-500">Ao salvar e voltar, sua busca, categoria, status e página do catálogo serão preservados.</p>

        <div className="mt-8 rounded-2xl border border-purple-500/20 bg-[#111122] p-5 sm:p-8">
          <EditProductForm product={productResult.data} categories={categories} returnTo={returnTo} />
        </div>
      </div>
    </main>
  );
}
