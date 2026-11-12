-- Reserva para NOVOS pedidos. Sem backfill ou alteração dos pedidos históricos.
-- A expiração continua opt-in, nas configurações existentes; cancelamento libera a reserva.
alter table public.orders add column if not exists stock_reserved_at timestamptz;

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
 perform c.id from public.combos c where c.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo') order by c.id for update;
 perform p.id from public.products p where p.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where coalesce(x->>'kind','product')='product' union select ci.product_id from public.combo_items ci where ci.combo_id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo')) order by p.id for update;
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
 perform c.id from public.combos c where c.id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo') order by c.id for update;
 perform p.id from public.products p where p.id in(
  select (x->>'id')::uuid from jsonb_array_elements(p_items) x where coalesce(x->>'kind','product')='product'
  union select ci.product_id from public.combo_items ci where ci.combo_id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='combo')
 ) order by p.id for update;
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
 -- Reserva as unidades antes de expor o Pix. Confirmação posterior não baixa duas vezes.
 perform public.commit_order_stock(v_order.id);
 update public.orders set stock_reserved_at=now() where id=v_order.id returning * into v_order;
 return jsonb_build_object('created',true,'order',to_jsonb(v_order));
end $$;

create or replace function public.ops_expire_orders() returns integer language plpgsql security definer set search_path='' as $$
declare s public.store_ops_settings%rowtype;o record;n integer:=0;
begin
 delete from public.price_batches where status='draft' and created_at<now()-interval '7 days';
 select * into s from public.store_ops_settings where id for update;
 if not s.auto_close_enabled or s.enabled_at is null or not public.is_store_admin(s.enabled_by) then return 0;end if;
 for o in select ord.* from public.orders ord where ord.status='awaiting_payment' and ord.proof_path is null and ord.proof_uploaded_at is null and ord.paid_at is null and (ord.stock_deducted_at is null or ord.stock_reserved_at is not null)
 and greatest(ord.created_at,ord.updated_at,s.enabled_at)<now()-make_interval(hours=>s.auto_close_hours)
 and not exists(select 1 from public.order_messages m where m.order_id=ord.id and (m.attachment_path is not null or m.created_at>now()-make_interval(hours=>s.auto_close_hours)))
 and not exists(select 1 from public.admin_work_items w where w.order_id=ord.id and w.updated_at>now()-make_interval(hours=>s.auto_close_hours))
 order by ord.id limit 200 for update of ord skip locked loop
  perform public.transition_store_order(o.id,s.enabled_by,'cancelled','awaiting_payment','');
  insert into public.order_admin_events(order_id,admin_id,action,details) values(o.id,s.enabled_by,'auto:unpaid_closed',jsonb_build_object('hours',s.auto_close_hours));
  insert into public.notifications(user_id,title,body,link) values(o.user_id,'Pedido encerrado sem comprovante','O pedido '||o.order_code||' foi encerrado após o período sem comprovante. Se você realizou o Pix, fale com o suporte.','/pedidos/'||o.id::text);
  n:=n+1;
 end loop;
 update public.store_ops_settings set last_run_at=now(),last_run_count=n where id;
 delete from public.price_batches where status='draft' and created_at<now()-interval '7 days';
 return n;
end $$;

revoke all on function public.create_store_order(uuid,uuid,text,text,text,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.create_store_order(uuid,uuid,text,text,text,jsonb,numeric) to service_role;
