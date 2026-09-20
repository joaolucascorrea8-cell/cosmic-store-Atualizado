import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function createUserNotification(userId: string, title: string, body: string, link?: string) {
  await createAdminClient().from("notifications").insert({ user_id: userId, title, body, link });
}

export async function sendEmail(to: string | undefined, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
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

export async function sendDiscordDm(discordId: string | null | undefined, message: string, buttonLabel?: string, link?: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !discordId) return;
  const channelResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!channelResponse.ok) return;
  const channel = await channelResponse.json() as { id: string };
  await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: message,
      components: buttonLabel && link ? [{ type: 1, components: [{ type: 2, style: 5, label: buttonLabel, url: link }] }] : undefined,
    }),
  });
}

export async function notifyCustomer(userId: string, title: string, body: string, path: string) {
  const admin = createAdminClient();
  const [{ data: authData }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("discord_id").eq("id", userId).maybeSingle(),
  ]);
  const link = `${siteUrl}${path}`;
  await Promise.allSettled([
    createUserNotification(userId, title, body, path),
    sendEmail(authData.user?.email, title, `<div style="font-family:Arial,sans-serif"><h2>${title}</h2><p>${body}</p><p><a href="${link}">Abrir na Cosmic Store</a></p></div>`),
    sendDiscordDm(profile?.discord_id, `**${title}**\n${body}`, "Abrir na Cosmic Store", link),
  ]);
}

