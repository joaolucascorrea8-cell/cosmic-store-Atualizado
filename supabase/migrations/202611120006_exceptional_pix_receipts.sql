-- Recebimentos excepcionais: Pix tardio, divergente ou repetido. Apenas registros manuais.
-- Nenhum status de entrega, estoque ou pagamento anterior é reescrito.
-- PostgREST inclui id no ON CONFLICT de upsert. RLS exige que continue igual a auth.uid().
grant update(id) on public.profiles to authenticated;
create table if not exists public.order_additional_payments (
 id uuid primary key, order_id uuid not null references public.orders(id) on delete restrict,
 amount numeric(12,2) not null check(amount>0),
 bank_reference text not null unique check(bank_reference ~ '^[A-Z0-9-]{8,80}$'),
 reason text not null check(char_length(trim(reason)) between 5 and 300),
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 used_for_confirmation boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists additional_payments_order_idx on public.order_additional_payments(order_id);
alter table public.order_additional_payments enable row level security;
revoke all on public.order_additional_payments from public,anon,authenticated;
grant select on public.order_additional_payments to service_role;
grant select(id,order_id,amount,used_for_confirmation,created_at) on public.order_additional_payments to authenticated;
create policy "Cliente consulta recebimentos extras" on public.order_additional_payments for select to authenticated
 using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_admin())));

create or replace function public.record_additional_store_payment(
 p_order_id uuid,p_admin_id uuid,p_token uuid,p_amount numeric,p_bank_reference text,p_reason text,p_bank_verified boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.order_additional_payments%rowtype; ref text:=upper(trim(coalesce(p_bank_reference,'')));
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 if p_bank_verified is distinct from true or p_token is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2)
 or ref !~ '^[A-Z0-9-]{8,80}$' or char_length(trim(coalesce(p_reason,''))) not between 5 and 300 then raise exception 'Confira o recebimento no extrato, o valor, a referência e o motivo.'; end if;
 perform id from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 select * into r from public.order_additional_payments where id=p_token;
 if found then
  if r.order_id<>p_order_id or r.amount<>p_amount or r.bank_reference<>ref then raise exception 'Esta operação já foi usada com outros dados.'; end if;
  return r.id;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank:'||ref,0));
 if exists(select 1 from public.order_payment_confirmations where bank_reference=ref)
 or exists(select 1 from public.order_additional_payments where bank_reference=ref) then raise exception 'Esta transação bancária já foi registrada.'; end if;
 insert into public.order_additional_payments(id,order_id,amount,bank_reference,reason,recorded_by)
 values(p_token,p_order_id,p_amount,ref,trim(p_reason),p_admin_id);
 insert into public.order_admin_events(order_id,admin_id,action,details)
 values(p_order_id,p_admin_id,'finance:additional_received',jsonb_build_object('receipt_id',p_token,'amount',p_amount));
 return p_token;
end $$;
revoke all on function public.record_additional_store_payment(uuid,uuid,uuid,numeric,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_additional_store_payment(uuid,uuid,uuid,numeric,text,text,boolean) to service_role;

create or replace function public.confirm_manual_store_payment(
 p_order_id uuid,p_admin_id uuid,p_expected_status text,p_amount numeric,
 p_bank_reference text,p_bank_verified boolean,p_exception_reason text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; p public.order_payment_confirmations%rowtype;
 ref text:=upper(trim(coalesce(p_bank_reference,'')));
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 if p_bank_verified is distinct from true then raise exception 'Confira o recebimento diretamente no extrato bancário.'; end if;
 if ref !~ '^[A-Z0-9-]{8,80}$' then raise exception 'Informe a referência da transação no extrato (8 a 80 letras, números ou hífen).'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 if p_amount is null or p_amount<=0 or p_amount is distinct from o.total then raise exception 'O valor recebido deve ser igual ao total do pedido.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bank:'||ref,0));
 select * into p from public.order_payment_confirmations where order_id=p_order_id;
 if found then
  if p.bank_reference<>ref or p.amount<>p_amount then raise exception 'Este pedido já possui outra conferência registrada.'; end if;
  if o.status in('paid','preparing_delivery','delivered') then return jsonb_build_object('changed',false,'order',to_jsonb(o)); end if;
 end if;
 if o.status is distinct from p_expected_status then raise exception 'Outro administrador alterou este pedido. Atualize a página.'; end if;
 if o.status not in('awaiting_payment','proof_rejected','proof_submitted','under_review') then raise exception 'Este pedido não permite confirmar pagamento.'; end if;
 if o.proof_path is null and char_length(trim(coalesce(p_exception_reason,''))) not between 5 and 300 then
  raise exception 'Sem comprovante anexado, explique a confirmação excepcional após conferir o extrato (5 a 300 caracteres).';
 end if;
 if exists(select 1 from public.order_additional_payments a where a.bank_reference=ref and (a.order_id<>p_order_id or a.amount<>p_amount or a.used_for_confirmation)) then
  raise exception 'Esta transação já foi registrada em outro recebimento. Confira a conciliação.';
 end if;
 update public.order_additional_payments set used_for_confirmation=true where order_id=p_order_id and bank_reference=ref;
 if p_amount+(select coalesce(sum(amount),0) from public.order_additional_payments where order_id=p_order_id and not used_for_confirmation)
    -(select coalesce(sum(amount),0) from public.order_refunds where order_id=p_order_id)<o.total then
  raise exception 'O recebimento já foi devolvido e não pode confirmar uma nova entrega.';
 end if;
 begin
  insert into public.order_payment_confirmations(order_id,bank_reference,amount,verified_by,exception_reason)
  values(p_order_id,ref,p_amount,p_admin_id,nullif(trim(p_exception_reason),''));
 exception when unique_violation then raise exception 'Esta transação bancária já foi registrada. Confira os pedidos antes de continuar.';
 end;
 return public.transition_store_order(p_order_id,p_admin_id,'paid',p_expected_status,'');
end $$;
revoke all on function public.confirm_manual_store_payment(uuid,uuid,text,numeric,text,boolean,text) from public,anon,authenticated;
grant execute on function public.confirm_manual_store_payment(uuid,uuid,text,numeric,text,boolean,text) to service_role;

create or replace function public.record_manual_store_refund(
 p_order_id uuid,p_admin_id uuid,p_token uuid,p_amount numeric,p_bank_reference text,p_reason text,p_bank_verified boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; r public.order_refunds%rowtype; total_refunded numeric; received numeric;
 ref text:=upper(trim(coalesce(p_bank_reference,'')));
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 if p_bank_verified is distinct from true then raise exception 'Registre somente uma devolução já realizada e conferida no banco.'; end if;
 if p_token is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or ref !~ '^[A-Z0-9-]{8,80}$' or char_length(trim(coalesce(p_reason,''))) not between 5 and 300 then raise exception 'Confira o valor, a referência bancária e o motivo do reembolso.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 select (case when o.paid_at is not null then o.total else 0 end)+coalesce(sum(amount),0) into received from public.order_additional_payments where order_id=p_order_id and not used_for_confirmation;
 if received<=0 then raise exception 'Não há pagamento confirmado neste pedido.'; end if;
 select * into r from public.order_refunds where id=p_token;
 if found then
  if r.order_id<>p_order_id or r.amount<>p_amount or r.bank_reference<>ref then raise exception 'Esta operação já foi usada com outros dados.'; end if;
  return r.id;
 end if;
 select coalesce(sum(amount),0) into total_refunded from public.order_refunds where order_id=p_order_id;
 if total_refunded+p_amount>received then raise exception 'O reembolso supera o saldo pago ainda não devolvido.'; end if;
 begin
  insert into public.order_refunds(id,order_id,amount,bank_reference,reason,recorded_by)
  values(p_token,p_order_id,p_amount,ref,trim(p_reason),p_admin_id);
 exception when unique_violation then raise exception 'Esta devolução bancária já foi registrada.';
 end;
 insert into public.order_admin_events(order_id,admin_id,action,details)
 values(p_order_id,p_admin_id,'finance:refund_recorded',jsonb_build_object('refund_id',p_token,'amount',p_amount));
 return p_token;
end $$;
revoke all on function public.record_manual_store_refund(uuid,uuid,uuid,numeric,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_manual_store_refund(uuid,uuid,uuid,numeric,text,text,boolean) to service_role;

-- Movimentações registradas: cancelamento operacional nunca é tratado como devolução.
create or replace function public.store_financial_summary(p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare received numeric; refunded numeric;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '367 days' then raise exception 'Escolha um período de até 366 dias.'; end if;
 select coalesce(sum(o.total),0) into received from public.orders o
 where o.paid_at>=p_from and o.paid_at<p_to and not exists(
  select 1 from public.order_payment_confirmations p join public.order_additional_payments a on a.order_id=p.order_id and a.bank_reference=p.bank_reference and a.used_for_confirmation
  where p.order_id=o.id
 );
 received:=received+(select coalesce(sum(amount),0) from public.order_additional_payments where created_at>=p_from and created_at<p_to);
 select coalesce(sum(amount),0) into refunded from public.order_refunds where created_at>=p_from and created_at<p_to;
 return jsonb_build_object('received',received,'refunded',refunded,'net',received-refunded);
end $$;
revoke all on function public.store_financial_summary(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.store_financial_summary(timestamptz,timestamptz) to service_role;

-- Fail closed durante atualização coordenada: código novo não emite Pix no esquema antigo.
create or replace function public.store_checkout_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select not has_function_privilege('authenticated','public.confirm_manual_store_payment(uuid,uuid,text,numeric,text,boolean,text)','execute')
 and not has_column_privilege('authenticated','public.profiles','discord_id','select')
 and (select relrowsecurity from pg_class where oid='public.order_additional_payments'::regclass);
$$;
revoke all on function public.store_checkout_ready() from public,anon,authenticated;
grant execute on function public.store_checkout_ready() to service_role;
