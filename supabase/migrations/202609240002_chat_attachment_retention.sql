-- Cosmic Store: registra quando uma imagem antiga da conversa foi removida.
-- Execute depois de 202609240001_chat_attachments_notifications.sql.

alter table public.order_messages
  add column if not exists attachment_deleted_at timestamptz;

alter table public.support_messages
  add column if not exists attachment_deleted_at timestamptz;

create index if not exists order_messages_attachment_cleanup_idx
  on public.order_messages (attachment_deleted_at)
  where attachment_path is not null;

create index if not exists support_messages_attachment_cleanup_idx
  on public.support_messages (attachment_deleted_at)
  where attachment_path is not null;
