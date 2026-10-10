-- Cosmic Store: use the existing product quantity table for NEW account orders.
-- Apply once after 202610100001. Existing prices, policies, Pix and Quick Buy stay unchanged.
begin;

-- Explicitly identify the rule of every historical snapshot without repricing it.
alter table public.robux_account_orders
 add column pricing_rule text not null default 'proportional_v1'
 constraint robux_account_pricing_rule_check
 check(pricing_rule in ('proportional_v1','product_table_v1'));
alter table public.robux_account_orders alter column pricing_rule set default 'product_table_v1';
comment on column public.robux_account_orders.pricing_rule is
 'Immutable pricing rule snapshot. proportional_v1 preserves orders made before the quantity table.';

-- Pure price helper, using exact integer-cent ratios; one rounding at the end.
-- K is the base rate, NOT an effective per-1K rate for quantities below 1,000.
create function public.robux_account_table_price(p_robux integer,p_base_k numeric)
returns numeric language plpgsql immutable strict set search_path='' as $$
declare v_n numeric; v_d numeric; v_cents numeric;
begin
 if p_robux not between 1 and 10000000 or p_base_k not between 0.01 and 20000
 then raise exception 'Quantidade ou cotação inválida.'; end if;
 v_cents:=round(p_base_k*100);
 if p_robux<=350 then v_n:=p_robux::numeric*1500; v_d:=350;
 elsif p_robux<=450 then v_n:=1500+(p_robux-350)::numeric*2; v_d:=1;
 elsif p_robux<1000 then v_n:=1700*(p_robux+100)::numeric; v_d:=550;
 else v_n:=p_robux::numeric*3400; v_d:=1000;
 end if;
 return floor((2*v_n*v_cents+v_d*3400)/(2*v_d*3400))/100;
end $$;
revoke all on function public.robux_account_table_price(integer,numeric)
 from public,anon,authenticated,service_role;

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
 v_total:=public.robux_account_table_price((p_offer->>'robux')::integer,v_k);
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
 insert into public.robux_account_orders(order_id,offer_id,provider_id,masked_id,robux,quote_id,quote_url,supplier_k,supplier_cost,margin_per_thousand,min_cosmic_k,cosmic_k,sale_price,snapshot_at,last_validated_at,pricing_rule)
 values(v_order.id,p_offer->>'id',p_offer->>'providerId',p_offer->>'maskedId',(p_offer->>'robux')::integer,p_offer->>'quoteId',p_offer->>'quoteUrl',(p_offer->>'supplierK')::numeric,(p_offer->>'supplierPrice')::numeric,v_margin,v_minimum,v_k,v_total,v_at,v_at,'product_table_v1');
 insert into public.robux_account_order_details(order_id,robux,cosmic_k,sale_price) values(v_order.id,(p_offer->>'robux')::integer,v_k,v_total);
 return jsonb_build_object('created',true,'order',jsonb_build_object('id',v_order.id,'order_code',v_order.order_code,'total',v_order.total));
end $$;
-- Preserve the mandatory policy wrapper and existing row-level protections.
revoke all on function public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric)
 from public,anon,authenticated,service_role;
commit;
