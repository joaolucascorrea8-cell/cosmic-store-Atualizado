import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/query-pages";
import type { Coupon } from "@/lib/coupons";
import CouponManager from "./CouponManager";
export default async function CouponsPage() {
  await requireAdmin();
  const client = createAdminClient();
  const [coupons, games, products] = await Promise.all([
    client.rpc("list_store_coupons"),
    allRows(client.from("games").select("id,name").order("name").order("id")),
    allRows(
      client.from("products").select("id,name").order("name").order("id"),
    ),
  ]);
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <p className="eyebrow">Promoções com controle</p>
      <h1 className="admin-title">Cupons</h1>
      <p className="admin-description">
        Defina descontos, validade e limites. O cliente aplica o código antes de
        gerar o Pix.
      </p>
      {coupons.error || games.error || products.error ? (
        <p className="admin-error mt-5">
          Não foi possível carregar os cupons. Confira a atualização SQL.
        </p>
      ) : (
        <CouponManager
          coupons={(coupons.data ?? []) as Coupon[]}
          games={games.data ?? []}
          products={products.data ?? []}
        />
      )}
    </main>
  );
}
