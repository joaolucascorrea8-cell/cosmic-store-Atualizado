-- Cosmic Store: venda de Robux via GamePass com integração Quick Buy da ByRobux.

alter table public.orders add column if not exists order_type text not null default 'store';
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add constraint orders_order_type_check check (order_type in ('store','robux'));
create index if not exists orders_type_created_idx on public.orders(order_type,created_at desc);

create table if not exists public.robux_settings (
  id smallint primary key default 1 check (id=1),
  enabled boolean not null default true,
  min_cosmic_k numeric(10,2) not null default 34 check (min_cosmic_k>0),
  margin_per_thousand numeric(10,2) not null default 9 check (margin_per_thousand>=0),
  max_supplier_k numeric(10,2) not null default 30 check (max_supplier_k>0),
  min_margin_per_thousand numeric(10,2) not null default 7 check (min_margin_per_thousand>=0),
  tutorial_url text not null default '',
  pending_days_min integer not null default 3 check (pending_days_min between 1 and 30),
  pending_days_max integer not null default 7 check (pending_days_max between 1 and 30),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (pending_days_max>=pending_days_min)
);
insert into public.robux_settings(id) values(1) on conflict(id) do nothing;

create table if not exists public.robux_orders (
  order_id uuid primary key references public.orders(id) on delete cascade,
  mode text not null check (mode in ('tax_paid','tax_not_paid')),
  requested_robux integer not null check (requested_robux between 1 and 1000000),
  gamepass_robux integer not null check (gamepass_robux between 1 and 2000000),
  net_robux integer not null check (net_robux between 0 and 1000000),
  gamepass_url text not null check (char_length(gamepass_url) between 20 and 500),
  gamepass_id text not null check (char_length(gamepass_id) between 1 and 80),
  roblox_username text not null check (char_length(roblox_username) between 1 and 60),
  quoted_supplier_k numeric(10,2) not null check (quoted_supplier_k>0),
  quoted_cosmic_k numeric(10,2) not null check (quoted_cosmic_k>0),
  quoted_supplier_cost numeric(12,2) not null check (quoted_supplier_cost>=0),
  quoted_sale_price numeric(12,2) not null check (quoted_sale_price>0),
  supplier_request_id uuid not null default gen_random_uuid(),
  supplier_batch_id text,
  supplier_order_id text,
  supplier_status text not null default 'NOT_STARTED' check (supplier_status in ('NOT_STARTED','PENDING','COMPLETED','CANCELLED','FAILED')),
  supplier_rate_at_execute numeric(10,2),
  supplier_cost_at_execute numeric(12,2),
  supplier_error_code text,
  supplier_error_message text,
  executed_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  last_checked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists robux_orders_batch_unique on public.robux_orders(supplier_batch_id) where supplier_batch_id is not null;
create index if not exists robux_orders_status_idx on public.robux_orders(supplier_status,updated_at desc);

drop trigger if exists robux_settings_updated_at on public.robux_settings;
create trigger robux_settings_updated_at before update on public.robux_settings for each row execute function public.set_updated_at();
drop trigger if exists robux_orders_updated_at on public.robux_orders;
create trigger robux_orders_updated_at before update on public.robux_orders for each row execute function public.set_updated_at();

alter table public.robux_settings enable row level security;
alter table public.robux_orders enable row level security;
revoke all on public.robux_settings from anon;
revoke all on public.robux_orders from anon;
grant select on public.robux_settings to authenticated;
grant select on public.robux_orders to authenticated;
grant all on public.robux_settings to service_role;
grant all on public.robux_orders to service_role;
drop policy if exists "Admin ve configuracao Robux" on public.robux_settings;
create policy "Admin ve configuracao Robux" on public.robux_settings for select to authenticated using (public.is_store_admin());
drop policy if exists "Cliente e admin veem pedido Robux" on public.robux_orders;
create policy "Cliente e admin veem pedido Robux" on public.robux_orders for select to authenticated
using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_admin())));

create or replace function public.create_robux_store_order(
 p_user_id uuid,p_checkout_token uuid,p_order_code text,p_pix_payload text,p_total numeric,
 p_mode text,p_requested_robux integer,p_gamepass_robux integer,p_net_robux integer,
 p_gamepass_url text,p_gamepass_id text,p_roblox_username text,
 p_supplier_k numeric,p_cosmic_k numeric,p_supplier_cost numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_robux public.robux_orders%rowtype; v_name text;
begin
 if p_user_id is null or p_checkout_token is null then raise exception 'Sessão inválida.'; end if;
 if p_mode not in('tax_paid','tax_not_paid') or p_requested_robux not between 1 and 1000000 or p_gamepass_robux not between 1 and 2000000 or p_net_robux not between 0 and 1000000 then raise exception 'Quantidade de Robux inválida.'; end if;
 if char_length(trim(p_gamepass_url)) not between 20 and 500 or char_length(trim(p_gamepass_id)) not between 1 and 80 or char_length(trim(p_roblox_username)) not between 1 and 60 then raise exception 'GamePass inválido.'; end if;
 if p_total<=0 or p_supplier_k<=0 or p_cosmic_k<=0 or p_supplier_cost<0 or char_length(p_pix_payload)<20 then raise exception 'Cotação inválida.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_checkout_token::text,7));
 select * into v_order from public.orders where user_id=p_user_id and checkout_token=p_checkout_token;
 if found then
  if v_order.order_type<>'robux' then raise exception 'Esta sessão já pertence a outro pedido.'; end if;
  select * into v_robux from public.robux_orders where order_id=v_order.id;
  return jsonb_build_object('created',false,'order',to_jsonb(v_order),'robux',to_jsonb(v_robux));
 end if;
 v_name:=case when p_mode='tax_paid' then 'Robux — taxa paga ('||p_requested_robux||' líquidos)' else 'Robux — sem taxa paga (GamePass '||p_gamepass_robux||')' end;
 insert into public.orders(order_code,user_id,status,game_nickname,total,pix_payload,checkout_token,subtotal,discount_total,order_type)
 values(p_order_code,p_user_id,'awaiting_payment',trim(p_roblox_username),round(p_total,2),p_pix_payload,p_checkout_token,round(p_total,2),0,'robux') returning * into v_order;
 insert into public.order_items(order_id,product_id,combo_id,product_name,unit_price,quantity)
 values(v_order.id,null,null,v_name,round(p_total,2),1);
 insert into public.robux_orders(order_id,mode,requested_robux,gamepass_robux,net_robux,gamepass_url,gamepass_id,roblox_username,quoted_supplier_k,quoted_cosmic_k,quoted_supplier_cost,quoted_sale_price)
 values(v_order.id,p_mode,p_requested_robux,p_gamepass_robux,p_net_robux,trim(p_gamepass_url),trim(p_gamepass_id),trim(p_roblox_username),round(p_supplier_k,2),round(p_cosmic_k,2),round(p_supplier_cost,2),round(p_total,2)) returning * into v_robux;
 return jsonb_build_object('created',true,'order',to_jsonb(v_order),'robux',to_jsonb(v_robux));
end $$;

-- Mantém as transições atuais e trata a entrega de Robux sem exigir print manual.
create or replace function public.transition_store_order(p_order_id uuid,p_admin_id uuid,p_status text,p_expected_status text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_valid boolean;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 if v_order.status=p_status then return jsonb_build_object('changed',false,'order',to_jsonb(v_order)); end if;
 if v_order.status is distinct from p_expected_status then raise exception 'Outro administrador alterou este pedido. Atualize a página.'; end if;
 v_valid:=case v_order.status
  when 'awaiting_payment' then p_status='cancelled'
  when 'proof_rejected' then p_status='cancelled'
  when 'proof_submitted' then p_status in('paid','proof_rejected','cancelled')
  when 'under_review' then p_status in('paid','proof_rejected','cancelled')
  when 'paid' then p_status in('preparing_delivery','cancelled')
  when 'preparing_delivery' then p_status in('delivered','cancelled') else false end;
 if not v_valid then raise exception 'Transição de pedido inválida.'; end if;
 if p_status='proof_rejected' and char_length(trim(p_reason)) not between 5 and 300 then raise exception 'Informe um motivo de 5 a 300 caracteres.'; end if;
 if p_status='delivered' and v_order.order_type<>'robux' and not exists(select 1 from public.order_messages m where m.order_id=p_order_id and m.attachment_path is not null and m.attachment_type like 'image/%' and public.is_store_admin(m.user_id)) then raise exception 'Envie a imagem da entrega no chat antes de concluir.'; end if;
 if p_status='paid' then perform public.commit_order_stock(p_order_id); end if;
 if p_status='cancelled' then perform public.restore_order_stock(p_order_id); end if;
 update public.orders set status=p_status,
  paid_at=case when p_status='paid' then now() else paid_at end,
  delivery_due_at=case when p_status='paid' then now()+case when v_order.order_type='robux' then interval '7 days' else interval '24 hours' end else delivery_due_at end,
  delivered_at=case when p_status='delivered' then now() else delivered_at end,
  chat_closed_at=case when p_status='paid' then null when p_status='delivered' then now() else chat_closed_at end,
  rejection_reason=case when p_status='proof_rejected' then trim(p_reason) when p_status='paid' then null else rejection_reason end
 where id=p_order_id returning * into v_order;
 insert into public.order_admin_events(order_id,admin_id,action,details) values(p_order_id,p_admin_id,'status:'||p_status,case when p_status='proof_rejected' then jsonb_build_object('rejection_reason',trim(p_reason)) else null end);
 return jsonb_build_object('changed',true,'order',to_jsonb(v_order));
end $$;

revoke all on function public.create_robux_store_order(uuid,uuid,text,text,numeric,text,integer,integer,integer,text,text,text,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.create_robux_store_order(uuid,uuid,text,text,numeric,text,integer,integer,integer,text,text,text,numeric,numeric,numeric) to service_role;
