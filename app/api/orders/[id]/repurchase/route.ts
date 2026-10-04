import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/catalog";
import { comboMaxQuantity, type ComboNestedItem } from "@/lib/combos";
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
  const lines = order.order_items ?? [],
    ids = lines.flatMap((i) => (i.product_id ? [i.product_id] : [])),
    combos = lines.flatMap((i) => (i.combo_id ? [i.combo_id] : []));
  const [products, bundles] = await Promise.all([
    ids.length
      ? client
          .from("products")
          .select(
            "id,name,slug,price,image_url,stock,unlimited_stock,is_active,categories(games(is_active))",
          )
          .in("id", ids)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    combos.length
      ? client
          .from("combos")
          .select(
            "id,name,slug,price,image_url,is_active,starts_at,ends_at,combo_items(quantity,products(id,name,stock,unlimited_stock,is_active,categories(games(is_active))))",
          )
          .in("id", combos)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (products.error || bundles.error)
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
    kind: "product" | "combo";
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
    const product = products.data?.find((p) => p.id === line.product_id);
    const combo = bundles.data?.find((c) => c.id === line.combo_id);
    let available = 0;
    if (product && gameActive(product.categories))
      available = product.unlimited_stock ? 99 : Math.min(99, product.stock);
    if (
      combo &&
      (!combo.starts_at || new Date(combo.starts_at).getTime() <= Date.now()) &&
      (!combo.ends_at || new Date(combo.ends_at).getTime() > Date.now())
    ) {
      const components = combo.combo_items.map((entry) => {
        const p = Array.isArray(entry.products)
          ? entry.products[0]
          : entry.products;
        return {
          quantity: entry.quantity,
          products: p
            ? { ...p, is_active: p.is_active && gameActive(p.categories) }
            : null,
        };
      });
      available = comboMaxQuantity(components as ComboNestedItem[]);
    }
    const current = product ?? combo;
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
      kind: product ? "product" : "combo",
      stock: available,
      unlimited_stock: product?.unlimited_stock ?? false,
    });
  }
  return NextResponse.json(
    { items, warnings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
