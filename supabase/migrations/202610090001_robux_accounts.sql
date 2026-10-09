-- Additive account catalog integration. Quick Buy functions/tables remain unchanged.
begin;
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add constraint orders_order_type_check check(order_type in ('store','robux','robux_account'));
create table public.robux_account_settings(
 id smallint primary key default 1 check(id=1), enabled boolean not null default true,
 margin_per_thousand numeric(10,2) not null default 9 check(margin_per_thousand between 0 and 10000),
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
insert into public.robux_account_settings(id) values(1);
create table public.robux_account_catalog(
 id smallint primary key default 1 check(id=1), quotes jsonb not null default '[]', offers jsonb not null default '[]',
 diagnostics jsonb not null default '[]', last_complete_at timestamptz, last_success_at timestamptz, last_attempt_at timestamptz,
 last_error text, next_attempt_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz
);
insert into public.robux_account_catalog(id) values(1);
create table public.robux_account_orders(
 order_id uuid primary key references public.orders(id) on delete cascade,
 offer_id text not null check(offer_id ~ '^[a-f0-9]{64}$'), provider_id text not null,
 masked_id text not null, robux integer not null check(robux between 1 and 10000000),
 quote_id text not null, quote_url text not null check(quote_url ~ '^https://www\.byrobux\.net/accounts/[A-Za-z0-9_-]+(\?catalog=[A-Za-z0-9_-]+)?$'),
 supplier_k numeric(10,2) not null check(supplier_k>0), supplier_cost numeric(12,2) not null check(supplier_cost>0),
 margin_per_thousand numeric(10,2) not null check(margin_per_thousand>=0), cosmic_k numeric(10,2) not null check(cosmic_k>0),
 sale_price numeric(12,2) not null check(sale_price>0), snapshot_at timestamptz not null,
 last_supplier_k numeric(10,2), last_supplier_cost numeric(12,2), last_validation_error text,
 last_validated_at timestamptz not null, availability text not null default 'available' check(availability in ('available','unavailable','unknown')),
 acquired_at timestamptz, acquired_by uuid references public.profiles(id),
 reservation_until timestamptz not null default now()+interval '20 minutes'
);
create index robux_account_orders_offer_idx on public.robux_account_orders(provider_id);
-- Physically separate public-safe fields from the administrative snapshot.
create table public.robux_account_order_details(
 order_id uuid primary key references public.orders(id) on delete cascade,
 robux integer not null, cosmic_k numeric(10,2) not null, sale_price numeric(12,2) not null,
 fulfillment_status text not null default 'awaiting_payment' check(fulfillment_status in ('awaiting_payment','awaiting_acquisition','acquired','review','delivered'))
);
create table public.robux_account_offer_checks(
 offer_id text primary key check(offer_id ~ '^[a-f0-9]{64}$'), available boolean not null, checked_at timestamptz not null
);
create table public.robux_account_request_limits(
 key text primary key, allowed_at timestamptz not null
);
create function public.robux_account_take_limit(p_key text,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_key text;
begin
 delete from public.robux_account_request_limits where allowed_at < now()-interval '1 day';
 insert into public.robux_account_request_limits(key,allowed_at) values(p_key,now()+make_interval(secs=>greatest(1,least(60,p_seconds))))
 on conflict(key) do update set allowed_at=excluded.allowed_at where public.robux_account_request_limits.allowed_at<=now()
 returning key into v_key;
 return v_key is not null;
end $$;
create function public.robux_account_claim_sync(p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.robux_account_catalog set lease_token=p_token,lease_until=now()+interval '10 minutes',last_attempt_at=now(),next_attempt_at=now()+interval '90 seconds'
 where id=1 and next_attempt_at<=now() and (lease_until is null or lease_until<now());
 return found;
end $$;
create function public.create_robux_account_order(p_user_id uuid,p_token uuid,p_code text,p_pix text,p_offer jsonb,p_expected numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_margin numeric; v_k numeric; v_total numeric; v_existing public.robux_account_orders%rowtype; v_at timestamptz;
begin
 if p_user_id is null or p_token is null then raise exception 'Sessão inválida.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||p_token::text,19));
 select * into v_order from public.orders where user_id=p_user_id and checkout_token=p_token;
 if found then
  if v_order.order_type<>'robux_account' or not exists(select 1 from public.robux_account_orders where order_id=v_order.id and offer_id=p_offer->>'id') then raise exception 'Sessão pertence a outro pedido.'; end if;
  return jsonb_build_object('created',false,'order',jsonb_build_object('id',v_order.id,'order_code',v_order.order_code,'total',v_order.total));
 end if;
 select margin_per_thousand into v_margin from public.robux_account_settings where id=1 and enabled for share;
 if not found then raise exception 'As compras de contas estão pausadas.'; end if;
 v_at:=(p_offer->>'seenAt')::timestamptz;
 if v_at is null or v_at<now()-interval '60 seconds' or v_at>now()+interval '5 seconds' then raise exception 'Valide a disponibilidade novamente.'; end if;
 if (p_offer->>'robux')::integer not between 1 and 10000000 or (p_offer->>'supplierK')::numeric<=0 or (p_offer->>'supplierPrice')::numeric<=0 or char_length(p_pix)<20 then raise exception 'Oferta inválida.'; end if;
 v_k:=round((p_offer->>'supplierK')::numeric,2)+v_margin;
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
 insert into public.robux_account_orders(order_id,offer_id,provider_id,masked_id,robux,quote_id,quote_url,supplier_k,supplier_cost,margin_per_thousand,cosmic_k,sale_price,snapshot_at,last_validated_at)
 values(v_order.id,p_offer->>'id',p_offer->>'providerId',p_offer->>'maskedId',(p_offer->>'robux')::integer,p_offer->>'quoteId',p_offer->>'quoteUrl',(p_offer->>'supplierK')::numeric,(p_offer->>'supplierPrice')::numeric,v_margin,v_k,v_total,v_at,v_at);
 insert into public.robux_account_order_details(order_id,robux,cosmic_k,sale_price) values(v_order.id,(p_offer->>'robux')::integer,v_k,v_total);
 return jsonb_build_object('created',true,'order',jsonb_build_object('id',v_order.id,'order_code',v_order.order_code,'total',v_order.total));
end $$;
-- Keeps the original transition function; guards only the new order type.
create function public.guard_robux_account_order() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.robux_account_orders%rowtype;
begin
 if new.order_type<>'robux_account' or new.status=old.status then return new; end if;
 select * into a from public.robux_account_orders where order_id=new.id for update;
 if not found then raise exception 'Snapshot da conta ausente.'; end if;
 if new.status='proof_submitted' and old.status='awaiting_payment' and a.reservation_until<now() then raise exception 'A reserva expirou. Fale com o suporte antes de enviar o comprovante.'; end if;
 if new.status in ('paid','preparing_delivery') and a.acquired_at is null and (a.availability<>'available' or a.last_validated_at<now()-interval '60 seconds') then raise exception 'Revalide a conta antes de confirmar esta etapa.'; end if;
 if new.status='delivered' and a.acquired_at is null then raise exception 'Registre a aquisição manual da conta antes de entregar.'; end if;
 update public.robux_account_order_details set fulfillment_status=case when new.status='delivered' then 'delivered' when a.acquired_at is not null then 'acquired' when new.status in ('paid','preparing_delivery') then 'awaiting_acquisition' else fulfillment_status end where order_id=new.id;
 return new;
end $$;
create trigger guard_robux_account_order before update of status on public.orders for each row execute function public.guard_robux_account_order();
create function public.guard_robux_account_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['last_validated_at','availability','acquired_at','acquired_by','last_supplier_k','last_supplier_cost','last_validation_error']) is distinct from (to_jsonb(old)-array['last_validated_at','availability','acquired_at','acquired_by','last_supplier_k','last_supplier_cost','last_validation_error']) then raise exception 'O snapshot original não pode ser alterado.'; end if;
 if old.acquired_at is not null and (new.acquired_at is distinct from old.acquired_at or new.acquired_by is distinct from old.acquired_by) then raise exception 'A aquisição registrada não pode ser desfeita.'; end if;
 return new;
end $$;
create trigger guard_robux_account_snapshot before update on public.robux_account_orders for each row execute function public.guard_robux_account_snapshot();
-- Internal tables: admin read only, service writes only. No customer policy.
alter table public.robux_account_settings enable row level security;
alter table public.robux_account_catalog enable row level security;
alter table public.robux_account_orders enable row level security;
alter table public.robux_account_order_details enable row level security;
alter table public.robux_account_request_limits enable row level security;
alter table public.robux_account_offer_checks enable row level security;
revoke all on public.robux_account_settings,public.robux_account_catalog,public.robux_account_orders,public.robux_account_order_details,public.robux_account_request_limits,public.robux_account_offer_checks from public,anon,authenticated;
grant select on public.robux_account_settings,public.robux_account_catalog,public.robux_account_orders,public.robux_account_order_details to authenticated;
grant all on public.robux_account_settings,public.robux_account_catalog,public.robux_account_orders,public.robux_account_order_details,public.robux_account_request_limits,public.robux_account_offer_checks to service_role;
create policy "Admin account settings" on public.robux_account_settings for select to authenticated using(public.is_store_admin());
create policy "Admin account catalog" on public.robux_account_catalog for select to authenticated using(public.is_store_admin());
create policy "Admin account snapshots" on public.robux_account_orders for select to authenticated using(public.is_store_admin());
create policy "Owner safe account details" on public.robux_account_order_details for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and(o.user_id=auth.uid() or public.is_store_admin())));
revoke all on function public.robux_account_take_limit(text,integer),public.robux_account_claim_sync(uuid),public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric),public.guard_robux_account_order(),public.guard_robux_account_snapshot() from public,anon,authenticated;
grant execute on function public.robux_account_take_limit(text,integer),public.robux_account_claim_sync(uuid),public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric) to service_role;
create function public.mark_robux_account_acquired(p_order_id uuid,p_admin_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso negado.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.order_type<>'robux_account' or o.status not in ('paid','preparing_delivery') then raise exception 'Confirme o pagamento antes de registrar a aquisição.'; end if;
 update public.robux_account_orders set acquired_at=now(),acquired_by=p_admin_id where order_id=p_order_id and acquired_at is null;
 if not found then return; end if;
 update public.robux_account_order_details set fulfillment_status='acquired' where order_id=p_order_id;
 insert into public.order_admin_events(order_id,admin_id,action,details) values(p_order_id,p_admin_id,'account:manual_acquisition',jsonb_build_object('manual',true));
end $$;
revoke all on function public.mark_robux_account_acquired(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_robux_account_acquired(uuid,uuid) to service_role;
commit;
