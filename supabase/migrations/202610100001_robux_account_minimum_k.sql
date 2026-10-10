-- Account pricing only: K Cosmic = greatest(minimum K, supplier K + markup).
-- Apply once, after 202610090002. Existing orders and Quick Buy remain unchanged.
begin;
alter table public.robux_account_settings
 add column min_cosmic_k numeric(10,2) not null default 34
 constraint robux_account_settings_min_k_check check(min_cosmic_k between 0 and 10000),
 alter column margin_per_thousand set default 5;

-- The merchant explicitly chose minimum 34 and markup 5 for this migration.
-- Do not rerun this migration after editing the settings in Admin.
update public.robux_account_settings
 set min_cosmic_k=34,margin_per_thousand=5,updated_at=now()
 where id=1;

-- NULL identifies old orders priced before this feature. Never invent or
-- backfill a historical minimum. The existing snapshot trigger protects this
-- new column as well, since only operational fields are allowed to change.
alter table public.robux_account_orders
 add column min_cosmic_k numeric(10,2)
 constraint robux_account_orders_min_k_check check(min_cosmic_k between 0 and 10000);
comment on column public.robux_account_orders.min_cosmic_k is
 'Minimum K used at order creation; NULL for orders predating minimum pricing.';

create or replace function public.create_robux_account_order(p_user_id uuid,p_token uuid,p_code text,p_pix text,p_offer jsonb,p_expected numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_margin numeric; v_minimum numeric; v_k numeric; v_total numeric; v_existing public.robux_account_orders%rowtype; v_at timestamptz;
begin
 if p_user_id is null or p_token is null then raise exception 'Sessão inválida.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_token::text,19));
 select * into v_order from public.orders where user_id=p_user_id and checkout_token=p_token;
 if found then
  if v_order.order_type<>'robux_account' or not exists(select 1 from public.robux_account_orders where order_id=v_order.id and offer_id=p_offer->>'id') then raise exception 'Sessão pertence a outro pedido.'; end if;
  return jsonb_build_object('created',false,'order',jsonb_build_object('id',v_order.id,'order_code',v_order.order_code,'total',v_order.total));
 end if;
 select margin_per_thousand,min_cosmic_k into v_margin,v_minimum from public.robux_account_settings where id=1 and enabled for share;
 if not found then raise exception 'As compras de contas estão pausadas.'; end if;
 v_at:=(p_offer->>'seenAt')::timestamptz;
 if v_at is null or v_at<now()-interval '60 seconds' or v_at>now()+interval '5 seconds' then raise exception 'Valide a disponibilidade novamente.'; end if;
 if (p_offer->>'robux')::integer not between 1 and 10000000 or (p_offer->>'supplierK')::numeric<=0 or (p_offer->>'supplierPrice')::numeric<=0 or char_length(p_pix)<20 then raise exception 'Oferta inválida.'; end if;
 v_k:=greatest(v_minimum,round((p_offer->>'supplierK')::numeric,2)+v_margin);
 v_total:=round((p_offer->>'robux')::numeric/1000*v_k,2);
 if p_expected is null or p_expected<>v_total then raise exception 'O preço mudou. Confira o catálogo novamente.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_offer->>'providerId',23));
 for v_existing in select a.* from public.robux_account_orders a join public.orders o on o.id=a.order_id where a.provider_id=p_offer->>'providerId' and (o.status<>'cancelled' or a.acquired_at is not null) and not (a.provider_id like 'fourth:%' and o.status='delivered') for update of a,o loop
  if v_existing.acquired_at is not null then raise exception 'Esta oferta não está mais disponível.'; end if;
  select * into v_order from public.orders where id=v_existing.order_id;
  if v_order.status='awaiting_payment' and v_existing.reservation_until<now() then
   update public.orders set status='cancelled' where id=v_order.id;
  else raise exception 'Esta conta está em outro pedido. Escolha outra oferta.';
  end if;
 end loop;
 insert into public.orders(order_code,user_id,status,game_nickname,total,pix_payload,checkout_token,subtotal,discount_total,order_type)
 values(p_code,p_user_id,'awaiting_payment','Conta com Robux',v_total,p_pix,p_token,v_total,0,'robux_account') returning * into v_order;
 insert into public.order_items(order_id,product_name,unit_price,quantity)
 values(v_order.id,'Conta com '||(p_offer->>'robux')||' Robux',v_total,1);
 insert into public.robux_account_orders(order_id,offer_id,provider_id,masked_id,robux,quote_id,quote_url,supplier_k,supplier_cost,margin_per_thousand,min_cosmic_k,cosmic_k,sale_price,snapshot_at,last_validated_at)
 values(v_order.id,p_offer->>'id',p_offer->>'providerId',p_offer->>'maskedId',(p_offer->>'robux')::integer,p_offer->>'quoteId',p_offer->>'quoteUrl',(p_offer->>'supplierK')::numeric,(p_offer->>'supplierPrice')::numeric,v_margin,v_minimum,v_k,v_total,v_at,v_at);
 insert into public.robux_account_order_details(order_id,robux,cosmic_k,sale_price) values(v_order.id,(p_offer->>'robux')::integer,v_k,v_total);
 return jsonb_build_object('created',true,'order',jsonb_build_object('id',v_order.id,'order_code',v_order.order_code,'total',v_order.total));
end $$;
-- Keep policy acceptance mandatory. Only the owner-run policy wrapper may
-- call this internal function; service_role must not call it directly.
revoke all on function public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric)
 from public,anon,authenticated,service_role;
commit;
