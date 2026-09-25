import "server-only";

import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat-attachments";
import { sendEmail, type NotificationAttachment } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export type OrderEmailKind = "payment" | "delivery";

type OrderItem = {
  product_name: string;
  unit_price: number | string;
  quantity: number;
};

type OrderEmailRow = {
  id: string;
  user_id: string;
  order_code: string;
  status: string;
  game_nickname: string;
  total: number | string;
  payment_email_sent_at: string | null;
  delivery_email_sent_at: string | null;
  order_items: OrderItem[] | null;
  profiles: { nickname?: string | null } | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function productRows(items: OrderItem[]) {
  return items.map((item) => `
    <tr>
      <td style="padding:10px 0;color:#e4e4e7;border-bottom:1px solid #27272a;">${escapeHtml(item.quantity)}× ${escapeHtml(item.product_name)}</td>
      <td style="padding:10px 0;color:#ffffff;text-align:right;font-weight:700;border-bottom:1px solid #27272a;">${money(Number(item.unit_price) * Number(item.quantity))}</td>
    </tr>
  `).join("");
}

function baseTemplate({
  eyebrow,
  title,
  intro,
  order,
  extra,
  buttonLabel,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  order: OrderEmailRow;
  extra: string;
  buttonLabel: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const orderUrl = `${siteUrl}/pedidos/${order.id}`;
  const customerName = order.profiles?.nickname?.trim() || "cliente";
  const items = order.order_items ?? [];

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#080812;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080812;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#12101b;border:1px solid #2c2640;border-radius:22px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 20px;background:linear-gradient(135deg,#24153f,#12101b);">
                <div style="font-size:13px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#a78bfa;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;color:#ffffff;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;color:#e4e4e7;font-size:16px;line-height:1.65;">Olá, <strong style="color:#ffffff;">${escapeHtml(customerName)}</strong>! ${intro}</p>

                <div style="margin:22px 0;padding:18px;border-radius:16px;background:#0c0b13;border:1px solid #27272a;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr><td style="padding:5px 0;color:#a1a1aa;">Pedido</td><td style="padding:5px 0;text-align:right;font-weight:800;color:#ffffff;">${escapeHtml(order.order_code)}</td></tr>
                    <tr><td style="padding:5px 0;color:#a1a1aa;">Nickname</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#ffffff;">${escapeHtml(order.game_nickname)}</td></tr>
                  </table>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;">
                    ${productRows(items)}
                    <tr><td style="padding:14px 0 0;font-size:17px;font-weight:800;color:#ffffff;">Total</td><td style="padding:14px 0 0;text-align:right;font-size:17px;font-weight:900;color:#c4b5fd;">${money(order.total)}</td></tr>
                  </table>
                </div>

                ${extra}

                <div style="margin:26px 0;text-align:center;">
                  <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px;">${escapeHtml(buttonLabel)}</a>
                </div>

                <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.6;text-align:center;">Obrigado por comprar na <strong style="color:#ddd6fe;">Cosmic Store</strong>. 💜<br>Esperamos ver você novamente em breve. 🚀🌌</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function getOrder(orderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id,user_id,order_code,status,game_nickname,total,payment_email_sent_at,delivery_email_sent_at,order_items(product_name,unit_price,quantity),profiles(nickname)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o pedido para e-mail: ${error.message}`);
  if (!data) throw new Error("Pedido não encontrado para envio do e-mail.");
  return data as unknown as OrderEmailRow;
}

async function getCustomerEmail(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(`Não foi possível localizar o e-mail do cliente: ${error.message}`);
  const email = data.user?.email?.trim();
  if (!email) throw new Error("O cliente não possui e-mail cadastrado.");
  return email;
}

export async function getLatestAdminDeliveryAttachment(orderId: string): Promise<NotificationAttachment | null> {
  const admin = createAdminClient();
  const { data: adminRows, error: adminError } = await admin.from("admins").select("user_id").in("role", ["owner", "admin"]);
  if (adminError) throw new Error(`Não foi possível localizar a equipe: ${adminError.message}`);
  const adminIds = (adminRows ?? []).map((row) => row.user_id).filter(Boolean);
  if (!adminIds.length) return null;

  const { data: message, error: messageError } = await admin
    .from("order_messages")
    .select("attachment_path,attachment_name,attachment_type")
    .eq("order_id", orderId)
    .in("user_id", adminIds)
    .not("attachment_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (messageError) throw new Error(`Não foi possível localizar a imagem da entrega: ${messageError.message}`);
  if (!message?.attachment_path) return null;

  const { data: file, error: downloadError } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).download(message.attachment_path);
  if (downloadError || !file) throw new Error("A imagem da entrega existe no histórico, mas não pôde ser baixada do Storage.");

  return {
    filename: message.attachment_name || "comprovante-entrega.jpg",
    contentType: message.attachment_type || file.type || "image/jpeg",
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export async function assertDeliveryImage(orderId: string) {
  const attachment = await getLatestAdminDeliveryAttachment(orderId);
  if (!attachment) {
    throw new Error("Envie uma imagem da entrega no chat do pedido antes de marcar como entregue.");
  }
}

async function recordEmailDelivery({
  order,
  title,
  status,
  errorMessage,
}: {
  order: OrderEmailRow;
  title: string;
  status: "sent" | "failed";
  errorMessage?: string | null;
}) {
  await createAdminClient().from("notification_deliveries").insert({
    user_id: order.user_id,
    title,
    link: `/pedidos/${order.id}`,
    channel: "email",
    status,
    error_message: errorMessage ? errorMessage.slice(0, 500) : null,
  });
}

export async function sendOrderStatusEmail(orderId: string, kind: OrderEmailKind) {
  const admin = createAdminClient();
  const order = await getOrder(orderId);
  const sentColumn = kind === "payment" ? "payment_email_sent_at" : "delivery_email_sent_at";
  if (order[sentColumn]) return { sent: false, alreadySent: true as const };

  if (kind === "payment" && !["paid", "preparing_delivery", "delivered"].includes(order.status)) {
    throw new Error("O pagamento ainda não foi confirmado.");
  }
  if (kind === "delivery" && order.status !== "delivered") {
    throw new Error("O pedido ainda não foi marcado como entregue.");
  }

  let attachment: NotificationAttachment | undefined;
  const subject = kind === "payment"
    ? `✅ Pagamento confirmado — ${order.order_code}`
    : `🎉 Pedido entregue — ${order.order_code}`;

  // Usa também o histórico como segunda trava contra duplicidade caso o e-mail
  // tenha sido aceito e o timestamp do pedido não tenha sido salvo por algum erro raro.
  const { data: previousDelivery } = await admin
    .from("notification_deliveries")
    .select("id")
    .eq("user_id", order.user_id)
    .eq("link", `/pedidos/${order.id}`)
    .eq("channel", "email")
    .eq("status", "sent")
    .eq("title", subject)
    .limit(1)
    .maybeSingle();
  if (previousDelivery) {
    await admin.from("orders").update({ [sentColumn]: new Date().toISOString() }).eq("id", orderId).is(sentColumn, null);
    return { sent: false, alreadySent: true as const };
  }

  const to = await getCustomerEmail(order.user_id);
  let html: string;

  if (kind === "payment") {
    html = baseTemplate({
      eyebrow: "Pagamento confirmado",
      title: "Recebemos seu pagamento! 💜",
      intro: "Seu comprovante foi confirmado com sucesso e sua compra já está na etapa de preparação para entrega.",
      order,
      extra: '<p style="margin:0;color:#d4d4d8;font-size:15px;line-height:1.65;">Agora é só acompanhar o pedido pela loja. Quando houver uma atualização importante, ela também aparecerá na sua conta.</p>',
      buttonLabel: "Acompanhar meu pedido",
    });
  } else {
    attachment = (await getLatestAdminDeliveryAttachment(orderId)) ?? undefined;
    if (!attachment) throw new Error("Nenhuma imagem de entrega enviada pela equipe foi encontrada neste pedido.");
    html = baseTemplate({
      eyebrow: "Entrega concluída",
      title: "Seu pedido foi entregue! 🎉",
      intro: "Sua compra foi concluída com sucesso. A imagem de confirmação da entrega está anexada a este e-mail.",
      order,
      extra: '<div style="margin:0;padding:16px;border-radius:14px;background:#1d1430;border:1px solid #4c1d95;color:#ddd6fe;font-size:15px;line-height:1.65;">📸 <strong>Comprovante da entrega:</strong> enviamos a imagem utilizada pela equipe como anexo deste e-mail. Se precisar de ajuda, o histórico do pedido continua disponível na Cosmic Store.</div>',
      buttonLabel: "Ver pedido e avaliar",
    });
  }

  try {
    await sendEmail(to, subject, html, attachment);
    const sentAt = new Date().toISOString();
    const { error: updateError } = await admin.from("orders").update({ [sentColumn]: sentAt }).eq("id", orderId).is(sentColumn, null);
    if (updateError) console.error(`[order-email] E-mail enviado, mas não foi possível registrar ${sentColumn}:`, updateError.message);
    await recordEmailDelivery({ order, title: subject, status: "sent" });
    return { sent: true, alreadySent: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordEmailDelivery({ order, title: subject, status: "failed", errorMessage: message });
    throw error;
  }
}
