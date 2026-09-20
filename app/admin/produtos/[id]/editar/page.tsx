import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import EditProductForm from "./EditProductForm";
import { notFound } from "next/navigation";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const supabase = createAdminClient();

const { data: product, error } = await supabase
  .from("products")
  .select(
    "id, name, slug, description, price, stock, unlimited_stock, image_url, is_active"
  )
  .eq("id", id)
  .maybeSingle();

if (error) {
  console.error("Erro ao carregar produto:", error.code);
  throw new Error("Não foi possível carregar o produto.");
}

if (!product) {
  notFound();
}

  return (
    <main className="min-h-screen bg-[#080812] p-6 text-white">
      <div className="mx-auto max-w-3xl">

        <Link
          href="/admin/produtos"
          className="text-sm text-purple-400 hover:text-purple-300"
        >
          ← Voltar aos produtos
        </Link>

        <h1 className="mt-8 text-3xl font-bold">
  Editar produto: {product.name}
</h1>

<p className="mt-3 break-all text-sm text-gray-400">
  ID do produto: {id}
</p>

<div className="mt-8 rounded-2xl border border-purple-500/20 bg-[#111122] p-8">
  <EditProductForm product={product} />
</div>
      </div>
    </main>
  );
}