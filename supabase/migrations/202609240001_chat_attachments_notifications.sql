-- Cosmic Store: anexos privados em conversas e suporte.
-- Execute depois das migrações anteriores.

alter table public.order_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

alter table public.support_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

alter table public.order_messages alter column message set default '';
alter table public.support_messages alter column message set default '';

alter table public.order_messages drop constraint if exists order_messages_message_check;
alter table public.order_messages drop constraint if exists order_messages_content_check;
alter table public.order_messages add constraint order_messages_content_check check (
  (char_length(message) between 1 and 1000)
  or attachment_path is not null
);

alter table public.support_messages drop constraint if exists support_messages_message_check;
alter table public.support_messages drop constraint if exists support_messages_content_check;
alter table public.support_messages add constraint support_messages_content_check check (
  (char_length(message) between 1 and 1500)
  or attachment_path is not null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  3145728,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload e leitura desse bucket passam apenas pelas rotas seguras do servidor.
-- Não há policy pública de storage de propósito.
