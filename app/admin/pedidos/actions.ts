"use server";

import { revalidatePath } from "next/cache";
import { notifyCustomer } from "@/lib/notifications";
import { assertDeliveryImage, sendOrderStatusEmail, type OrderEmailKind } from "@/lib/order-emails";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const allowed = ["paid", "delivered", "cancelled", "proof_rejected"];
const transitions: Record<string, string[]> = {
  awaiting_payment: ["cancelled"],
  proof_submitted: ["paid", "proof_rejected", "cancelled"],
  under_review: ["paid", "proof_rejected", "cancelled"],
  proof_rejected: ["cancelled"],
  paid: ["delivered", "cancelled"],
  preparing_delivery: ["delivered", "cancelled"],
};

export async function updateOrderStatus(formData: FormData) {
  const adminUser = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!orderId || !allowed.includes(status)) throw new Error("Situação inválida.");

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id,order_code,status,stock_deducted_at,stock_restored_at")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("Pedido não encontrado.");
  if (order.status === status) return; // Evita ações repetidas e avisos duplicados.
  if (!transitions[order.status]?.includes(status)) throw new Error("A situação deste pedido mudou. Recarregue a página.");

  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();
  if (status === "proof_rejected" && (rejectionReason.length < 5 || rejectionReason.length > 300)) {
    throw new Error("Informe um motivo de 5 a 300 caracteres.");
  }

  // A entrega só pode ser concluída depois que a equipe enviar uma print no chat.
  // Assim o e-mail final sempre consegue levar uma prova da entrega ao cliente.
  if (status === "delivered") await assertDeliveryImage(orderId);

  if (status === "paid" && !["paid", "preparing_delivery", "delivered"].includes(order.status)) {
    const { error: stockError } = await admin.rpc("commit_order_stock", { target_order_id: orderId });
    if (stockError) throw new Error(stockError.message);
  }
  if (status === "cancelled" && order.stock_deducted_at && !order.stock_restored_at) {
    const { error: stockError } = await admin.rpc("restore_order_stock", { target_order_id: orderId });
    if (stockError) throw new Error(stockError.message);
  }

  const now = new Date();
  const updates: Record<string, string | null> = { status };
  if (status === "paid") {
    updates.paid_at = now.toISOString();
    updates.delivery_due_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    updates.chat_closed_at = null;
    updates.rejection_reason = null;
  }
  if (status === "delivered") {
    updates.delivered_at = now.toISOString();
    updates.chat_closed_at = now.toISOString();
  }
  if (status === "proof_rejected") updates.rejection_reason = rejectionReason;

  const { data: updated, error } = await admin
    .from("orders")
    .update(updates)
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error("Outro administrador já alterou este pedido. Atualize a página.");

  await admin.from("order_admin_events").insert({
    order_id: orderId,
    admin_id: adminUser.id,
    action: `status:${status}`,
    details: status === "proof_rejected" ? { rejection_reason: rejectionReason } : null,
  });

  const notifications: Record<string, [string, string]> = {
    paid: ["Pagamento confirmado!", `O pagamento do pedido ${order.order_code} foi confirmado. O chat do pedido já está disponível.`],
    delivered: ["Pedido entregue!", `O pedido ${order.order_code} foi marcado como entregue. Conte como foi sua experiência com a Cosmic Store.`],
    cancelled: ["Pedido cancelado", `O pedido ${order.order_code} foi cancelado. Fale conosco se precisar de ajuda.`],
    proof_rejected: ["Comprovante não confirmado", `Não conseguimos confirmar o comprovante do pedido ${order.order_code}. Motivo: ${rejectionReason} Abra o pedido para enviar um novo arquivo.`],
  };

  const [title, body] = notifications[status];
  await notifyCustomer(order.user_id, title, body, `/pedidos/${orderId}`);

  // E-mail para cliente somente nos dois eventos combinados: pagamento e entrega.
  if (status === "paid" || status === "delivered") {
    const kind: OrderEmailKind = status === "paid" ? "payment" : "delivery";
    try {
      await sendOrderStatusEmail(orderId, kind);
    } catch (emailError) {
      // Não desfaz uma confirmação de pagamento/entrega válida só porque o Gmail falhou.
      // A falha fica no histórico e o painel oferece o botão para reenviar.
      console.error(`[order-email] Falha ao enviar ${kind} do pedido ${orderId}:`, emailError);
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
  if (!orderId || !["payment", "delivery"].includes(kind)) throw new Error("E-mail inválido.");

  await sendOrderStatusEmail(orderId, kind);
  revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function updateOrderChat(formData: FormData) {
  const adminUser = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const action = String(formData.get("chat_action") ?? "");
  if (!orderId || !["open", "close"].includes(action)) throw new Error("Ação de atendimento inválida.");

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (!order || !["paid", "preparing_delivery", "delivered"].includes(order.status)) {
    throw new Error("O chat ainda não está disponível para este pedido.");
  }
  const { error } = await admin
    .from("orders")
    .update({ chat_closed_at: action === "close" ? new Date().toISOString() : null })
    .eq("id", orderId);
  if (error) throw error;

  await admin.from("order_admin_events").insert({ order_id: orderId, admin_id: adminUser.id, action: `chat:${action}` });
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/pedidos/${orderId}`);
}
