import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/catalog";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { data: order, error } = await client
    .from("orders")
    .select("id,order_items(product_id,combo_id,product_name,quantity)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !order)
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    );
  const lines = order.order_items ?? [];
  const ids = lines.flatMap((item) => item.product_id && !item.combo_id ? [item.product_id] : []);
  const products = ids.length
    ? await client
        .from("products")
        .select("id,name,slug,price,image_url,stock,unlimited_stock,is_active,categories(games(is_active))")
        .in("id", ids)
        .eq("is_active", true)
    : { data: [], error: null };
  if (products.error)
    return NextResponse.json(
      { error: "Não foi possível conferir os itens atuais." },
      { status: 500 },
    );
  const warnings: string[] = [];
  const items: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
    kind: "product";
    quantity: number;
    stock: number;
    unlimited_stock: boolean;
  }[] = [];
  const gameActive = (category: unknown): boolean => {
    const c = (Array.isArray(category) ? category[0] : category) as {
      games?: { is_active?: boolean } | { is_active?: boolean }[];
    } | null;
    const g = Array.isArray(c?.games) ? c.games[0] : c?.games;
    return g?.is_active === true;
  };
  for (const line of lines) {
    if (line.combo_id) {
      warnings.push(`${line.product_name}: combos foram descontinuados.`);
      continue;
    }
    const product = products.data?.find((p) => p.id === line.product_id);
    let available = 0;
    if (product && gameActive(product.categories))
      available = product.unlimited_stock ? 99 : Math.min(99, product.stock);
    const current = product;
    if (!current || available < 1) {
      warnings.push(`${line.product_name}: indisponível.`);
      continue;
    }
    const quantity = Math.min(line.quantity, available);
    if (quantity < line.quantity)
      warnings.push(`${current.name}: quantidade ajustada ao estoque atual.`);
    items.push({
      id: current.id,
      name: current.name,
      slug: current.slug,
      price: Number(current.price),
      image_url: current.image_url,
      quantity,
      kind: "product",
      stock: available,
      unlimited_stock: product?.unlimited_stock ?? false,
    });
  }
  return NextResponse.json(
    { items, warnings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
