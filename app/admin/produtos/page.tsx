import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProduct, deleteProduct } from "../actions";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import ProductImageUpload from "./ProductImageUpload";

interface Game {
  name: string;
}

interface Category {
  id: string;
  name: string;
  games: Game[] | null;
}

interface Product {
  id: string;
  name: string;
  price: number | string;
  stock: number;
  unlimited_stock: boolean;
  is_active: boolean;
}

export default async function AdminProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string }>;
}) {
  await requireAdmin();

  const { sucesso } = await searchParams;
  const supabase = createAdminClient();

  // CARREGAR PRODUTOS
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, stock, unlimited_stock, is_active")
    .order("name");

  if (error) {
    console.error("Erro ao carregar produtos:", error.code);
  }

  // CARREGAR CATEGORIAS
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, games(name)")
    .order("name");

  if (categoriesError) {
    console.error(
      "Erro ao carregar categorias:",
      categoriesError.code
    );
  }

  return (
    <main className="min-h-screen bg-[#080812] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        {/* VOLTAR */}
        <Link
          href="/admin"
          className="text-sm text-purple-400 hover:text-purple-300"
        >
          ← Voltar ao painel
        </Link>

        {/* TÍTULO */}
        <h1 className="mt-8 text-3xl font-bold">
          Gerenciar produtos
        </h1>

        {/* MENSAGEM: PRODUTO CADASTRADO */}
        {sucesso === "produto-cadastrado" && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400"
          >
            Produto cadastrado com sucesso!
          </div>
        )}

        {/* MENSAGEM: PRODUTO EXCLUÍDO */}
        {sucesso === "produto-excluido" && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400"
          >
            Produto excluído com sucesso!
          </div>
        )}

        {sucesso === "produto-atualizado" && (
  <div
    role="status"
    className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300"
  >
    Produto atualizado com sucesso!
  </div>
)}

        {/* CADASTRAR PRODUTO */}
        <div className="mt-8 rounded-2xl border border-purple-500/20 bg-[#111122] p-8">
          <h2 className="text-xl font-semibold">
            Cadastrar produto
          </h2>

          <form action={createProduct} className="mt-6">
            {/* CATEGORIA */}
            <div>
              <label
                htmlFor="category_id"
                className="mb-2 block text-sm text-gray-300"
              >
                Categoria
              </label>

              <select
                id="category_id"
                name="category_id"
                defaultValue=""
                required
                disabled={
                  !!categoriesError || !categories?.length
                }
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              >
                <option value="" disabled>
                  Selecione uma categoria
                </option>

                {(categories ?? []).map((category: Category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.games?.[0]?.name ?? "Jogo"} —{" "}
                    {category.name}
                  </option>
                ))}
              </select>

              {categoriesError && (
                <p className="mt-2 text-sm text-red-400">
                  Não foi possível carregar as categorias.
                </p>
              )}
            </div>

            {/* NOME */}
            <div className="mt-5">
              <label
                htmlFor="product_name"
                className="mb-2 block text-sm text-gray-300"
              >
                Nome do produto
              </label>

              <input
                id="product_name"
                name="name"
                type="text"
                minLength={2}
                maxLength={100}
                required
                placeholder="Ex.: Leopard"
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              />
            </div>

            {/* SLUG */}
            <div className="mt-5">
              <label
                htmlFor="product_slug"
                className="mb-2 block text-sm text-gray-300"
              >
                Identificador (slug)
              </label>

              <input
                id="product_slug"
                name="slug"
                type="text"
                minLength={2}
                maxLength={100}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="Ex.: leopard-permanente"
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              />

              <p className="mt-2 text-xs text-gray-500">
                Use letras minúsculas, números e hífens,
                sem espaços.
              </p>
            </div>

            {/* PREÇO */}
            <div className="mt-5">
              <label
                htmlFor="product_price"
                className="mb-2 block text-sm text-gray-300"
              >
                Preço (R$)
              </label>

              <input
                id="product_price"
                name="price"
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                required
                placeholder="Ex.: 145.00"
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              />

              <p className="mt-2 text-xs text-gray-500">
                Informe o preço em reais. Exemplo: 145.00
                para R$ 145,00.
              </p>
            </div>

            {/* TIPO DE ESTOQUE */}
            <div className="mt-5">
              <label
                htmlFor="unlimited_stock"
                className="mb-2 block text-sm text-gray-300"
              >
                Tipo de estoque
              </label>

              <select
                id="unlimited_stock"
                name="unlimited_stock"
                defaultValue="true"
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              >
                <option value="true">
                  Ilimitado
                </option>

                <option value="false">
                  Por quantidade
                </option>
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Escolha se o produto terá estoque ilimitado
                ou uma quantidade definida.
              </p>
            </div>

            {/* QUANTIDADE */}
            <div className="mt-5">
              <label
                htmlFor="product_stock"
                className="mb-2 block text-sm text-gray-300"
              >
                Quantidade em estoque
              </label>

              <input
                id="product_stock"
                name="stock"
                type="number"
                min="0"
                max="2147483647"
                step="1"
                defaultValue="0"
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              />

              <p className="mt-2 text-xs text-gray-500">
                Para estoque ilimitado, deixe 0. Para estoque
                por quantidade, informe quantas unidades
                você possui.
              </p>
            </div>

            {/* DESCRIÇÃO */}
            <div className="mt-5">
              <label
                htmlFor="product_description"
                className="mb-2 block text-sm text-gray-300"
              >
                Descrição do produto
              </label>

              <textarea
                id="product_description"
                name="description"
                rows={4}
                maxLength={2000}
                placeholder="Ex.: Fruta permanente para sua conta de Blox Fruits."
                className="w-full resize-y rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
              />

              <p className="mt-2 text-xs text-gray-500">
                Descreva o que o cliente receberá.
                Este campo é opcional.
              </p>
            </div>

            {/* IMAGEM */}
            <div className="mt-5">
              <p className="mb-2 block text-sm text-gray-300">
                Imagem do produto
              </p>
              <ProductImageUpload inputId="product_image" />
            </div>

            {/* STATUS */}
            <div className="mt-5">
              <label
                htmlFor="product_active"
                className="mb-2 block text-sm text-gray-300"
              >
                Status do produto
              </label>

              <select
                id="product_active"
                name="is_active"
                defaultValue="true"
                className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white"
              >
                <option value="true">
                  Ativo
                </option>

                <option value="false">
                  Inativo
                </option>
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Produtos inativos não aparecem no catálogo
                público.
              </p>
            </div>

            {/* BOTÃO DE CADASTRO */}
            <button
              type="submit"
              disabled={
                !!categoriesError || !categories?.length
              }
              className="mt-8 w-full rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cadastrar produto
            </button>
          </form>
        </div>

        {/* LISTA DE PRODUTOS */}
        <p className="mt-8 text-gray-400">
          Cadastre e gerencie os produtos da Cosmic Store.
        </p>

        <div className="mt-8 rounded-2xl border border-purple-500/20 bg-[#111122] p-8">
          <h2 className="text-xl font-semibold">
            Produtos
          </h2>

          {error ? (
            <p className="mt-4 text-red-400">
              Não foi possível carregar os produtos.
            </p>
          ) : !products || products.length === 0 ? (
            <p className="mt-4 text-gray-400">
              Nenhum produto cadastrado.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {products.map((product: Product) => (
                <div
                  key={product.id}
                  className="flex flex-col gap-4 rounded-xl border border-purple-500/20 bg-[#080812] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="text-lg font-semibold">
                      {product.name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-400">
                      {product.unlimited_stock
                        ? "Estoque ilimitado"
                        : `Estoque: ${product.stock} unidade(s)`}
                    </p>

                    <p
                      className={`mt-1 text-sm ${
                        product.is_active
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {product.is_active
                        ? "Ativo"
                        : "Inativo"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span>
                      {Number(product.price).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>

                    <Link
  href={`/admin/produtos/${product.id}/editar`}
  className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm text-purple-300 transition hover:bg-purple-500/10"
>
  Editar
</Link>

                    {/* EXCLUIR SOMENTE PRODUTOS INATIVOS */}
                    {!product.is_active && (
                      <form action={deleteProduct}>
                        <input
                          type="hidden"
                          name="product_id"
                          value={product.id}
                        />

                        <ConfirmDeleteButton />
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
