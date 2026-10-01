-- Cosmic Store: atualização incremental. Execute após as migrações já instaladas.
-- Não recria contas, produtos, imagens ou pedidos existentes.
begin;

create table if not exists public.store_settings (
 id boolean primary key default true check (id),
 featured_product_id uuid references public.products(id) on delete set null
);
insert into public.store_settings(id) values(true) on conflict do nothing;
alter table public.store_settings enable row level security;
drop policy if exists "Vitrine publica" on public.store_settings;
create policy "Vitrine publica" on public.store_settings for select using(true);
grant select on public.store_settings to anon, authenticated;
grant all on public.store_settings to service_role;

-- Uma fotografia dos componentes protege pedidos quando um combo é editado depois.
create table if not exists public.order_stock_items (
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 product_name text not null,
 quantity integer not null check(quantity>0),
 deducted_quantity integer not null default 0 check(deducted_quantity>=0),
 id uuid primary key default gen_random_uuid(),
 unique(order_id,product_id)
);
alter table public.order_stock_items enable row level security;
revoke all on public.order_stock_items from anon, authenticated;
grant all on public.order_stock_items to service_role;
create index if not exists order_stock_product_idx on public.order_stock_items(product_id);
create index if not exists products_category_display_idx on public.products(category_id,display_order);
create index if not exists notifications_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
alter table public.support_tickets add column if not exists request_id uuid;
create unique index if not exists support_request_unique on public.support_tickets(user_id,request_id) where request_id is not null;

create or replace function public.create_store_order(
 p_user_id uuid,p_checkout_token uuid,p_nickname text,p_order_code text,
 p_pix_payload text,p_items jsonb,p_expected_total numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_order public.orders%rowtype; v_item jsonb; v_product public.products%rowtype;
 v_combo public.combos%rowtype; v_component record; v_total numeric:=0;
 v_rows jsonb:='[]'; v_needs jsonb:='{}'; v_quantity integer; v_kind text; v_id uuid; v_entry record;
begin
 if p_user_id is null or p_checkout_token is null or char_length(trim(p_nickname)) not between 2 and 60 then raise exception 'Dados de checkout inválidos.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_checkout_token::text,0));
 select * into v_order from public.orders where user_id=p_user_id and checkout_token=p_checkout_token;
 if found then return jsonb_build_object('created',false,'order',to_jsonb(v_order)); end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'Carrinho inválido.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'kind',x->>'id' having count(*)>1) then raise exception 'Itens repetidos.'; end if;
 -- Todos os caminhos que alteram combos travam primeiro os combos, depois os produtos, em ordem.
 perform c.id from public.combos c where c.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo') order by c.id for share;
 perform p.id from public.products p where p.id in(
  select (x->>'id')::uuid from jsonb_array_elements(p_items) x where coalesce(x->>'kind','product')='product'
  union select ci.product_id from public.combo_items ci where ci.combo_id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo')
 ) order by p.id for share;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if (v_item->>'quantity') is null or (v_item->>'quantity') !~ '^[0-9]+$' then raise exception 'Quantidade inválida.'; end if;
  v_quantity:=(v_item->>'quantity')::integer; v_kind:=coalesce(v_item->>'kind','product'); v_id:=(v_item->>'id')::uuid;
  if v_quantity is null or v_quantity not between 1 and 99 or v_kind not in('product','combo') then raise exception 'Quantidade inválida.'; end if;
  if v_kind='product' then
   select * into v_product from public.products where id=v_id;
   if not found or not v_product.is_active then raise exception 'Produto indisponível.'; end if;
   if (v_item->>'unit_price')::numeric is distinct from v_product.price then raise exception 'O preço mudou. Atualize o carrinho antes de pagar.'; end if;
   v_total:=v_total+v_product.price*v_quantity;
   v_rows:=v_rows||jsonb_build_array(jsonb_build_object('product_id',v_id,'combo_id',null,'product_name',v_product.name,'unit_price',v_product.price,'quantity',v_quantity));
   v_needs:=jsonb_set(v_needs,array[v_id::text],to_jsonb(coalesce((v_needs->>v_id::text)::integer,0)+v_quantity));
  else
   select * into v_combo from public.combos where id=v_id;
   if not found or not v_combo.is_active or (v_combo.starts_at is not null and v_combo.starts_at>now()) or (v_combo.ends_at is not null and v_combo.ends_at<=now()) then raise exception 'Combo indisponível ou promoção encerrada.'; end if;
   if (v_item->>'unit_price')::numeric is distinct from v_combo.price then raise exception 'O preço do combo mudou. Atualize o carrinho.'; end if;
   if not exists(select 1 from public.combo_items where combo_id=v_id) then raise exception 'Combo sem produtos.'; end if;
   v_total:=v_total+v_combo.price*v_quantity;
   v_rows:=v_rows||jsonb_build_array(jsonb_build_object('product_id',null,'combo_id',v_id,'product_name',v_combo.name,'unit_price',v_combo.price,'quantity',v_quantity));
   for v_component in select product_id,quantity from public.combo_items where combo_id=v_id loop
    v_needs:=jsonb_set(v_needs,array[v_component.product_id::text],to_jsonb(coalesce((v_needs->>v_component.product_id::text)::integer,0)+v_component.quantity*v_quantity));
   end loop;
  end if;
 end loop;
 for v_entry in select key,value from jsonb_each_text(v_needs) loop
  select * into v_product from public.products where id=v_entry.key::uuid;
  if not found or not v_product.is_active or not exists(select 1 from public.categories c join public.games g on g.id=c.game_id where c.id=v_product.category_id and g.is_active) then raise exception 'Um produto ou jogo não está disponível.'; end if;
  if not v_product.unlimited_stock and v_product.stock<v_entry.value::integer then raise exception 'Estoque insuficiente para %.',v_product.name; end if;
 end loop;
 v_total:=round(v_total,2);
 if v_total<=0 or v_total is distinct from p_expected_total or char_length(p_pix_payload)<20 then raise exception 'O valor mudou. Atualize o carrinho.'; end if;
 insert into public.orders(order_code,user_id,game_nickname,total,pix_payload,checkout_token)
 values(p_order_code,p_user_id,trim(p_nickname),v_total,p_pix_payload,p_checkout_token) returning * into v_order;
 insert into public.order_items(order_id,product_id,combo_id,product_name,unit_price,quantity)
 select v_order.id,r.product_id,r.combo_id,r.product_name,r.unit_price,r.quantity
 from jsonb_to_recordset(v_rows) as r(product_id uuid,combo_id uuid,product_name text,unit_price numeric,quantity integer);
 insert into public.order_stock_items(order_id,product_id,product_name,quantity)
 select v_order.id,p.id,p.name,n.value::integer from jsonb_each_text(v_needs) n join public.products p on p.id=n.key::uuid;
 return jsonb_build_object('created',true,'order',to_jsonb(v_order));
end $$;

create or replace function public.commit_order_stock(target_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_item record; v_product public.products%rowtype;
begin
 select * into v_order from public.orders where id=target_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 if v_order.stock_restored_at is not null then raise exception 'O estoque deste pedido já foi devolvido.'; end if;
 if v_order.stock_deducted_at is not null then return; end if;
 -- Compatibilidade com pedidos criados antes desta atualização.
 if not exists(select 1 from public.order_stock_items where order_id=target_order_id) then
  insert into public.order_stock_items(order_id,product_id,product_name,quantity)
  select target_order_id,p.id,p.name,sum(n.quantity)::integer from (
   select i.product_id,i.quantity from public.order_items i where i.order_id=target_order_id and i.product_id is not null
   union all select ci.product_id,ci.quantity*i.quantity from public.order_items i join public.combo_items ci on ci.combo_id=i.combo_id where i.order_id=target_order_id
  ) n join public.products p on p.id=n.product_id group by p.id,p.name;
 end if;
 perform p.id from public.products p join public.order_stock_items s on s.product_id=p.id where s.order_id=target_order_id order by p.id for update of p;
 for v_item in select * from public.order_stock_items where order_id=target_order_id order by product_id loop
  if v_item.product_id is null then raise exception 'Um produto deste pedido foi removido.'; end if;
  select * into v_product from public.products where id=v_item.product_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not v_product.unlimited_stock then
   if v_product.stock<v_item.quantity then raise exception 'Estoque insuficiente para %.',v_product.name; end if;
   update public.products set stock=stock-v_item.quantity where id=v_item.product_id;
   update public.order_stock_items set deducted_quantity=v_item.quantity where id=v_item.id;
  end if;
 end loop;
 update public.orders set stock_deducted_at=now() where id=target_order_id;
end $$;

create or replace function public.restore_order_stock(target_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;
begin
 select * into v_order from public.orders where id=target_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 if v_order.stock_deducted_at is null or v_order.stock_restored_at is not null then return; end if;
 if exists(select 1 from public.order_stock_items where order_id=target_order_id) then
  perform p.id from public.products p join public.order_stock_items s on s.product_id=p.id where s.order_id=target_order_id order by p.id for update of p;
  update public.products p set stock=p.stock+s.deducted_quantity from public.order_stock_items s where s.order_id=target_order_id and s.product_id=p.id;
 else
  -- Os registros antigos não possuem fotografia: conserva o comportamento anterior.
  perform p.id from public.products p where p.id in(
   select i.product_id from public.order_items i where i.order_id=target_order_id
   union select ci.product_id from public.order_items i join public.combo_items ci on ci.combo_id=i.combo_id where i.order_id=target_order_id
  ) order by p.id for update;
  update public.products p set stock=p.stock+n.quantity from (
   select x.product_id,sum(x.quantity)::integer quantity from (
    select product_id,quantity from public.order_items where order_id=target_order_id and product_id is not null
    union all select ci.product_id,ci.quantity*i.quantity from public.order_items i join public.combo_items ci on ci.combo_id=i.combo_id where i.order_id=target_order_id
   ) x group by product_id
  ) n where p.id=n.product_id and not p.unlimited_stock;
 end if;
 update public.orders set stock_restored_at=now() where id=target_order_id;
end $$;

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
 if p_status='delivered' and not exists(select 1 from public.order_messages m where m.order_id=p_order_id and m.attachment_path is not null and m.attachment_type like 'image/%' and public.is_store_admin(m.user_id)) then raise exception 'Envie a imagem da entrega no chat antes de concluir.'; end if;
 if p_status='paid' then perform public.commit_order_stock(p_order_id); end if;
 if p_status='cancelled' then perform public.restore_order_stock(p_order_id); end if;
 update public.orders set status=p_status,
  paid_at=case when p_status='paid' then now() else paid_at end,
  delivery_due_at=case when p_status='paid' then now()+interval '24 hours' else delivery_due_at end,
  delivered_at=case when p_status='delivered' then now() else delivered_at end,
  chat_closed_at=case when p_status='paid' then null when p_status='delivered' then now() else chat_closed_at end,
  rejection_reason=case when p_status='proof_rejected' then trim(p_reason) when p_status='paid' then null else rejection_reason end
 where id=p_order_id returning * into v_order;
 insert into public.order_admin_events(order_id,admin_id,action,details) values(p_order_id,p_admin_id,'status:'||p_status,case when p_status='proof_rejected' then jsonb_build_object('rejection_reason',trim(p_reason)) else null end);
 return jsonb_build_object('changed',true,'order',to_jsonb(v_order));
end $$;

create or replace function public.bulk_update_store_products(p_ids uuid[],p_action text,p_value numeric default null)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if cardinality(p_ids) not between 1 and 1000 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) or array_position(p_ids,null) is not null then raise exception 'Selecione produtos válidos.'; end if;
 if p_action not in('publish','hide','stock','price_percent') then raise exception 'Ação inválida.'; end if;
 if p_action='stock' and (p_value is null or p_value<>trunc(p_value) or p_value not between 0 and 2147483647) then raise exception 'Estoque inválido.'; end if;
 if p_action='price_percent' and (p_value is null or p_value not between -99 and 1000) then raise exception 'Percentual inválido.'; end if;
 perform id from public.products where id=any(p_ids) order by id for update;
 if (select count(*) from public.products where id=any(p_ids))<>cardinality(p_ids) then raise exception 'Um produto mudou. Atualize o catálogo.'; end if;
 update public.products set
 is_active=case when p_action='publish' then true when p_action='hide' then false else is_active end,
 stock=case when p_action='stock' then p_value::integer else stock end,
 unlimited_stock=case when p_action='stock' then false else unlimited_stock end,
 price=case when p_action='price_percent' then round(price*(1+p_value/100),2) else price end
 where id=any(p_ids);
 get diagnostics v_count=row_count;return v_count;
end $$;

create or replace function public.create_store_support_ticket(p_user_id uuid,p_request_id uuid,p_subject text,p_category text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ticket public.support_tickets%rowtype;
begin
 if p_user_id is null or p_request_id is null then raise exception 'Sessão inválida.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_request_id::text,1));
 select * into v_ticket from public.support_tickets where user_id=p_user_id and request_id=p_request_id;
 if found then return jsonb_build_object('created',false,'ticket',to_jsonb(v_ticket)); end if;
 if char_length(trim(p_subject)) not between 3 and 120 or char_length(trim(p_message)) not between 1 and 1500 or p_category not in('order','payment','account','product','other') then raise exception 'Confira assunto, categoria e mensagem.'; end if;
 insert into public.support_tickets(user_id,request_id,subject,category) values(p_user_id,p_request_id,trim(p_subject),p_category) returning * into v_ticket;
 insert into public.support_messages(ticket_id,user_id,message) values(v_ticket.id,p_user_id,trim(p_message));
 return jsonb_build_object('created',true,'ticket',to_jsonb(v_ticket));
end $$;

create or replace function public.guard_product_pending_orders() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.orders o where o.status not in('cancelled','delivered') and (
 exists(select 1 from public.order_stock_items s where s.order_id=o.id and s.product_id=old.id) or
 exists(select 1 from public.order_items i where i.order_id=o.id and i.product_id=old.id))) then raise exception 'Este produto pertence a um pedido em andamento. Oculte-o em vez de excluir.'; end if;
 return old;
end $$;
drop trigger if exists product_pending_order_guard on public.products;
create trigger product_pending_order_guard before delete on public.products for each row execute function public.guard_product_pending_orders();

revoke all on function public.create_store_order(uuid,uuid,text,text,text,jsonb,numeric) from public,anon,authenticated;
revoke all on function public.transition_store_order(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.bulk_update_store_products(uuid[],text,numeric) from public,anon,authenticated;
revoke all on function public.create_store_support_ticket(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.commit_order_stock(uuid) from public,anon,authenticated;
revoke all on function public.restore_order_stock(uuid) from public,anon,authenticated;
grant execute on function public.create_store_order(uuid,uuid,text,text,text,jsonb,numeric) to service_role;
grant execute on function public.transition_store_order(uuid,uuid,text,text,text) to service_role;
grant execute on function public.bulk_update_store_products(uuid[],text,numeric) to service_role;
grant execute on function public.create_store_support_ticket(uuid,uuid,text,text,text) to service_role;
grant execute on function public.commit_order_stock(uuid) to service_role;
grant execute on function public.restore_order_stock(uuid) to service_role;

create or replace function public.store_dashboard_summary()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'proofs',(select count(*) from public.orders where status in('proof_submitted','under_review')),
 'deliveries',(select count(*) from public.orders where status in('paid','preparing_delivery')),
 'products',(select count(*) from public.products),
 'lowStock',(select count(*) from public.products where is_active and not unlimited_stock and stock between 1 and 2),
 'outStock',(select count(*) from public.products where is_active and not unlimited_stock and stock=0),
 'support',(select count(*) from public.support_tickets where status='open'),
 'paidToday',coalesce((select sum(total) from public.orders where status in('paid','preparing_delivery','delivered') and (paid_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date),0),
 'paidMonth',coalesce((select sum(total) from public.orders where status in('paid','preparing_delivery','delivered') and date_trunc('month',paid_at at time zone 'America/Sao_Paulo')=date_trunc('month',now() at time zone 'America/Sao_Paulo')),0));
$$;

create or replace function public.list_store_orders(p_query text default '',p_status text default '',p_sort text default 'priority',p_page integer default 1)
returns jsonb language sql stable security definer set search_path='' as $$
 with filtered as materialized (
  select o.id,o.order_code,o.status,o.total,o.game_nickname,o.created_at,jsonb_build_object('nickname',p.nickname) profiles,
  case o.status when 'proof_submitted' then 0 when 'under_review' then 1 when 'paid' then 2 when 'preparing_delivery' then 3 when 'proof_rejected' then 4 when 'awaiting_payment' then 5 when 'delivered' then 6 else 7 end priority
  from public.orders o left join public.profiles p on p.id=o.user_id
  where (coalesce(p_query,'')='' or strpos(lower(o.order_code||' '||o.game_nickname||' '||coalesce(p.nickname,'')),lower(left(trim(p_query),100)))>0)
  and (coalesce(p_status,'')='' or p_status='pending' and o.status in('proof_submitted','under_review') or p_status='delivery' and o.status in('paid','preparing_delivery') or o.status=p_status)
 ), info as (select count(*) total,greatest(1,least(greatest(coalesce(p_page,1),1),ceil(count(*)/25.0)::integer)) page from filtered),
 paged as (select * from filtered order by case when p_sort='priority' then priority else 0 end,case when p_sort='oldest' then created_at end asc,case when p_sort<>'oldest' then created_at end desc,id limit 25 offset (select (page-1)*25 from info))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged)-'priority') from paged),'[]'::jsonb),'total',info.total,'page',info.page,
 'counts',jsonb_build_object('total',(select count(*) from public.orders),'proofs',(select count(*) from public.orders where status in('proof_submitted','under_review')),'delivery',(select count(*) from public.orders where status in('paid','preparing_delivery')),'delivered',(select count(*) from public.orders where status='delivered'))) from info;
$$;

create or replace function public.list_store_support(p_query text default '',p_status text default '',p_sort text default 'priority',p_page integer default 1)
returns jsonb language sql stable security definer set search_path='' as $$
 with filtered as materialized (
  select t.id,t.subject,t.category,t.status,t.created_at,t.updated_at,jsonb_build_object('nickname',p.nickname) profiles,
  case t.status when 'open' then 0 when 'answered' then 1 else 2 end priority
  from public.support_tickets t left join public.profiles p on p.id=t.user_id
  where (coalesce(p_query,'')='' or strpos(lower(t.subject||' '||coalesce(p.nickname,'')),lower(left(trim(p_query),100)))>0) and (coalesce(p_status,'')='' or t.status=p_status)
 ),info as (select count(*) total,greatest(1,least(greatest(coalesce(p_page,1),1),ceil(count(*)/25.0)::integer)) page from filtered),
 paged as (select * from filtered order by case when p_sort='priority' then priority else 0 end,case when p_sort='oldest' then updated_at end asc,case when p_sort<>'oldest' then updated_at end desc,id limit 25 offset(select (page-1)*25 from info))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged)-'priority') from paged),'[]'::jsonb),'total',info.total,'page',info.page) from info;
$$;

create or replace function public.save_store_combo(p_admin_id uuid,p_combo_id uuid,p_name text,p_slug text,p_description text,p_price numeric,p_image_url text,p_active boolean,p_ends_at timestamptz,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_combo public.combos%rowtype;v_compare numeric:=0;v_item jsonb;v_product public.products%rowtype;v_slug text;v_attempt integer:=1;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 if char_length(trim(p_name)) not between 2 and 120 or char_length(coalesce(p_description,''))>3000 or p_price is null or p_price<=0 or p_price<>round(p_price,2) then raise exception 'Nome ou preço do combo inválido.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'Selecione de 1 a 40 produtos.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'id' having count(*)>1) then raise exception 'Produtos repetidos.'; end if;
 if p_active and p_ends_at is not null and p_ends_at<=now() then raise exception 'A data final precisa estar no futuro.'; end if;
 if p_combo_id is not null then select * into v_combo from public.combos where id=p_combo_id for update;if not found then raise exception 'Combo não encontrado.';end if;else
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug)>100 then raise exception 'Identificador inválido.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combo:'||p_slug,0));
 end if;
 perform id from public.products where id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x) order by id for share;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if (v_item->>'quantity') is null or (v_item->>'quantity') !~ '^[0-9]+$' or (v_item->>'quantity')::integer not between 1 and 99 then raise exception 'Quantidade inválida.'; end if;
  select * into v_product from public.products where id=(v_item->>'id')::uuid;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if p_active and (not v_product.is_active or not exists(select 1 from public.categories c join public.games g on g.id=c.game_id where c.id=v_product.category_id and g.is_active)) then raise exception 'Publique o combo com produtos e jogos ativos.'; end if;
  v_compare:=v_compare+v_product.price*(v_item->>'quantity')::integer;
 end loop;
 v_compare:=round(v_compare,2);if p_price>v_compare then raise exception 'O preço do combo não pode superar a soma dos produtos.'; end if;
 if p_combo_id is null then
  loop
   v_slug:=case when v_attempt=1 then p_slug else left(p_slug,90)||'-'||v_attempt::text end;
   begin
    insert into public.combos(name,slug,description,price,compare_at_price,image_url,is_active,ends_at,created_by) values(trim(p_name),v_slug,nullif(trim(p_description),''),p_price,v_compare,nullif(p_image_url,''),p_active,p_ends_at,p_admin_id) returning * into v_combo;
    exit;
   exception when unique_violation then v_attempt:=v_attempt+1;if v_attempt>100 then raise exception 'Não foi possível gerar um identificador.';end if;
   end;
  end loop;
 else
  update public.combos set name=trim(p_name),description=nullif(trim(p_description),''),price=p_price,compare_at_price=v_compare,image_url=nullif(p_image_url,''),is_active=p_active,ends_at=p_ends_at where id=p_combo_id returning * into v_combo;
  delete from public.combo_items where combo_id=p_combo_id;
 end if;
 insert into public.combo_items(combo_id,product_id,quantity) select v_combo.id,(x->>'id')::uuid,(x->>'quantity')::integer from jsonb_array_elements(p_items) x;
 return to_jsonb(v_combo);
end $$;
revoke all on function public.store_dashboard_summary() from public,anon,authenticated;
revoke all on function public.list_store_orders(text,text,text,integer) from public,anon,authenticated;
revoke all on function public.list_store_support(text,text,text,integer) from public,anon,authenticated;
revoke all on function public.save_store_combo(uuid,uuid,text,text,text,numeric,text,boolean,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.store_dashboard_summary() to service_role;
grant execute on function public.list_store_orders(text,text,text,integer) to service_role;
grant execute on function public.list_store_support(text,text,text,integer) to service_role;
grant execute on function public.save_store_combo(uuid,uuid,text,text,text,numeric,text,boolean,timestamptz,jsonb) to service_role;

commit;
