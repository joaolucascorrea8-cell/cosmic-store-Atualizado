-- Histórico administrativo e diagnóstico dos canais de notificação.
create table if not exists public.order_admin_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  link text,
  channel text not null check (channel in ('site','email','discord')),
  status text not null check (status in ('sent','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists order_admin_events_order_idx on public.order_admin_events(order_id, created_at desc);
create index if not exists notification_deliveries_link_idx on public.notification_deliveries(link, created_at desc);

alter table public.order_admin_events enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Admin ve historico de pedidos" on public.order_admin_events;
create policy "Admin ve historico de pedidos" on public.order_admin_events for select to authenticated using (public.is_store_admin());

drop policy if exists "Admin ve entregas de notificacao" on public.notification_deliveries;
create policy "Admin ve entregas de notificacao" on public.notification_deliveries for select to authenticated using (public.is_store_admin());
