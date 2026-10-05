import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
import {
  findByRobuxOrderByBatchId,
  friendlyByRobuxError,
} from "@/lib/byrobux";
import {
  createAdminNotifications,
  notifyCustomer,
} from "@/lib/notifications";
import { sendOrderStatusEmail } from "@/lib/order-emails";

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function currentAdminId(preferred?: string | null) {
  const admin = createAdminClient();
  if (preferred) {
    const { data } = await admin
      .from("admins")
      .select("user_id")
      .eq("user_id", preferred)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }
  const { data } = await admin
    .from("admins")
    .select("user_id")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

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

  const details = relation(order.robux_orders);
  if (!details)
    return NextResponse.json(
      { error: "Detalhes de Robux ausentes." },
      { status: 404 },
    );

  // Capture the narrowed values before entering the nested function.
  // TypeScript does not keep the outer nullability narrowing inside closures.
  const safeOrder = order;
  const safeDetails = details;

  async function finalizeCompleted() {
    const actor = await currentAdminId(safeDetails.executed_by);
    if (!actor) throw new Error("Nenhum administrador disponível para concluir o pedido.");
    let currentStatus = safeOrder.status;
    let changed = false;
    if (currentStatus === "paid") {
      const prep = await admin.rpc("transition_store_order", {
        p_order_id: id,
        p_admin_id: actor,
        p_status: "preparing_delivery",
        p_expected_status: "paid",
        p_reason: "",
      });
      if (prep.error) throw prep.error;
      currentStatus = "preparing_delivery";
      changed = Boolean(prep.data?.changed) || changed;
    }
    if (currentStatus === "preparing_delivery") {
      const done = await admin.rpc("transition_store_order", {
        p_order_id: id,
        p_admin_id: actor,
        p_status: "delivered",
        p_expected_status: "preparing_delivery",
        p_reason: "",
      });
      if (done.error) throw done.error;
      if (done.data?.changed) {
        changed = true;
        await Promise.allSettled([
          notifyCustomer(
            safeOrder.user_id,
            "GamePass comprado com sucesso",
            `A compra do GamePass do pedido ${safeOrder.order_code} foi concluída. Agora os Robux ficam sujeitos ao período de pendência do Roblox.`,
            `/pedidos/${id}`,
          ),
          sendOrderStatusEmail(id, "delivery"),
        ]);
      }
    }
    return changed;
  }

  if (details.supplier_status === "COMPLETED" && order.status !== "delivered") {
    try {
      const changed = await finalizeCompleted();
      return NextResponse.json({ status: "COMPLETED", orderStatus: "delivered", changed });
    } catch (error) {
      console.error("[robux/status/finalize]", error);
      return NextResponse.json({ error: "A compra foi concluída, mas o pedido ainda precisa ser finalizado pela Cosmic." }, { status: 503 });
    }
  }
  if (details.supplier_status !== "PENDING" || !details.supplier_batch_id)
    return NextResponse.json({
      status: details.supplier_status,
      orderStatus: order.status,
      changed: false,
    });

  try {
    const supplierOrder = await findByRobuxOrderByBatchId(
      details.supplier_batch_id,
    );
    if (!supplierOrder) {
      await admin
        .from("robux_orders")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("order_id", id);
      return NextResponse.json({
        status: "PENDING",
        orderStatus: order.status,
        changed: false,
      });
    }

    const rawSupplierStatus = String(supplierOrder.status).toUpperCase();
    const supplierStatus = ["PENDING", "COMPLETED", "CANCELLED"].includes(rawSupplierStatus)
      ? rawSupplierStatus
      : "PENDING";
    const now = new Date().toISOString();
    const { data: updated } = await admin
      .from("robux_orders")
      .update({
        supplier_order_id: supplierOrder.id,
        supplier_status: supplierStatus,
        last_checked_at: now,
        completed_at: supplierStatus === "COMPLETED" ? now : null,
        supplier_error_code:
          supplierStatus === "CANCELLED" ? "CANCELLED" : null,
        supplier_error_message:
          supplierStatus === "CANCELLED"
            ? "A compra foi cancelada pelo processador. O saldo não deve ter sido debitado."
            : null,
      })
      .eq("order_id", id)
      .eq("supplier_status", "PENDING")
      .select("order_id")
      .maybeSingle();

    if (!updated) {
      return NextResponse.json({
        status: supplierStatus,
        orderStatus: order.status,
        changed: false,
      });
    }

    if (supplierStatus === "COMPLETED") {
      await finalizeCompleted();
      return NextResponse.json({
        status: "COMPLETED",
        orderStatus: "delivered",
        changed: true,
      });
    }

    if (supplierStatus === "CANCELLED") {
      await Promise.allSettled([
        createAdminNotifications(
          "Compra automática de Robux cancelada",
          `A ByRobux cancelou o processamento do pedido ${order.order_code}. Revise o saldo/cotação e tente novamente.`,
          `/admin/pedidos/${id}`,
          order.user_id,
        ),
        notifyCustomer(
          order.user_id,
          "Estamos revisando sua entrega de Robux",
          `A compra automática do pedido ${order.order_code} não foi concluída. Seu pagamento continua confirmado e a equipe foi avisada para tentar novamente.`,
          `/pedidos/${id}`,
        ),
      ]);
      return NextResponse.json({
        status: "CANCELLED",
        orderStatus: order.status,
        changed: true,
      });
    }

    return NextResponse.json({
      status: supplierStatus,
      orderStatus: order.status,
      changed: supplierStatus !== "PENDING",
    });
  } catch (error) {
    console.error("[robux/status]", error);
    return NextResponse.json(
      { error: friendlyByRobuxError(error) },
      { status: 503 },
    );
  }
}
