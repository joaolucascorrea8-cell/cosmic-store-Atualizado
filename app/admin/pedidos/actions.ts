"use server";

import { UUID_PATTERN } from "@/lib/catalog";
import { revalidatePath } from "next/cache";
import { notifyCustomer } from "@/lib/notifications";
import { sendOrderStatusEmail, type OrderEmailKind } from "@/lib/order-emails";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const allowed = [
  "paid",
  "preparing_delivery",
  "delivered",
  "cancelled",
  "proof_rejected",
];
export async function updateOrderStatus(formData: FormData) {
  const adminUser = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!orderId || !allowed.includes(status))
    throw new Error("Situação inválida.");

  if (!UUID_PATTERN.test(orderId)) throw new Error("Pedido inválido.");
  const admin = createAdminClient();
  const { data: before, error: lookupError } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (lookupError || !before) throw new Error("Pedido não encontrado.");
  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();
  const expected = String(formData.get("expected_status") ?? before.status);
  const { data: result, error } = await admin.rpc("transition_store_order", {
    p_order_id: orderId,
    p_admin_id: adminUser.id,
    p_status: status,
    p_expected_status: expected,
    p_reason: rejectionReason,
  });
  if (error) {
  console.error("Falha em transition_store_order:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  throw new Error(
    error.code === "P0001"
      ? error.message
      : "Não foi possível atualizar o pedido. Confira a atualização SQL.",
  );
}
  if (!result?.changed) return;
  const order = result.order as { user_id: string; order_code: string };

  const notifications: Record<string, [string, string]> = {
    paid: [
      "Pagamento confirmado!",
      `O pagamento do pedido ${order.order_code} foi confirmado. O chat do pedido já está disponível.`,
    ],
    preparing_delivery: [
      "Entrega em preparação",
      `A equipe começou a preparar a entrega do pedido ${order.order_code}. Acompanhe pelo chat do pedido.`,
    ],
    delivered: [
      "Pedido entregue!",
      `O pedido ${order.order_code} foi marcado como entregue. Conte como foi sua experiência com a Cosmic Store.`,
    ],
    cancelled: [
      "Pedido cancelado",
      `O pedido ${order.order_code} foi cancelado. Fale conosco se precisar de ajuda.`,
    ],
    proof_rejected: [
      "Comprovante não confirmado",
      `Não conseguimos confirmar o comprovante do pedido ${order.order_code}. Motivo: ${rejectionReason} Abra o pedido para enviar um novo arquivo.`,
    ],
  };

  const [title, body] = notifications[status];
  await notifyCustomer(order.user_id, title, body, `/pedidos/${orderId}`).catch(
    (error) => console.error("Falha ao registrar aviso do pedido:", error),
  );

  // E-mail para cliente somente nos dois eventos combinados: pagamento e entrega.
  if (status === "paid" || status === "delivered") {
    const kind: OrderEmailKind = status === "paid" ? "payment" : "delivery";
    try {
      await sendOrderStatusEmail(orderId, kind);
    } catch (emailError) {
      // Não desfaz uma confirmação de pagamento/entrega válida só porque o Gmail falhou.
      // A falha fica no histórico e o painel oferece o botão para reenviar.
      console.error(
        `[order-email] Falha ao enviar ${kind} do pedido ${orderId}:`,
        emailError,
      );
    }
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
}

export async function resendOrderEmail(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const kind = String(formData.get("email_kind") ?? "") as OrderEmailKind;
  if (!UUID_PATTERN.test(orderId) || !["payment", "delivery"].includes(kind))
    throw new Error("E-mail inválido.");

  await sendOrderStatusEmail(orderId, kind);
  revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function updateOrderChat(formData: FormData) {
  const adminUser = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const action = String(formData.get("chat_action") ?? "");
  if (!UUID_PATTERN.test(orderId) || !["open", "close"].includes(action))
    throw new Error("Ação de atendimento inválida.");

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (
    !order ||
    !["paid", "preparing_delivery", "delivered"].includes(order.status)
  ) {
    throw new Error("O chat ainda não está disponível para este pedido.");
  }
  const { error } = await admin
    .from("orders")
    .update({
      chat_closed_at: action === "close" ? new Date().toISOString() : null,
    })
    .eq("id", orderId);
  if (error) throw error;

  await admin
    .from("order_admin_events")
    .insert({
      order_id: orderId,
      admin_id: adminUser.id,
      action: `chat:${action}`,
    });
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/pedidos/${orderId}`);
}
