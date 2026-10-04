import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/query-pages";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import ProductPreferenceButton from "@/app/components/ProductPreferenceButton";
export const metadata = {
  title: "Favoritos e reposição",
  robots: { index: false, follow: false },
};
export default async function FavoritesPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/conta/favoritos");
  const { data, error } = await allRows(
    client
      .from("customer_product_preferences")
      .select(
        "product_id,favorite,restock,products(id,name,slug,description,price,image_url,stock,unlimited_stock,is_active,categories(games(is_active)))",
      )
      .eq("user_id", user.id)
      .or("favorite.eq.true,restock.eq.true")
      .order("updated_at", { ascending: false })
      .order("product_id"),
  );
  return (
    <>
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="shell py-10">
        <Link href="/conta" className="text-sm text-zinc-400">
          ← Minha conta
        </Link>
        <p className="eyebrow mt-6">Sua seleção</p>
        <h1 className="section-title">Favoritos e reposição</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
          Guarde os itens que você quer comprar e acompanhe seus avisos de
          estoque. Preços e disponibilidade podem mudar.
        </p>
        {error ? (
          <p role="alert" className="admin-error mt-6">
            Não foi possível carregar sua seleção. Tente novamente.
          </p>
        ) : (
          <div className="product-grid mt-7">
            {data?.map((row) => {
              const raw = Array.isArray(row.products)
                ? row.products[0]
                : row.products;
              const product = raw as unknown as {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                price: number;
                image_url: string | null;
                stock: number;
                unlimited_stock: boolean;
                is_active: boolean;
                categories: { games: { is_active: boolean } } | null;
              } | null;
              const visible =
                product?.is_active && product.categories?.games?.is_active;
              return (
                <div key={row.product_id} className="min-w-0">
                  {visible && product ? (
                    <ProductCard produto={product} />
                  ) : (
                    <div className="surface rounded-xl p-5">
                      <p className="text-sm text-zinc-400">
                        Este produto está indisponível.
                      </p>
                      {row.favorite && (
                        <ProductPreferenceButton id={row.product_id} />
                      )}
                    </div>
                  )}
                  {row.restock && (
                    <ProductPreferenceButton
                      id={row.product_id}
                      kind="restock"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!error && !data?.length && (
          <div className="empty-store-state mt-8 p-8">
            <h2 className="text-lg font-bold">Sua seleção começa aqui</h2>
            <p className="mt-2 text-sm">
              Toque no coração de um produto para guardar.
            </p>
            <Link href="/produtos" className="btn-primary mt-5">
              Explorar produtos
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
