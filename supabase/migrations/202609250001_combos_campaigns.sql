-- Combos/bundles e campanhas de divulgação da Cosmic Store.
-- Execute depois de 202609240003_order_transactional_emails.sql.

create extension if not exists pgcrypto;

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  price numeric(12,2) not null check (price > 0),
  compare_at_price numeric(12,2) not null check (compare_at_price >= price),
  image_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint combos_date_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.combo_items (
  combo_id uuid not null references public.combos(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 99),
  primary key (combo_id, product_id)
);

alter table public.order_items add column if not exists combo_id uuid references public.combos(id) on delete set null;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  request_token uuid not null unique,
  title text not null check (char_length(title) between 2 and 140),
  body text not null check (char_length(body) between 2 and 3000),
  source_type text not null check (source_type in ('combo','product')),
  source_id uuid not null,
  banner_url text,
  send_email boolean not null default false,
  send_discord boolean not null default false,
  status text not null default 'sending' check (status in ('sending','sent','partial','failed')),
  email_sent_count integer not null default 0,
  email_failed_count integer not null default 0,
  discord_status text check (discord_status in ('sent','failed') or discord_status is null),
  discord_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  channel text not null check (channel in ('email','discord')),
  recipient text,
  status text not null check (status in ('sent','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists combos_active_created_idx on public.combos(is_active, created_at desc);
create index if not exists combo_items_combo_idx on public.combo_items(combo_id);
create index if not exists campaigns_created_idx on public.campaigns(created_at desc);
create index if not exists campaign_deliveries_campaign_idx on public.campaign_deliveries(campaign_id, created_at desc);
create index if not exists order_items_combo_idx on public.order_items(combo_id) where combo_id is not null;

drop trigger if exists combos_updated_at on public.combos;
create trigger combos_updated_at before update on public.combos
for each row execute function public.set_updated_at();

alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_deliveries enable row level security;

drop policy if exists "Combos ativos sao publicos" on public.combos;
create policy "Combos ativos sao publicos" on public.combos for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Itens de combos ativos sao publicos" on public.combo_items;
create policy "Itens de combos ativos sao publicos" on public.combo_items for select
using (
  exists (
    select 1 from public.combos c
    where c.id = combo_id
      and c.is_active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at > now())
  )
);

-- O service role usado pelo painel ignora RLS. Campanhas não ficam expostas ao cliente.

create or replace function public.commit_order_stock(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  item record;
  combo_item record;
  changed integer;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if current_order.stock_deducted_at is not null and current_order.stock_restored_at is null then return; end if;
  if current_order.stock_restored_at is not null then raise exception 'O estoque deste pedido já foi devolvido.'; end if;

  for item in select product_id, combo_id, quantity from public.order_items where order_id = target_order_id loop
    if item.product_id is not null then
      update public.products
      set stock = stock - item.quantity
      where id = item.product_id and unlimited_stock = false and stock >= item.quantity;
      get diagnostics changed = row_count;
      if changed = 0 and exists (select 1 from public.products where id = item.product_id and unlimited_stock = false) then
        raise exception 'Estoque insuficiente para confirmar este pedido.';
      end if;
    elsif item.combo_id is not null then
      for combo_item in
        select ci.product_id, ci.quantity * item.quantity as required_quantity
        from public.combo_items ci where ci.combo_id = item.combo_id
      loop
        update public.products
        set stock = stock - combo_item.required_quantity
        where id = combo_item.product_id and unlimited_stock = false and stock >= combo_item.required_quantity;
        get diagnostics changed = row_count;
        if changed = 0 and exists (select 1 from public.products where id = combo_item.product_id and unlimited_stock = false) then
          raise exception 'Estoque insuficiente para confirmar este combo.';
        end if;
      end loop;
    end if;
  end loop;

  update public.orders set stock_deducted_at = now(), stock_restored_at = null where id = target_order_id;
end;
$$;

create or replace function public.restore_order_stock(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  item record;
  combo_item record;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if current_order.stock_deducted_at is null or current_order.stock_restored_at is not null then return; end if;

  for item in select product_id, combo_id, quantity from public.order_items where order_id = target_order_id loop
    if item.product_id is not null then
      update public.products set stock = stock + item.quantity
      where id = item.product_id and unlimited_stock = false;
    elsif item.combo_id is not null then
      for combo_item in
        select ci.product_id, ci.quantity * item.quantity as restore_quantity
        from public.combo_items ci where ci.combo_id = item.combo_id
      loop
        update public.products set stock = stock + combo_item.restore_quantity
        where id = combo_item.product_id and unlimited_stock = false;
      end loop;
    end if;
  end loop;

  update public.orders set stock_restored_at = now() where id = target_order_id;
end;
$$;

revoke all on function public.commit_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.restore_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.commit_order_stock(uuid) to service_role;
grant execute on function public.restore_order_stock(uuid) to service_role;
