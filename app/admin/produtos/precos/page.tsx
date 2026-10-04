import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/query-pages";
import PriceManager from "./PriceManager";
export default async function PricesPage() {
  await requireAdmin();
  const client = createAdminClient();
  const [categories, games, batches] = await Promise.all([
    allRows(
      client
        .from("categories")
        .select("id,name,game_id,robux_pricing_enabled")
        .order("display_order")
        .order("id"),
    ),
    allRows(
      client.from("games").select("id,name").order("display_order").order("id"),
    ),
    client
      .from("price_batches")
      .select("id,new_rate,initial_rate,status,created_at,applied_at")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <Link href="/admin/produtos" className="text-sm text-violet-300">
        ← Produtos
      </Link>
      <h1 className="admin-title mt-4">Preços por Robux</h1>
      <p className="admin-description">
        Sua tabela acompanha a cotação, inclusive o acréscimo dos itens abaixo
        de 1K. Frutas físicas podem continuar com preço manual.
      </p>
      {categories.error || games.error || batches.error ? (
        <p className="admin-error mt-6">
          Não foi possível carregar as regras. Confira a atualização SQL.
        </p>
      ) : (
        <PriceManager
          categories={categories.data ?? []}
          games={games.data ?? []}
          history={batches.data ?? []}
        />
      )}
    </main>
  );
}
