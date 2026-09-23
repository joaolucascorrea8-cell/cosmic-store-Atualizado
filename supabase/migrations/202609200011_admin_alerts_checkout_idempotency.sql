-- Apply after 202609200010. Checkout idempotency and admin Realtime events.
-- An idempotency key is unique per authenticated customer. Existing orders remain valid.
alter table public.orders add column if not exists checkout_token uuid;
create unique index if not exists orders_user_checkout_token_unique
  on public.orders (user_id, checkout_token)
  where checkout_token is not null;

-- Realtime authorization remains protected by each table's existing SELECT RLS policies.
do $$
begin
  alter publication supabase_realtime add table public.support_tickets;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.message_reports;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object then null;
end $$;

-- Comprovantes já enviados não devem poder ser sobrescritos pelo cliente.
-- Novos uploads usam nomes UUID únicos com upsert=false (inclusive após recusa).
drop policy if exists "Cliente atualiza comprovante" on storage.objects;
