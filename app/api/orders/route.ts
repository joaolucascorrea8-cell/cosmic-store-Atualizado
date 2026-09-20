import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayload } from "@/lib/pix";

type RequestedItem = { id?: unknown; quantity?: unknown };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para finalizar." }, { status: 401 });

  const body = await request.json().catch(() => null) as { items?: RequestedItem[]; gameNickname?: unknown } | null;
  const nickname = typeof body?.gameNickname === "string" ? body.gameNickname.trim() : "";
  if (nickname.length < 2 || nickname.length > 60) return NextResponse.json({ error: "Informe um nickname válido do jogo." }, { status: 400 });

  const requested = (body?.items ?? []).map((item) => ({
    id: typeof item.id === "string" ? item.id : "",
    quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
  })).filter((item) => item.id);
  if (!requested.length) return NextResponse.json({ error: "O carrinho está vazio." }, { status: 400 });

  const ids = [...new Set(requested.map((item) => item.id))];
  const admin = createAdminClient();
  const { data: products, error: productsError } = await admin.from("products")
    .select("id,name,price,stock,unlimited_stock,is_active").in("id", ids);
  if (productsError || !products || products.length !== ids.length) return NextResponse.json({ error: "Um produto do carrinho não está mais disponível." }, { status: 400 });

  let itemRows: { product_id: string; product_name: string; unit_price: number; quantity: number }[];
  try {
    itemRows = requested.map((requestedItem) => {
      const product = products.find((entry) => entry.id === requestedItem.id);
      if (!product?.is_active) throw new Error("Produto indisponível.");
      if (!product.unlimited_stock && Number(product.stock) < requestedItem.quantity) throw new Error(`Estoque insuficiente para ${product.name}.`);
      return { product_id: product.id, product_name: product.name, unit_price: Number(product.price), quantity: requestedItem.quantity };
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Produto indisponível." }, { status: 400 });
  }

  const total = itemRows.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const orderCode = `COSMIC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  try {
    const pixPayload = createPixPayload(total, orderCode);
    const { data: order, error: orderError } = await admin.from("orders").insert({
      order_code: orderCode, user_id: user.id, game_nickname: nickname, total, pix_payload: pixPayload,
    }).select("id,order_code,status,total,pix_payload").single();
    if (orderError || !order) throw orderError ?? new Error("Não foi possível criar o pedido.");

    const { error: itemsError } = await admin.from("order_items").insert(itemRows.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    const qrCode = await QRCode.toDataURL(pixPayload, { width: 440, margin: 2, errorCorrectionLevel: "M" });
    return NextResponse.json({ order, qrCode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o pedido." }, { status: 400 });
  }
}
