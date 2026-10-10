"use server";

import { validateAccountOrder } from "@/lib/robux-accounts/service";
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
export type OrderStatusFormState = { error: string | null; success?: string };

export async function updateOrderStatus(
  _previous: OrderStatusFormState,
  formData: FormData,
): Promise<OrderStatusFormState> {
  const adminUser = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!orderId || !allowed.includes(status))
    return { error: "Situação inválida." };

  if (!UUID_PATTERN.test(orderId)) return { error: "Pedido inválido." };
  const admin = createAdminClient();
  const { data: before, error: lookupError } = await admin
    .from("orders")
    .select("status,order_type,robux_orders(supplier_status)")
    .eq("id", orderId)
    .maybeSingle();
  if (lookupError || !before) return { error: "Não foi possível carregar este pedido. Atualize a página e tente novamente." };
  const robuxRelation = before.robux_orders;
  const robux = Array.isArray(robuxRelation) ? robuxRelation[0] : robuxRelation;
  if (before.order_type === "robux") {
    if (["preparing_delivery", "delivered"].includes(status))
      return { error: "A entrega de Robux é controlada pela integração. Use o botão Comprar e entregar." };
    if (status === "cancelled" && ["PENDING", "COMPLETED"].includes(robux?.supplier_status ?? ""))
      return { error: "Não cancele um pedido enquanto a compra do GamePass está em processamento ou já foi concluída." };
  }
  if (before.order_type === "robux_account" && ["paid", "preparing_delivery"].includes(status)) {
    try { await validateAccountOrder(orderId); }
    catch { return { error: "Não foi possível confirmar a disponibilidade da conta. Consulte o painel deste pedido antes de continuar." }; }
  }
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
    // Recusas de validação são respostas do formulário, não erros de renderização.
    if (error.code !== "P0001") {
      console.error("Falha em transition_store_order:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }
    return {
      error: error.code === "P0001"
        ? error.message
        : "Não foi possível atualizar o pedido. Confira a atualização SQL.",
    };
  }
  if (!result?.changed) {
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { error: null, success: "O pedido já está nesta situação." };
  }
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
  return { error: null, success: "Pedido atualizado." };
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
