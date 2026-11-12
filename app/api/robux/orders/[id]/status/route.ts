import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
import { reconcileGamePassOrder } from "@/lib/gamepass-reconciliation";

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
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id,user_id,order_code,status,order_type,robux_orders(supplier_batch_id,supplier_order_id,supplier_status,executed_by,last_checked_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order || order.order_type !== "robux")
    return NextResponse.json(
      { error: "Pedido de Robux não encontrado." },
      { status: 404 },
    );

  if (order.user_id !== user.id) {
    const { data: staff } = await admin
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!staff)
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  return reconcileGamePassOrder(id);
}
