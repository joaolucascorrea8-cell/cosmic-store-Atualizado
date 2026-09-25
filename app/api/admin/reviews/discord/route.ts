import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadReviewImage } from "@/lib/review-attachments";

export const runtime = "nodejs";
export const maxDuration = 60;

const DISCORD_API = "https://discord.com/api/v10";
const PAGE_SIZE = 50;

type DiscordAttachment = {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string | null;
};

type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  member?: { nick?: string | null };
  attachments?: DiscordAttachment[];
};

function envConfig() {
  const enabled = String(process.env.DISCORD_REVIEWS_IMPORT_ENABLED ?? "false").toLowerCase() === "true";
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const channelId = process.env.DISCORD_REVIEWS_CHANNEL_ID?.trim();
  if (!enabled) throw new Error("Importação do Discord está bloqueada. Ative DISCORD_REVIEWS_IMPORT_ENABLED para usar.");
  if (!token) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  if (!channelId) throw new Error("DISCORD_REVIEWS_CHANNEL_ID não configurado.");
  return { token, channelId };
}

async function discordFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bot ${token}`, "User-Agent": "CosmicStoreReviewsImporter/1.0" }, cache: "no-store" });
  if (response.status === 429) {
    const body = await response.json().catch(() => ({ retry_after: 1 }));
    const retryAfter = Math.max(1, Number(body.retry_after ?? 1));
    await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter * 1000, 5000)));
    return discordFetch<T>(url, token);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord respondeu ${response.status}: ${text.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

function displayName(message: DiscordMessage) {
  return message.member?.nick?.trim() || message.author.global_name?.trim() || message.author.username || "Cliente do Discord";
}

function avatarUrl(message: DiscordMessage) {
  if (!message.author.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`;
}

function firstImage(message: DiscordMessage) {
  return (message.attachments ?? []).find((attachment) => {
    if (attachment.content_type?.startsWith("image/")) return true;
    return /\.(png|jpe?g|webp)$/i.test(attachment.filename);
  }) ?? null;
}

async function fetchDiscordPage(token: string, channelId: string, before?: string | null) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (before) params.set("before", before);
  return discordFetch<DiscordMessage[]>(`${DISCORD_API}/channels/${channelId}/messages?${params}`, token);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { token, channelId } = envConfig();
    const body = await request.json().catch(() => ({}));
    const before = typeof body.before === "string" && body.before ? body.before : null;
    const mode = body.mode === "scan" ? "scan" : "import";
    const messages = await fetchDiscordPage(token, channelId, before);
    const eligible = messages.filter((message) => !message.author.bot && message.content.trim().length >= 3);
    const nextBefore = messages.length ? messages[messages.length - 1].id : null;
    const hasMore = messages.length === PAGE_SIZE;

    if (mode === "scan") {
      return NextResponse.json({
        ok: true,
        scanned: messages.length,
        eligible: eligible.length,
        withImage: eligible.filter(message => Boolean(firstImage(message))).length,
        nextBefore,
        hasMore,
      });
    }

    const admin = createAdminClient();
    const ids = eligible.map(message => message.id);
    const existingIds = new Set<string>();
    if (ids.length) {
      const { data: existing } = await admin.from("feedbacks").select("discord_message_id").in("discord_message_id", ids);
      for (const row of existing ?? []) if (row.discord_message_id) existingIds.add(row.discord_message_id);
    }

    let imported = 0;
    let skipped = 0;
    let images = 0;
    const errors: string[] = [];

    for (const message of eligible) {
      if (existingIds.has(message.id)) { skipped += 1; continue; }
      const reviewId = crypto.randomUUID();
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      const image = firstImage(message);

      if (image && image.size <= 10 * 1024 * 1024) {
        try {
          const response = await fetch(image.url, { cache: "no-store" });
          if (response.ok) {
            const raw = new Uint8Array(await response.arrayBuffer());
            attachmentPath = `discord/${message.id}/${crypto.randomUUID()}.webp`;
            await uploadReviewImage(attachmentPath, raw);
            attachmentName = image.filename.slice(0, 180);
            images += 1;
          }
        } catch (error) {
          errors.push(`${message.id}: imagem não importada (${error instanceof Error ? error.message : "erro"})`);
          attachmentPath = null;
        }
      }

      const createdAt = new Date(message.timestamp).toISOString();
      const { error } = await admin.from("feedbacks").insert({
        id: reviewId,
        order_id: null,
        user_id: null,
        rating: 5,
        comment: message.content.trim().slice(0, 600),
        author_nickname: displayName(message).slice(0, 120),
        author_avatar_url: avatarUrl(message),
        is_visible: true,
        source: "discord",
        discord_message_id: message.id,
        discord_author_id: message.author.id,
        discord_created_at: createdAt,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_type: attachmentPath ? "image/webp" : null,
        created_at: createdAt,
        updated_at: createdAt,
      });
      if (error) {
        skipped += 1;
        errors.push(`${message.id}: ${error.message}`);
        if (attachmentPath) await admin.storage.from("review-attachments").remove([attachmentPath]);
      } else imported += 1;
    }

    return NextResponse.json({ ok: true, scanned: messages.length, eligible: eligible.length, imported, skipped, images, errors: errors.slice(0, 8), nextBefore, hasMore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na importação." }, { status: 400 });
  }
}
