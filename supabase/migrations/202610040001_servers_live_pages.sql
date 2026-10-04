-- Servidores e solicitações. Aplicar depois de 202609300001_store_refinement.sql.
-- Reaplicável; preserva pedidos, suporte, estoque e buckets existentes.
begin;

create table if not exists public.game_servers (
 id uuid primary key default gen_random_uuid(),
 game_name text not null check (char_length(trim(game_name)) between 2 and 100),
 name text not null check (char_length(trim(name)) between 2 and 100),
 join_url text not null unique check (char_length(join_url) between 10 and 2048 and join_url ~ '^https://[^/@[:space:]]+\.[^/@[:space:]]+'),
 description text not null default '' check (char_length(description)<=600),
 image_url text,
 is_active boolean not null default true,
 display_order integer not null default 0 check (display_order between 0 and 1000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists game_servers_display_idx on public.game_servers(is_active,display_order,created_at,id);
alter table public.game_servers enable row level security;
grant select on public.game_servers to anon,authenticated;
grant select,insert,update,delete on public.game_servers to service_role;
drop policy if exists "Servidores publicados" on public.game_servers;
create policy "Servidores publicados" on public.game_servers for select to anon,authenticated
 using (is_active or public.is_store_admin());

create or replace function public.touch_game_server() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp();return new;end $$;
revoke all on function public.touch_game_server() from public,anon,authenticated;
drop trigger if exists game_server_updated_at on public.game_servers;
create trigger game_server_updated_at before update on public.game_servers for each row execute function public.touch_game_server();

alter table public.support_tickets add column if not exists requested_game text;
alter table public.support_tickets drop constraint if exists support_tickets_category_check;
alter table public.support_tickets add constraint support_tickets_category_check
 check (category in('order','payment','account','product','other','server_request'));
alter table public.support_tickets drop constraint if exists support_requested_game_check;
alter table public.support_tickets add constraint support_requested_game_check
 check (category<>'server_request' or (requested_game is not null and char_length(trim(requested_game)) between 2 and 100));
create index if not exists support_category_updated_idx on public.support_tickets(category,updated_at desc);

create or replace function public.create_store_server_request(p_user_id uuid,p_request_id uuid,p_game_name text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ticket public.support_tickets%rowtype;
begin
 if p_user_id is null or p_request_id is null then raise exception 'Sessão inválida.';end if;
 if p_game_name is null or char_length(trim(p_game_name)) not between 2 and 100 or p_game_name ~ E'[\n\r]' or p_message is null or char_length(trim(p_message)) not between 5 and 1200 then raise exception 'Informe o jogo e explique seu pedido.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_request_id::text,1));
 select * into v_ticket from public.support_tickets where user_id=p_user_id and request_id=p_request_id;
 if found then
  if v_ticket.category<>'server_request' then raise exception 'Solicitação inválida. Abra um novo pedido.';end if;
  return jsonb_build_object('created',false,'ticket',to_jsonb(v_ticket));
 end if;
 insert into public.support_tickets(user_id,request_id,subject,category,requested_game)
 values(p_user_id,p_request_id,'Servidor VIP — '||trim(p_game_name),'server_request',trim(p_game_name)) returning * into v_ticket;
 insert into public.support_messages(ticket_id,user_id,message)
 values(v_ticket.id,p_user_id,'Jogo: '||trim(p_game_name)||E'\n\n'||trim(p_message));
 return jsonb_build_object('created',true,'ticket',to_jsonb(v_ticket));
end $$;
revoke all on function public.create_store_server_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_store_server_request(uuid,uuid,text,text) to service_role;

-- Nova função evita alterar a assinatura usada pelo painel anterior.
create or replace function public.list_store_support_filtered(p_query text default '',p_status text default '',p_sort text default 'priority',p_page integer default 1,p_category text default '')
returns jsonb language sql stable security definer set search_path='' as $$
 with filtered as materialized (
  select t.id,t.subject,t.category,t.requested_game,t.status,t.created_at,t.updated_at,jsonb_build_object('nickname',p.nickname) profiles,
  case t.status when 'open' then 0 when 'answered' then 1 else 2 end priority
  from public.support_tickets t left join public.profiles p on p.id=t.user_id
  where (coalesce(p_query,'')='' or strpos(lower(t.subject||' '||coalesce(t.requested_game,'')||' '||coalesce(p.nickname,'')),lower(left(trim(p_query),100)))>0)
  and (coalesce(p_status,'')='' or t.status=p_status)
  and (coalesce(p_category,'')='' or t.category=p_category)
 ),info as (select count(*) total,greatest(1,least(greatest(coalesce(p_page,1),1),ceil(count(*)/25.0)::integer)) page from filtered),
 paged as (select * from filtered order by case when p_sort='priority' then priority else 0 end,case when p_sort='oldest' then updated_at end asc,case when p_sort<>'oldest' then updated_at end desc,id limit 25 offset(select (page-1)*25 from info))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged)-'priority') from paged),'[]'::jsonb),'total',info.total,'page',info.page) from info;
$$;
revoke all on function public.list_store_support_filtered(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.list_store_support_filtered(text,text,text,integer,text) to service_role;

-- Usa um sinal público sem dados do catálogo para avisar inclusive quando um
-- item deixa de ser visível em RLS (ocultação/exclusão não envia a linha ao anon).
create table if not exists public.store_live_updates (
 scope text primary key check (scope in('catalog','servers','reviews','admin')),
 version bigint not null default 0,
 updated_at timestamptz not null default now()
);
insert into public.store_live_updates(scope) values('catalog'),('servers'),('reviews'),('admin') on conflict do nothing;
alter table public.store_live_updates enable row level security;
grant select on public.store_live_updates to anon,authenticated;
grant all on public.store_live_updates to service_role;
drop policy if exists "Sinais publicos da loja" on public.store_live_updates;
create policy "Sinais publicos da loja" on public.store_live_updates for select to anon,authenticated using(scope<>'admin' or public.is_store_admin());
create or replace function public.signal_store_live_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.store_live_updates set version=version+1,updated_at=clock_timestamp() where scope=TG_ARGV[0];
 return null;
end $$;
revoke all on function public.signal_store_live_update() from public,anon,authenticated;

do $$ declare v_table text;v_scope text;
begin
 for v_table,v_scope in select * from (values ('products','catalog'),('games','catalog'),('categories','catalog'),('combos','catalog'),('combo_items','catalog'),('store_settings','catalog'),('game_servers','servers'),('feedbacks','reviews'),('orders','admin'),('order_messages','admin'),('support_tickets','admin'),('support_messages','admin'),('notifications','admin'),('message_reports','admin')) x(table_name,scope_name) loop
  execute format('drop trigger if exists store_live_signal on public.%I',v_table);
  execute format('create trigger store_live_signal after insert or update or delete on public.%I for each statement execute function public.signal_store_live_update(%L)',v_table,v_scope);
 end loop;
end $$;
do $$ declare v_table text;
begin
 for v_table in select unnest(array['store_live_updates','orders','support_tickets','notifications']) loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
   execute format('alter publication supabase_realtime add table public.%I',v_table);
  end if;
 end loop;
end $$;
commit;
