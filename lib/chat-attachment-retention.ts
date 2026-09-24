import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_ATTACHMENT_BUCKET } from "@/lib/chat-attachments";

const DEFAULT_RETENTION_DAYS = 60;
const MAX_RETENTION_DAYS = 3650;
const CONVERSATION_BATCH = 500;
const MESSAGE_BATCH = 500;
const STORAGE_DELETE_BATCH = 100;

type AttachmentRow = {
  id: string;
  message: string | null;
  attachment_path: string | null;
};

function getRetentionDays() {
  const raw = Number.parseInt(process.env.CHAT_ATTACHMENT_RETENTION_DAYS ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_RETENTION_DAYS;
  return Math.min(raw, MAX_RETENTION_DAYS);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function deleteStoragePaths(paths: string[]) {
  if (!paths.length) return;
  const admin = createAdminClient();

  for (const group of chunk(paths, STORAGE_DELETE_BATCH)) {
    const { error } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).remove(group);
    if (error) throw new Error(`Falha ao remover anexos antigos do Storage: ${error.message}`);
  }
}

async function cleanupOrderAttachments(cutoffIso: string, deletedAt: string) {
  const admin = createAdminClient();
  const { data: conversations, error: orderError } = await admin
    .from("orders")
    .select("id")
    .not("chat_closed_at", "is", null)
    .lt("chat_closed_at", cutoffIso)
    .limit(CONVERSATION_BATCH);

  if (orderError) throw new Error(`Falha ao consultar pedidos antigos: ${orderError.message}`);
  const orderIds = (conversations ?? []).map((item) => item.id);
  if (!orderIds.length) return 0;

  const { data: rows, error: messageError } = await admin
    .from("order_messages")
    .select("id,message,attachment_path")
    .in("order_id", orderIds)
    .not("attachment_path", "is", null)
    .limit(MESSAGE_BATCH);

  if (messageError) throw new Error(`Falha ao consultar anexos de pedidos: ${messageError.message}`);
  const messages = (rows ?? []) as AttachmentRow[];
  if (!messages.length) return 0;

  await deleteStoragePaths(messages.flatMap((item) => item.attachment_path ? [item.attachment_path] : []));

  for (const item of messages) {
    const cleanMessage = item.message?.trim();
    const { error } = await admin
      .from("order_messages")
      .update({
        message: cleanMessage || "📷 Imagem removida automaticamente após o período de retenção.",
        attachment_path: null,
        attachment_name: null,
        attachment_type: null,
        attachment_deleted_at: deletedAt,
      })
      .eq("id", item.id)
      .eq("attachment_path", item.attachment_path);

    if (error) throw new Error(`Falha ao atualizar mensagem de pedido: ${error.message}`);
  }

  return messages.length;
}

async function cleanupSupportAttachments(cutoffIso: string, deletedAt: string) {
  const admin = createAdminClient();
  const { data: conversations, error: ticketError } = await admin
    .from("support_tickets")
    .select("id")
    .not("closed_at", "is", null)
    .lt("closed_at", cutoffIso)
    .limit(CONVERSATION_BATCH);

  if (ticketError) throw new Error(`Falha ao consultar atendimentos antigos: ${ticketError.message}`);
  const ticketIds = (conversations ?? []).map((item) => item.id);
  if (!ticketIds.length) return 0;

  const { data: rows, error: messageError } = await admin
    .from("support_messages")
    .select("id,message,attachment_path")
    .in("ticket_id", ticketIds)
    .not("attachment_path", "is", null)
    .limit(MESSAGE_BATCH);

  if (messageError) throw new Error(`Falha ao consultar anexos de suporte: ${messageError.message}`);
  const messages = (rows ?? []) as AttachmentRow[];
  if (!messages.length) return 0;

  await deleteStoragePaths(messages.flatMap((item) => item.attachment_path ? [item.attachment_path] : []));

  for (const item of messages) {
    const cleanMessage = item.message?.trim();
    const { error } = await admin
      .from("support_messages")
      .update({
        message: cleanMessage || "📷 Imagem removida automaticamente após o período de retenção.",
        attachment_path: null,
        attachment_name: null,
        attachment_type: null,
        attachment_deleted_at: deletedAt,
      })
      .eq("id", item.id)
      .eq("attachment_path", item.attachment_path);

    if (error) throw new Error(`Falha ao atualizar mensagem de suporte: ${error.message}`);
  }

  return messages.length;
}

export async function cleanupExpiredChatAttachments() {
  const retentionDays = getRetentionDays();
  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deletedAt = now.toISOString();

  const [ordersDeleted, supportDeleted] = await Promise.all([
    cleanupOrderAttachments(cutoff.toISOString(), deletedAt),
    cleanupSupportAttachments(cutoff.toISOString(), deletedAt),
  ]);

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    ordersDeleted,
    supportDeleted,
    totalDeleted: ordersDeleted + supportDeleted,
  };
}
