create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  category text not null default 'other' check (category in ('order','payment','account','product','other')),
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, updated_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Cliente ve proprios tickets" on public.support_tickets;
create policy "Cliente ve proprios tickets" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_store_admin());
drop policy if exists "Cliente abre ticket" on public.support_tickets;
create policy "Cliente abre ticket" on public.support_tickets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Admin atualiza ticket" on public.support_tickets;
create policy "Admin atualiza ticket" on public.support_tickets for update to authenticated using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists "Participantes veem mensagens suporte" on public.support_messages;
create policy "Participantes veem mensagens suporte" on public.support_messages for select to authenticated using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_store_admin())));
drop policy if exists "Participantes escrevem suporte" on public.support_messages;
create policy "Participantes escrevem suporte" on public.support_messages for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.status <> 'closed' and (t.user_id = auth.uid() or public.is_store_admin())));

do $$ begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null; end $$;
