import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendGmailEmail, type GmailAttachment } from "@/lib/gmail";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type NotificationAttachment = GmailAttachment;

export async function createUserNotification(userId: string, title: string, body: string, link?: string) {
  const { error } = await createAdminClient().from("notifications").insert({ user_id: userId, title, body, link });
  if (error) throw new Error(`Não foi possível criar a notificação interna: ${error.message}`);
}

export async function createAdminNotifications(title: string, body: string, link: string, excludeUserId?: string) {
  const admin = createAdminClient();
  const { data: adminRows, error } = await admin.from("admins").select("user_id,role").in("role", ["owner", "admin"]);
  if (error) throw new Error(`Não foi possível localizar os administradores: ${error.message}`);
  const rows = (adminRows ?? [])
    .filter((row) => row.user_id && row.user_id !== excludeUserId)
    .map((row) => ({ user_id: row.user_id, title, body, link }));
  if (!rows.length) return;
  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) throw new Error(`Não foi possível criar o alerta administrativo: ${insertError.message}`);
}

/**
 * Envio genérico de e-mail pelo Gmail da loja.
 * Mantido para os alertas administrativos existentes.
 * E-mails de cliente são disparados de forma controlada em lib/order-emails.ts.
 */
export async function sendEmail(
  to: string | undefined,
  subject: string,
  html: string,
  attachment?: NotificationAttachment,
) {
  if (!to) throw new Error("Destinatário do e-mail não encontrado.");
  await sendGmailEmail({ to, subject, html, attachment });
}

export async function notifyAdminDiscord(message: string) {
  const webhook = process.env.DISCORD_ADMIN_WEBHOOK_URL;
  if (!webhook) return;
  const mention = process.env.DISCORD_ADMIN_MENTION?.trim();
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `${mention ? `${mention} ` : ""}${message}`, allowed_mentions: { parse: ["roles", "users"] } }),
  });
}

export async function sendDiscordDm(
  discordId: string | null | undefined,
  message: string,
  buttonLabel?: string,
  link?: string,
  attachment?: NotificationAttachment,
) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  if (!discordId) throw new Error("O perfil do cliente não possui discord_id.");

  const channelResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!channelResponse.ok) {
    throw new Error(`Discord não abriu a DM (${channelResponse.status}): ${(await channelResponse.text()).slice(0, 500)}`);
  }
  const channel = await channelResponse.json() as { id: string };
  const endpoint = `https://discord.com/api/v10/channels/${channel.id}/messages`;
  const payload = {
    content: message,
    components: buttonLabel && link ? [{ type: 1, components: [{ type: 2, style: 5, label: buttonLabel, url: link }] }] : undefined,
    attachments: attachment ? [{ id: 0, filename: attachment.filename }] : undefined,
  };

  let messageResponse: Response;
  if (attachment) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    const buffer = attachment.bytes.buffer.slice(
      attachment.bytes.byteOffset,
      attachment.bytes.byteOffset + attachment.bytes.byteLength,
    ) as ArrayBuffer;
    form.append("files[0]", new Blob([buffer], { type: attachment.contentType }), attachment.filename);
    messageResponse = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bot ${token}` },
      body: form,
    });
  } else {
    messageResponse = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (!messageResponse.ok) {
    throw new Error(`Discord recusou a DM (${messageResponse.status}): ${(await messageResponse.text()).slice(0, 500)}`);
  }
}

/**
 * Notificação normal de cliente: site + Discord.
 * Não envia Gmail por mensagem comum. Os únicos e-mails automáticos do cliente
 * são pagamento confirmado e pedido entregue, definidos em lib/order-emails.ts.
 */
export async function notifyCustomer(
  userId: string,
  title: string,
  body: string,
  path: string,
  attachment?: NotificationAttachment,
) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("discord_id").eq("id", userId).maybeSingle();
  const link = `${siteUrl}${path}`;
  const results = await Promise.allSettled([
    createUserNotification(userId, title, body, path),
    sendDiscordDm(profile?.discord_id, `**${title}**\n${body}`, "Abrir na Cosmic Store", link, attachment),
  ]);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const channels = ["notificação interna", "Discord"];
      console.error(`[notifyCustomer] Falha em ${channels[index]} para o usuário ${userId}:`, result.reason);
    }
  });
  const channels = ["site", "discord"];
  await admin.from("notification_deliveries").insert(results.map((result, index) => ({
    user_id: userId,
    title,
    link: path,
    channel: channels[index],
    status: result.status === "fulfilled" ? "sent" : "failed",
    error_message: result.status === "rejected" ? String(result.reason instanceof Error ? result.reason.message : result.reason).slice(0, 500) : null,
  })));
}
