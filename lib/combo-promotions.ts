import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendGmailEmail } from "@/lib/gmail";

export type ComboPromotionProduct = {
  name: string;
  image_url: string | null;
  quantity: number;
};

type ComboPromotionInput = {
  comboId: string;
  comboName: string;
  comboSlug: string;
  body: string;
  coverUrl?: string | null;
  products: ComboPromotionProduct[];
  price: number;
  compareAtPrice: number;
  sendEmail: boolean;
  sendDiscord: boolean;
  createdBy: string;
};

export type ComboPromotionResult = {
  emailSent: number;
  emailFailed: number;
  discordStatus: "sent" | "failed" | null;
  discordError: string | null;
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] ?? char);
}

function paragraphHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function money(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildComboPromotionBody({
  comboName,
  products,
  price,
  compareAtPrice,
}: {
  comboName: string;
  products: ComboPromotionProduct[];
  price: number;
  compareAtPrice: number;
}) {
  const items = products.map((item) => `• ${item.quantity}× ${item.name}`).join("\n");
  const priceLine = compareAtPrice > price
    ? `De ${money(compareAtPrice)} por ${money(price)}`
    : `Por ${money(price)}`;

  return `🌌 COSMIC STORE — NOVO COMBO! 🚀\n\n🔥 ${comboName || "Novo combo"}\n\nUma nova oferta acabou de chegar na Cosmic Store!\n\n${items || "• Produtos selecionados"}\n\n${priceLine}\n\n⏳ Aproveite enquanto estiver disponível.\n\n💬 Precisou de ajuda? Fale com nossa equipe pelo suporte da loja.`;
}

async function listCustomerEmails() {
  const admin = createAdminClient();
  const { data: adminRows } = await admin.from("admins").select("user_id");
  const adminIds = new Set((adminRows ?? []).map((row) => row.user_id));
  const emails = new Set<string>();

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Não foi possível carregar os e-mails dos clientes.");

    for (const user of data.users) {
      const email = user.email?.trim().toLowerCase();
      if (email && !adminIds.has(user.id)) emails.add(email);
    }

    if (data.users.length < 1000) break;
  }

  return [...emails];
}

function comboPromotionEmailHtml({
  comboName,
  body,
  url,
  coverUrl,
  products,
  price,
  compareAtPrice,
}: {
  comboName: string;
  body: string;
  url: string;
  coverUrl?: string | null;
  products: ComboPromotionProduct[];
  price: number;
  compareAtPrice: number;
}) {
  const visible = products.slice(0, 6);
  const cards = visible.map((product) => `
    <td style="width:${visible.length === 1 ? "100%" : "50%"};padding:6px;vertical-align:top">
      <div style="border:1px solid #292330;border-radius:14px;background:#131017;padding:12px;text-align:center">
        ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="" style="width:100%;max-width:160px;height:130px;object-fit:contain;display:block;margin:0 auto 10px"/>` : ""}
        <strong style="font-size:14px;color:#fff">${escapeHtml(`${product.quantity}× ${product.name}`)}</strong>
      </div>
    </td>`);

  const rows: string[] = [];
  for (let index = 0; index < cards.length; index += 2) {
    rows.push(`<tr>${cards.slice(index, index + 2).join("")}${cards.length % 2 === 1 && index === cards.length - 1 ? '<td style="width:50%"></td>' : ""}</tr>`);
  }

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#090811;font-family:Arial,sans-serif;color:#fff">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px">
        <div style="text-align:center;margin-bottom:18px">
          <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#a78bfa">COSMIC STORE</div>
          <h1 style="margin:10px 0 0;font-size:30px">${escapeHtml(comboName)}</h1>
        </div>
        ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="Capa do combo" style="display:block;width:100%;max-height:360px;object-fit:cover;border-radius:18px;border:1px solid #292330;margin-bottom:22px"/>` : ""}
        <div style="font-size:16px;line-height:1.7;color:#d6d3d9">${paragraphHtml(body)}</div>
        <div style="margin:24px 0;padding:18px;border:1px solid #6d28d9;border-radius:16px;background:#171020;text-align:center">
          ${compareAtPrice > price ? `<div style="color:#8b8490;text-decoration:line-through;font-size:14px">De ${money(compareAtPrice)}</div>` : ""}
          <div style="margin-top:4px;font-size:30px;font-weight:900;color:#fff">${money(price)}</div>
        </div>
        ${rows.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0">${rows.join("")}</table>` : ""}
        <div style="text-align:center;margin:28px 0">
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:900;padding:14px 24px;border-radius:12px">Ver combo na Cosmic Store</a>
        </div>
        <div style="border-top:1px solid #292330;padding-top:18px;color:#8b8490;font-size:12px;line-height:1.6;text-align:center">
          Novidade da Cosmic Store. Para dúvidas, fale com a equipe pelo suporte da loja.
        </div>
      </div>
    </body>
  </html>`;
}

async function sendDiscordPromotion({
  comboName,
  body,
  url,
  coverUrl,
  products,
  price,
  compareAtPrice,
}: {
  comboName: string;
  body: string;
  url: string;
  coverUrl?: string | null;
  products: ComboPromotionProduct[];
  price: number;
  compareAtPrice: number;
}) {
  const webhook = process.env.DISCORD_CAMPAIGNS_WEBHOOK_URL?.trim();
  if (!webhook) throw new Error("DISCORD_CAMPAIGNS_WEBHOOK_URL não configurado.");

  const imageProducts = products.filter((product) => product.image_url).slice(0, 4);
  const embeds: Record<string, unknown>[] = [{
    title: `🌌 ${comboName}`,
    description: `${body.slice(0, 3400)}\n\n🛒 **[Ver combo na Cosmic Store](${url})**`,
    url,
    color: 0x7c3aed,
    fields: [
      ...(compareAtPrice > price ? [{ name: "Antes", value: money(compareAtPrice), inline: true }] : []),
      { name: "💜 Preço do combo", value: money(price), inline: true },
    ],
    footer: { text: "Cosmic Store • Combos e ofertas" },
    ...(coverUrl ? { image: { url: coverUrl } } : imageProducts[0]?.image_url ? { thumbnail: { url: imageProducts[0].image_url } } : {}),
  }];

  imageProducts.forEach((product) => {
    embeds.push({
      title: `${product.quantity}× ${product.name}`.slice(0, 256),
      url,
      image: { url: product.image_url },
      color: 0x17131f,
    });
  });

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Cosmic Store • Ofertas",
      embeds,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord recusou a divulgação (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
}

export async function sendComboPromotion(input: ComboPromotionInput): Promise<ComboPromotionResult> {
  const admin = createAdminClient();
  const url = `${siteUrl}/combo/${input.comboSlug}`;
  const coverUrl = input.coverUrl || input.products.find((product) => product.image_url)?.image_url || null;
  const requestToken = crypto.randomUUID();

  const { data: log, error: logError } = await admin.from("campaigns").insert({
    request_token: requestToken,
    title: input.comboName,
    body: input.body,
    source_type: "combo",
    source_id: input.comboId,
    banner_url: coverUrl,
    send_email: input.sendEmail,
    send_discord: input.sendDiscord,
    status: "sending",
    created_by: input.createdBy,
  }).select("id").single();

  if (logError || !log) throw new Error("Não foi possível registrar a divulgação do combo.");

  const deliveries: Array<{
    campaign_id: string;
    channel: "email" | "discord";
    recipient: string | null;
    status: "sent" | "failed";
    error_message: string | null;
  }> = [];

  let emailSent = 0;
  let emailFailed = 0;
  let discordStatus: "sent" | "failed" | null = null;
  let discordError: string | null = null;

  if (input.sendDiscord) {
    try {
      await sendDiscordPromotion({
        comboName: input.comboName,
        body: input.body,
        url,
        coverUrl,
        products: input.products,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
      });
      discordStatus = "sent";
      deliveries.push({ campaign_id: log.id, channel: "discord", recipient: "canal-de-combos", status: "sent", error_message: null });
    } catch (error) {
      discordStatus = "failed";
      discordError = error instanceof Error ? error.message : String(error);
      deliveries.push({ campaign_id: log.id, channel: "discord", recipient: "canal-de-combos", status: "failed", error_message: discordError.slice(0, 500) });
    }
  }

  if (input.sendEmail) {
    try {
      const emails = await listCustomerEmails();
      const html = comboPromotionEmailHtml({
        comboName: input.comboName,
        body: input.body,
        url,
        coverUrl,
        products: input.products,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
      });

      for (let index = 0; index < emails.length; index += 5) {
        const batch = emails.slice(index, index + 5);
        const results = await Promise.allSettled(batch.map((email) => sendGmailEmail({
          to: email,
          subject: `🌌 ${input.comboName} — novo combo na Cosmic Store`,
          html,
        })));

        results.forEach((result, batchIndex) => {
          const email = batch[batchIndex];
          if (result.status === "fulfilled") {
            emailSent += 1;
            deliveries.push({ campaign_id: log.id, channel: "email", recipient: email, status: "sent", error_message: null });
          } else {
            emailFailed += 1;
            deliveries.push({
              campaign_id: log.id,
              channel: "email",
              recipient: email,
              status: "failed",
              error_message: String(result.reason instanceof Error ? result.reason.message : result.reason).slice(0, 500),
            });
          }
        });
      }
    } catch (error) {
      emailFailed += 1;
      deliveries.push({
        campaign_id: log.id,
        channel: "email",
        recipient: null,
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Falha ao enviar e-mails.",
      });
    }
  }

  if (deliveries.length) await admin.from("campaign_deliveries").insert(deliveries);

  const successes = emailSent + (discordStatus === "sent" ? 1 : 0);
  const failures = emailFailed + (discordStatus === "failed" ? 1 : 0);
  const status = failures === 0 ? "sent" : successes === 0 ? "failed" : "partial";

  await admin.from("campaigns").update({
    status,
    email_sent_count: emailSent,
    email_failed_count: emailFailed,
    discord_status: discordStatus,
    discord_error: discordError,
    sent_at: new Date().toISOString(),
  }).eq("id", log.id);

  return { emailSent, emailFailed, discordStatus, discordError };
}
