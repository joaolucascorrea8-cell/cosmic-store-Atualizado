-- Cosmic Store: atendimento, preferências, servidores e cupons.
-- Aplicar depois de 202610040001_servers_live_pages.sql. Migração repetível.
begin;

alter table public.categories add column if not exists description_template text not null default '' check(char_length(description_template)<=2000);
alter table public.games add column if not exists delivery_hours integer check(delivery_hours between 1 and 720);
alter table public.products add column if not exists delivery_hours integer check(delivery_hours between 1 and 720);
create table if not exists public.store_service_settings (
 id boolean primary key default true check(id),
 delivery_hours integer not null default 24 check(delivery_hours between 1 and 720),
 schedule_enabled boolean not null default false,
 schedule jsonb not null default '[]'::jsonb check(jsonb_typeof(schedule)='array'),
 notice text not null default '' check(char_length(notice)<=300),
 updated_at timestamptz not null default now()
);
insert into public.store_service_settings(id) values(true) on conflict do nothing;
alter table public.store_service_settings enable row level security;
drop policy if exists "Atendimento publico" on public.store_service_settings;
create policy "Atendimento publico" on public.store_service_settings for select using(true);
grant select on public.store_service_settings to anon,authenticated;
grant all on public.store_service_settings to service_role;

create table if not exists public.customer_product_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 favorite boolean not null default false,
 restock boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
create index if not exists preferences_restock_idx on public.customer_product_preferences(product_id) where restock;
alter table public.customer_product_preferences enable row level security;
drop policy if exists "Preferencias proprias" on public.customer_product_preferences;
create policy "Preferencias proprias" on public.customer_product_preferences for select to authenticated using(user_id=auth.uid());
grant select on public.customer_product_preferences to authenticated;
revoke insert,update,delete on public.customer_product_preferences from anon,authenticated;
grant all on public.customer_product_preferences to service_role;

create or replace function public.set_product_preference(p_product_id uuid,p_kind text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_product public.products%rowtype; v_result public.customer_product_preferences%rowtype;
begin
 if v_user is null then raise exception 'Entre na sua conta para continuar.'; end if;
 if p_kind is null or p_kind not in('favorite','restock') or p_enabled is null then raise exception 'Preferência inválida.'; end if;
 select p.* into v_product from public.products p join public.categories c on c.id=p.category_id join public.games g on g.id=c.game_id where p.id=p_product_id and p.is_active and g.is_active for share of p;
 if not found and p_enabled then raise exception 'Produto indisponível.'; end if;
 if p_kind='restock' and p_enabled and (v_product.unlimited_stock or v_product.stock>0) then raise exception 'O produto já está disponível. Atualize a página.'; end if;
 if not p_enabled and not exists(select 1 from public.customer_product_preferences where user_id=v_user and product_id=p_product_id) then return jsonb_build_object('favorite',false,'restock',false); end if;
 insert into public.customer_product_preferences(user_id,product_id,favorite,restock)
 values(v_user,p_product_id,p_kind='favorite' and p_enabled,p_kind='restock' and p_enabled)
 on conflict(user_id,product_id) do update set
 favorite=case when p_kind='favorite' then p_enabled else customer_product_preferences.favorite end,
 restock=case when p_kind='restock' then p_enabled else customer_product_preferences.restock end,updated_at=now()
 returning * into v_result;
 return to_jsonb(v_result);
end $$;
revoke all on function public.set_product_preference(uuid,text,boolean) from public,anon;
grant execute on function public.set_product_preference(uuid,text,boolean) to authenticated;

-- A assinatura é consumida uma única vez, na mesma transação da reposição.
create or replace function public.deliver_restock_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 with available as (
  select w.user_id,w.product_id,p.name,p.slug from public.customer_product_preferences w
  join public.products p on p.id=w.product_id join public.categories c on c.id=p.category_id join public.games g on g.id=c.game_id
  where w.restock and p.is_active and g.is_active and (p.unlimited_stock or p.stock>0)
  for update of w skip locked
 ), consumed as (
  update public.customer_product_preferences w set restock=false,updated_at=now() from available a
  where w.user_id=a.user_id and w.product_id=a.product_id returning w.user_id,a.name,a.slug
 ) insert into public.notifications(user_id,title,body,link)
 select user_id,'Produto de volta ao estoque',name||' está disponível novamente. Confira o preço e o estoque na loja.','/produto/'||slug from consumed;
 return null;
end $$;
revoke all on function public.deliver_restock_notifications() from public,anon,authenticated;
drop trigger if exists notify_restock on public.products;
create trigger notify_restock after update on public.products for each statement execute function public.deliver_restock_notifications();
drop trigger if exists notify_restock on public.games;
create trigger notify_restock after update on public.games for each statement execute function public.deliver_restock_notifications();

alter table public.game_servers add column if not exists availability text not null default 'available' check(availability in('available','maintenance','unavailable'));
create table if not exists public.server_reports (
 id uuid primary key default gen_random_uuid(),server_id uuid not null references public.game_servers(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in('invalid_link','cannot_join','other')),
 details text not null default '' check(char_length(details)<=600),
 status text not null default 'open' check(status in('open','resolved')),
 created_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index if not exists server_report_open_unique on public.server_reports(server_id,user_id) where status='open';
create index if not exists server_reports_status_idx on public.server_reports(status,created_at);
alter table public.server_reports enable row level security;
drop policy if exists "Relatos proprios ou admin" on public.server_reports;
create policy "Relatos proprios ou admin" on public.server_reports for select to authenticated using(user_id=auth.uid() or public.is_store_admin());
grant select on public.server_reports to authenticated;
grant all on public.server_reports to service_role;
create or replace function public.report_game_server(p_server_id uuid,p_reason text,p_details text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_name text;
begin
 if v_user is null then raise exception 'Entre na sua conta para avisar a equipe.'; end if;
 if p_reason is null or p_reason not in('invalid_link','cannot_join','other') or char_length(coalesce(p_details,''))>600 then raise exception 'Confira o motivo e a descrição.'; end if;
 if p_reason='other' and char_length(trim(coalesce(p_details,'')))<5 then raise exception 'Explique o problema em pelo menos 5 caracteres.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('server-report:'||v_user::text,0));
 select id into v_id from public.server_reports where user_id=v_user and server_id=p_server_id and status='open';
 if found then return v_id; end if;
 if (select count(*) from public.server_reports where user_id=v_user and created_at>now()-interval '1 day')>=5 then raise exception 'Você já enviou avisos hoje. Aguarde a equipe.'; end if;
 select game_name||' — '||name into v_name from public.game_servers where id=p_server_id and is_active;
 if not found then raise exception 'Servidor indisponível.'; end if;
 insert into public.server_reports(server_id,user_id,reason,details) values(p_server_id,v_user,p_reason,trim(coalesce(p_details,''))) returning id into v_id;
 insert into public.notifications(user_id,title,body,link) select user_id,'Problema em servidor',v_name||': um cliente informou um problema.','/admin/servidores#relatos' from public.admins where role in('owner','admin');
 return v_id;
end $$;
revoke all on function public.report_game_server(uuid,text,text) from public,anon;
grant execute on function public.report_game_server(uuid,text,text) to authenticated;

create table if not exists public.store_coupons (
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9_-]{2,29}$'),
 kind text not null check(kind in('percent','fixed')),amount numeric(12,2) not null check(amount>0),
 min_order numeric(12,2) not null default 0 check(min_order>=0),
 max_uses integer check(max_uses between 1 and 1000000),per_user_limit integer not null default 1 check(per_user_limit between 1 and 1000),
 starts_at timestamptz,ends_at timestamptz,is_active boolean not null default false,
 game_id uuid references public.games(id) on delete restrict,product_id uuid references public.products(id) on delete restrict,
 include_combos boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(kind<>'percent' or amount<=99),check(game_id is null or product_id is null),
 check(ends_at is null or starts_at is null or ends_at>starts_at),
 check(not include_combos or (game_id is null and product_id is null))
);
alter table public.store_coupons enable row level security;
revoke all on public.store_coupons from anon,authenticated;
grant all on public.store_coupons to service_role;
alter table public.orders add column if not exists subtotal numeric(12,2);
alter table public.orders add column if not exists discount_total numeric(12,2) not null default 0 check(discount_total>=0);
alter table public.orders add column if not exists coupon_id uuid references public.store_coupons(id) on delete restrict;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists delivery_hours integer check(delivery_hours between 1 and 720);
update public.orders set subtotal=total where subtotal is null;
create index if not exists orders_coupon_usage_idx on public.orders(coupon_id,user_id) where status<>'cancelled';

-- Uso conta ao gerar o pedido, evitando exceder limites com Pix concorrentes.
-- Cancelados não contam; expirar/editar um cupom não altera pedidos já criados.
create or replace function public.quote_store_checkout(p_user_id uuid,p_items jsonb,p_code text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item jsonb; v_product public.products%rowtype; v_combo public.combos%rowtype; v_coupon public.store_coupons%rowtype;
 v_quantity integer; v_kind text; v_id uuid; v_game uuid; v_game_hours integer; v_default integer;
 v_hours integer:=1; v_subtotal numeric:=0; v_eligible numeric:=0; v_discount numeric:=0; v_code text:=upper(trim(coalesce(p_code,'')));
begin
 if p_user_id is null then raise exception 'Entre na sua conta para continuar.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'Carrinho inválido.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x group by coalesce(x->>'kind','product'),x->>'id' having count(*)>1) then raise exception 'Itens repetidos.'; end if;
 if v_code<>'' then
  select * into v_coupon from public.store_coupons where code=v_code for update;
  if not found or not v_coupon.is_active or (v_coupon.starts_at is not null and v_coupon.starts_at>now()) or (v_coupon.ends_at is not null and v_coupon.ends_at<=now()) then raise exception 'Cupom inválido ou fora da validade.'; end if;
  if v_coupon.max_uses is not null and (select count(*) from public.orders where coupon_id=v_coupon.id and status<>'cancelled')>=v_coupon.max_uses then raise exception 'Este cupom atingiu o limite de usos.'; end if;
  if (select count(*) from public.orders where coupon_id=v_coupon.id and user_id=p_user_id and status<>'cancelled')>=v_coupon.per_user_limit then raise exception 'Você já usou este cupom o máximo de vezes permitido.'; end if;
 end if;
 select delivery_hours into v_default from public.store_service_settings where id;
 v_default:=coalesce(v_default,24);
 perform c.id from public.combos c where c.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo') order by c.id for share;
 perform p.id from public.products p where p.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where coalesce(x->>'kind','product')='product' union select ci.product_id from public.combo_items ci where ci.combo_id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo')) order by p.id for share;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if coalesce(v_item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Quantidade inválida.'; end if;
  v_quantity:=(v_item->>'quantity')::integer;v_kind:=coalesce(v_item->>'kind','product');v_id:=(v_item->>'id')::uuid;
  if v_quantity not between 1 and 99 or v_kind not in('product','combo') then raise exception 'Item inválido.'; end if;
  if v_kind='product' then
   select p.* into v_product from public.products p join public.categories c on c.id=p.category_id join public.games g on g.id=c.game_id where p.id=v_id and p.is_active and g.is_active;
   if not found or (not v_product.unlimited_stock and v_product.stock<v_quantity) then raise exception 'Produto indisponível ou sem estoque.'; end if;
   if (v_item->>'unit_price')::numeric is distinct from v_product.price then raise exception 'O preço mudou. Atualize o carrinho antes de pagar.'; end if;
   select g.id,g.delivery_hours into v_game,v_game_hours from public.categories c join public.games g on g.id=c.game_id where c.id=v_product.category_id;
   v_hours:=greatest(v_hours,coalesce(v_product.delivery_hours,v_game_hours,v_default));
   v_subtotal:=v_subtotal+v_product.price*v_quantity;
   if v_code<>'' and (v_coupon.product_id is null or v_coupon.product_id=v_product.id) and (v_coupon.game_id is null or v_coupon.game_id=v_game) then v_eligible:=v_eligible+v_product.price*v_quantity; end if;
  else
   select * into v_combo from public.combos where id=v_id;
   if not found or not v_combo.is_active or (v_combo.starts_at is not null and v_combo.starts_at>now()) or (v_combo.ends_at is not null and v_combo.ends_at<=now()) then raise exception 'Combo indisponível ou promoção encerrada.'; end if;
   if (v_item->>'unit_price')::numeric is distinct from v_combo.price then raise exception 'O preço mudou. Atualize o carrinho antes de pagar.'; end if;
   if not exists(select 1 from public.combo_items where combo_id=v_id) or exists(select 1 from public.combo_items ci join public.products p on p.id=ci.product_id join public.categories c on c.id=p.category_id join public.games g on g.id=c.game_id where ci.combo_id=v_id and (not p.is_active or not g.is_active or (not p.unlimited_stock and p.stock<ci.quantity*v_quantity))) then raise exception 'Um item do combo está indisponível.'; end if;
   select greatest(v_hours,coalesce(max(coalesce(p.delivery_hours,g.delivery_hours,v_default)),v_default)) into v_hours from public.combo_items ci join public.products p on p.id=ci.product_id join public.categories c on c.id=p.category_id join public.games g on g.id=c.game_id where ci.combo_id=v_id;
   v_subtotal:=v_subtotal+v_combo.price*v_quantity;
   if v_code<>'' and v_coupon.include_combos then v_eligible:=v_eligible+v_combo.price*v_quantity; end if;
  end if;
 end loop;
 v_subtotal:=round(v_subtotal,2);
 if v_subtotal<=0 then raise exception 'O total do pedido deve ser positivo.'; end if;
 if v_code<>'' then
  if v_subtotal<v_coupon.min_order then raise exception 'O valor mínimo para este cupom é R$ %.',v_coupon.min_order; end if;
  if v_eligible<=0 then raise exception 'Este cupom não se aplica aos itens do carrinho.'; end if;
  v_discount:=least(round(case when v_coupon.kind='percent' then v_eligible*v_coupon.amount/100 else v_coupon.amount end,2),v_eligible,v_subtotal-0.01);
  if v_discount<=0 then raise exception 'Este cupom não gera desconto para este valor.'; end if;
 end if;
 return jsonb_build_object('subtotal',v_subtotal,'discount',v_discount,'total',v_subtotal-v_discount,'coupon_id',v_coupon.id,'code',nullif(v_code,''),'delivery_hours',v_hours);
end $$;
revoke all on function public.quote_store_checkout(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.quote_store_checkout(uuid,jsonb,text) to service_role;

create or replace function public.create_store_order_with_coupon(p_user_id uuid,p_checkout_token uuid,p_nickname text,p_order_code text,p_pix_payload text,p_items jsonb,p_expected_total numeric,p_code text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;v_quote jsonb;v_result jsonb;
begin
 if p_user_id is null or p_checkout_token is null then raise exception 'Sessão de checkout inválida.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_checkout_token::text,0));
 select * into v_order from public.orders where user_id=p_user_id and checkout_token=p_checkout_token;
 if found then return jsonb_build_object('created',false,'order',to_jsonb(v_order)); end if;
 v_quote:=public.quote_store_checkout(p_user_id,p_items,p_code);
 if (v_quote->>'total')::numeric is distinct from p_expected_total then raise exception 'O desconto ou valor mudou. Confira o resumo novamente.'; end if;
 v_result:=public.create_store_order(p_user_id,p_checkout_token,p_nickname,p_order_code,p_pix_payload,p_items,(v_quote->>'subtotal')::numeric);
 update public.orders set subtotal=(v_quote->>'subtotal')::numeric,discount_total=(v_quote->>'discount')::numeric,total=(v_quote->>'total')::numeric,coupon_id=(v_quote->>'coupon_id')::uuid,coupon_code=v_quote->>'code',delivery_hours=(v_quote->>'delivery_hours')::integer where id=(v_result->'order'->>'id')::uuid returning * into v_order;
 return jsonb_build_object('created',true,'order',to_jsonb(v_order));
end $$;
revoke all on function public.create_store_order_with_coupon(uuid,uuid,text,text,text,jsonb,numeric,text) from public,anon,authenticated;
grant execute on function public.create_store_order_with_coupon(uuid,uuid,text,text,text,jsonb,numeric,text) to service_role;

create or replace function public.apply_store_delivery_deadline() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='paid' and old.status is distinct from 'paid' and new.delivery_hours is not null then new.delivery_due_at:=coalesce(new.paid_at,now())+make_interval(hours=>new.delivery_hours); end if;
 return new;
end $$;
revoke all on function public.apply_store_delivery_deadline() from public,anon,authenticated;
drop trigger if exists store_delivery_deadline on public.orders;
create trigger store_delivery_deadline before update of status on public.orders for each row execute function public.apply_store_delivery_deadline();

do $$ declare v_table text;v_scope text;begin
 for v_table,v_scope in select * from (values('store_service_settings','catalog'),('server_reports','admin'),('store_coupons','admin')) x(t,s) loop
  execute format('drop trigger if exists store_live_signal on public.%I',v_table);
  execute format('create trigger store_live_signal after insert or update or delete on public.%I for each statement execute function public.signal_store_live_update(%L)',v_table,v_scope);
 end loop;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='customer_product_preferences') then alter publication supabase_realtime add table public.customer_product_preferences;end if;
end $$;
create or replace function public.list_store_coupons() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('uses',(select count(*) from public.orders o where o.coupon_id=c.id and o.status<>'cancelled')) order by c.created_at desc,c.id),'[]'::jsonb) from public.store_coupons c;
$$;
revoke all on function public.list_store_coupons() from public,anon,authenticated;
grant execute on function public.list_store_coupons() to service_role;
commit;
