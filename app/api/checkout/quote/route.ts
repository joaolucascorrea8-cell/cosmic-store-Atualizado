import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutItems } from "@/lib/checkout-request";
import { couponCode } from "@/lib/coupons";
export async function POST(request: Request) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para conferir o pedido." },
      { status: 401 },
    );
  const body = await request.json().catch(() => null);
  const items = checkoutItems(body?.items),
    code = couponCode(body?.couponCode);
  if (!items || code.length > 30)
    return NextResponse.json(
      { error: "Confira os itens e o cupom." },
      { status: 400 },
    );
  const { data, error } = await createAdminClient().rpc(
    "quote_store_checkout",
    { p_user_id: user.id, p_items: items, p_code: code },
  );
  if (error) {
    if (error.code !== "P0001") console.error("[checkout/quote]", error);
    return NextResponse.json(
      {
        error:
          error.code === "P0001"
            ? error.message
            : "Não foi possível conferir os valores agora.",
      },
      { status: error.code === "P0001" ? 409 : 500 },
    );
  }
  const { subtotal, discount, total, code: appliedCode, delivery_hours } = data;
  return NextResponse.json(
    { quote: { subtotal, discount, total, code: appliedCode, delivery_hours } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
