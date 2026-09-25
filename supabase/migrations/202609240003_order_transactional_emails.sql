-- Cosmic Store: registra os dois e-mails transacionais do cliente.
-- Execute depois das migrações anteriores.

alter table public.orders
  add column if not exists payment_email_sent_at timestamptz,
  add column if not exists delivery_email_sent_at timestamptz;

create index if not exists orders_payment_email_pending_idx
  on public.orders (status, payment_email_sent_at)
  where status in ('paid','preparing_delivery','delivered') and payment_email_sent_at is null;

create index if not exists orders_delivery_email_pending_idx
  on public.orders (status, delivery_email_sent_at)
  where status = 'delivered' and delivery_email_sent_at is null;
