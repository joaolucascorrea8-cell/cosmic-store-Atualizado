import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayload } from "@/lib/pix";

type RequestedItem = { id?: unknown; quantity?: unknown };
type CreatedOrder = { id: string; order_code: string; status: string; total: number; pix_payload: string };
async function orderResponse(order: CreatedOrder) {
  const qrCode = await QRCode.toDataURL(order.pix_payload, { width: 440, margin: 2, errorCorrectionLevel: "M" });
  return NextResponse.json({ order, qrCode });
}
export async function POST(request: Request) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para finalizar." }, { status: 401 });
  const body = await request.json().catch(() => null) as { items?: RequestedItem[]; gameNickname?: unknown; checkoutToken?: unknown } | null;
  const nickname = typeof body?.gameNickname === "string" ? body.gameNickname.trim() : "";
  if (nickname.length < 2 || nickname.length > 60) return NextResponse.json({ error: "Informe um nickname válido do jogo." }, { status: 400 });
  const token = typeof body?.checkoutToken === "string" ? body.checkoutToken : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) return NextResponse.json({ error: "Sessão de checkout inválida. Atualize a página." }, { status: 400 });
  const admin = createAdminClient();
  const existing = await admin.from("orders").select("id,order_code,status,total,pix_payload").eq("user_id", user.id).eq("checkout_token", token).maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Não foi possível verificar o pedido. Confirme a migração do banco de dados." }, { status: 500 });
  if (existing.data) return orderResponse(existing.data);
  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > 40) return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
  const requested = body.items.map(item => ({ id: item && typeof item === "object" && typeof item.id === "string" ? item.id : "", quantity: item && typeof item === "object" ? item.quantity : null }));
  if (requested.some(item => !/^[0-9a-f-]{36}$/i.test(item.id) || typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 99) || new Set(requested.map(item => item.id)).size !== requested.length) return NextResponse.json({ error: "Itens ou quantidades inválidos." }, { status: 400 });
  const { data: products, error: productsError } = await admin.from("products").select("id,name,price,stock,unlimited_stock,is_active").in("id", requested.map(item => item.id));
  if (productsError || !products || products.length !== requested.length) return NextResponse.json({ error: "Um produto não está mais disponível." }, { status: 400 });
  let itemRows: { product_id: string; product_name: string; unit_price: number; quantity: number }[];
  try {
    itemRows = requested.map(item => {
      const product = products.find(entry => entry.id === item.id);
      if (!product?.is_active) throw new Error("Produto indisponível.");
      if (!product.unlimited_stock && Number(product.stock) < Number(item.quantity)) throw new Error(`Estoque insuficiente para ${product.name}.`);
      if (!Number.isFinite(Number(product.price)) || Number(product.price) < 0) throw new Error("Preço inválido.");
      return { product_id: product.id, product_name: product.name, unit_price: Number(product.price), quantity: Number(item.quantity) };
    });
  } catch (error) {return NextResponse.json({ error: error instanceof Error ? error.message : "Produto indisponível." }, { status: 400 });}
  const total = Math.round(itemRows.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) * 100) / 100;
  if (total <= 0) return NextResponse.json({ error: "O total do pedido deve ser positivo." }, { status: 400 });
  const orderCode = `COSMIC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  try {
    const pixPayload = createPixPayload(total, orderCode);
    const { data: order, error: orderError } = await admin.from("orders").insert({ order_code: orderCode, user_id: user.id, game_nickname: nickname, total, pix_payload: pixPayload, checkout_token: token }).select("id,order_code,status,total,pix_payload").single();
    if (orderError || !order) {
      // In concurrent retries, the unique token can already belong to a successful request.
      if (orderError?.code === "23505") {
        const { data: retry } = await admin.from("orders").select("id,order_code,status,total,pix_payload").eq("user_id", user.id).eq("checkout_token", token).maybeSingle();
        if (retry) return orderResponse(retry);
      }
      throw orderError ?? new Error("Não foi possível criar o pedido.");
    }
    const { error: itemsError } = await admin.from("order_items").insert(itemRows.map(item => ({ ...item, order_id: order.id })));
    if (itemsError) {await admin.from("orders").delete().eq("id", order.id).eq("status", "awaiting_payment");throw itemsError;}
    return orderResponse(order);
  } catch (error) {
    console.error("Falha no checkout:", error instanceof Error ? error.message : "Erro desconhecido");
    return NextResponse.json({ error: "Não foi possível criar o pedido. Tente novamente sem pagar duas vezes." }, { status: 500 });
  }
}
