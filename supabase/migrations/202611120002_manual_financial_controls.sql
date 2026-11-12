-- Pix permanece manual. Nenhuma integração bancária, cobrança ou devolução é executada.
-- Sem backfill: confirmações anteriores continuam preservadas nos pedidos/eventos existentes.
create table if not exists public.order_payment_confirmations (
 order_id uuid primary key references public.orders(id) on delete restrict,
 bank_reference text not null unique check(bank_reference ~ '^[A-Z0-9-]{8,80}$'),
 amount numeric(12,2) not null check(amount>0),
 verified_by uuid not null references public.profiles(id) on delete restrict,
 exception_reason text,
 created_at timestamptz not null default now()
);
create table if not exists public.order_refunds (
 id uuid primary key,
 order_id uuid not null references public.orders(id) on delete restrict,
 amount numeric(12,2) not null check(amount>0),
 bank_reference text not null unique check(bank_reference ~ '^[A-Z0-9-]{8,80}$'),
 reason text not null check(char_length(trim(reason)) between 5 and 300),
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index if not exists order_refunds_order_idx on public.order_refunds(order_id);
alter table public.order_payment_confirmations enable row level security;
alter table public.order_refunds enable row level security;
revoke all on public.order_payment_confirmations,public.order_refunds from public,anon,authenticated;
grant select on public.order_payment_confirmations,public.order_refunds to service_role;
grant select(id,order_id,amount,created_at) on public.order_refunds to authenticated;
create policy "Cliente consulta valores devolvidos" on public.order_refunds for select to authenticated
 using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_admin())));

create or replace function public.guard_manual_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' and old.status is distinct from 'paid' and not exists(
  select 1 from public.order_payment_confirmations p where p.order_id=new.id and p.amount=new.total
 ) then raise exception 'Registre a conferência do extrato bancário antes de confirmar o Pix.'; end if;
 return new;
end $$;
revoke all on function public.guard_manual_payment() from public,anon,authenticated;
drop trigger if exists store_manual_payment_guard on public.orders;
create trigger store_manual_payment_guard before update of status on public.orders for each row execute function public.guard_manual_payment();

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
declare o public.orders%rowtype; r public.order_refunds%rowtype; total_refunded numeric;
 ref text:=upper(trim(coalesce(p_bank_reference,'')));
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 if p_bank_verified is distinct from true then raise exception 'Registre somente uma devolução já realizada e conferida no banco.'; end if;
 if p_token is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or ref !~ '^[A-Z0-9-]{8,80}$' or char_length(trim(coalesce(p_reason,''))) not between 5 and 300 then raise exception 'Confira o valor, a referência bancária e o motivo do reembolso.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.paid_at is null then raise exception 'Não há pagamento confirmado neste pedido.'; end if;
 select * into r from public.order_refunds where id=p_token;
 if found then
  if r.order_id<>p_order_id or r.amount<>p_amount or r.bank_reference<>ref then raise exception 'Esta operação já foi usada com outros dados.'; end if;
  return r.id;
 end if;
 select coalesce(sum(amount),0) into total_refunded from public.order_refunds where order_id=p_order_id;
 if total_refunded+p_amount>o.total then raise exception 'O reembolso supera o saldo pago ainda não devolvido.'; end if;
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
