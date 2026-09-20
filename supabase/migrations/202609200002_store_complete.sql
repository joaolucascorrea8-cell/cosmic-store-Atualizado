-- Cosmic Store: pedidos, comprovantes, notificações, chats e feedbacks.
-- Execute depois de 202609200001_create_profiles.sql.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'awaiting_payment' check (status in (
    'awaiting_payment', 'proof_submitted', 'under_review', 'paid',
    'preparing_delivery', 'delivered', 'cancelled', 'proof_rejected'
  )),
  game_nickname text not null check (char_length(game_nickname) between 2 and 60),
  total numeric(12,2) not null check (total > 0),
  pix_payload text not null,
  proof_path text,
  proof_uploaded_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.global_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  reply_to uuid references public.global_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.chat_mutes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  muted_until timestamptz not null,
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.global_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 3 and 600),
  author_nickname text not null,
  author_avatar_url text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists order_messages_order_created_idx on public.order_messages(order_id, created_at);
create index if not exists global_messages_created_idx on public.global_messages(created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists feedbacks_visible_created_idx on public.feedbacks(is_visible, created_at desc);

create or replace function public.is_store_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where user_id = check_user and role in ('owner', 'admin')
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function public.prevent_chat_spam()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_store_admin(new.user_id) and exists (
    select 1 from public.global_messages
    where user_id = new.user_id and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Aguarde um pouco antes de enviar outra mensagem.';
  end if;
  return new;
end;
$$;

drop trigger if exists global_chat_antispam on public.global_messages;
create trigger global_chat_antispam before insert on public.global_messages
for each row execute function public.prevent_chat_spam();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists feedbacks_updated_at on public.feedbacks;
create trigger feedbacks_updated_at before update on public.feedbacks
for each row execute function public.set_updated_at();

create or replace function public.fill_feedback_author()
returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_row public.profiles%rowtype;
begin
  if not exists (
    select 1 from public.orders
    where id = new.order_id and user_id = new.user_id and status = 'delivered'
  ) then
    raise exception 'Somente pedidos entregues podem ser avaliados.';
  end if;
  select * into profile_row from public.profiles where id = new.user_id;
  new.author_nickname := profile_row.nickname;
  new.author_avatar_url := profile_row.avatar_url;
  if tg_op = 'UPDATE' and not public.is_store_admin() then
    new.is_visible := old.is_visible;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_author_before_write on public.feedbacks;
create trigger feedback_author_before_write before insert or update on public.feedbacks
for each row execute function public.fill_feedback_author();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.order_messages enable row level security;
alter table public.global_messages enable row level security;
alter table public.chat_mutes enable row level security;
alter table public.chat_bans enable row level security;
alter table public.message_reports enable row level security;
alter table public.feedbacks enable row level security;

drop policy if exists "Cliente e admin veem pedidos" on public.orders;
create policy "Cliente e admin veem pedidos" on public.orders for select to authenticated
using (user_id = auth.uid() or public.is_store_admin());

drop policy if exists "Cliente e admin veem itens" on public.order_items;
create policy "Cliente e admin veem itens" on public.order_items for select to authenticated
using (exists (select 1 from public.orders where id = order_id and (user_id = auth.uid() or public.is_store_admin())));

drop policy if exists "Usuario ve notificacoes" on public.notifications;
create policy "Usuario ve notificacoes" on public.notifications for select to authenticated
using (user_id = auth.uid());
drop policy if exists "Usuario marca notificacao" on public.notifications;
create policy "Usuario marca notificacao" on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Participantes veem chat do pedido" on public.order_messages;
create policy "Participantes veem chat do pedido" on public.order_messages for select to authenticated
using (exists (select 1 from public.orders where id = order_id and (user_id = auth.uid() or public.is_store_admin())));
drop policy if exists "Participantes enviam no chat do pedido" on public.order_messages;
create policy "Participantes enviam no chat do pedido" on public.order_messages for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.orders where id = order_id and status in ('paid','preparing_delivery','delivered') and (user_id = auth.uid() or public.is_store_admin()))
);

drop policy if exists "Logados veem chat global" on public.global_messages;
create policy "Logados veem chat global" on public.global_messages for select to authenticated using (true);
drop policy if exists "Logados escrevem no chat global" on public.global_messages;
create policy "Logados escrevem no chat global" on public.global_messages for insert to authenticated
with check (
  user_id = auth.uid()
  and not exists (select 1 from public.chat_bans where user_id = auth.uid())
  and not exists (select 1 from public.chat_mutes where user_id = auth.uid() and muted_until > now())
);
drop policy if exists "Autor ou admin apaga mensagem global" on public.global_messages;
create policy "Autor ou admin apaga mensagem global" on public.global_messages for delete to authenticated
using (user_id = auth.uid() or public.is_store_admin());

drop policy if exists "Usuario ve proprio bloqueio" on public.chat_mutes;
create policy "Usuario ve proprio bloqueio" on public.chat_mutes for select to authenticated
using (user_id = auth.uid() or public.is_store_admin());
drop policy if exists "Usuario ve proprio banimento" on public.chat_bans;
create policy "Usuario ve proprio banimento" on public.chat_bans for select to authenticated
using (user_id = auth.uid() or public.is_store_admin());

drop policy if exists "Usuario denuncia mensagem" on public.message_reports;
create policy "Usuario denuncia mensagem" on public.message_reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists "Admin ve denuncias" on public.message_reports;
create policy "Admin ve denuncias" on public.message_reports for select to authenticated
using (public.is_store_admin());

drop policy if exists "Todos veem feedbacks publicados" on public.feedbacks;
create policy "Todos veem feedbacks publicados" on public.feedbacks for select
using (is_visible = true or user_id = auth.uid() or public.is_store_admin());
drop policy if exists "Cliente avalia pedido entregue" on public.feedbacks;
create policy "Cliente avalia pedido entregue" on public.feedbacks for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.orders where id = order_id and user_id = auth.uid() and status = 'delivered')
);
drop policy if exists "Cliente edita propria avaliacao" on public.feedbacks;
create policy "Cliente edita propria avaliacao" on public.feedbacks for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Cliente envia comprovante" on storage.objects;
create policy "Cliente envia comprovante" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Cliente atualiza comprovante" on storage.objects;
create policy "Cliente atualiza comprovante" on storage.objects for update to authenticated
using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Cliente ve comprovante" on storage.objects;
create policy "Cliente ve comprovante" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_store_admin()));

do $$ begin
  alter publication supabase_realtime add table public.global_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
