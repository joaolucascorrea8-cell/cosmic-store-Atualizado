-- Apenas Game Pass. Não reativa contas/Robux instantâneos.
alter table public.robux_orders add column if not exists execution_lease_until timestamptz;
alter table public.robux_orders drop constraint if exists robux_orders_supplier_status_check;
alter table public.robux_orders add constraint robux_orders_supplier_status_check
 check(supplier_status in('NOT_STARTED','SUBMITTING','PENDING','COMPLETED','CANCELLED','FAILED'));

create or replace function public.guard_gamepass_transition() returns trigger
language plpgsql security definer set search_path='' as $$
declare s text;
begin
 if new.order_type<>'robux' or new.status is not distinct from old.status then return new; end if;
 select supplier_status into s from public.robux_orders where order_id=new.id;
 if new.status='cancelled' and s in('SUBMITTING','PENDING','COMPLETED') then
  raise exception 'Reconcilie a compra do GamePass antes de cancelar: ela pode estar em processamento ou concluída.';
 end if;
 if new.status='delivered' and s is distinct from 'COMPLETED' then raise exception 'O fornecedor ainda não confirmou a compra do GamePass.'; end if;
 return new;
end $$;
revoke all on function public.guard_gamepass_transition() from public,anon,authenticated;
drop trigger if exists store_gamepass_transition_guard on public.orders;
create trigger store_gamepass_transition_guard before update of status on public.orders for each row execute function public.guard_gamepass_transition();

create or replace function public.claim_gamepass_execution(p_order_id uuid,p_admin_id uuid,p_expected_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; r public.robux_orders%rowtype;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.order_type<>'robux' or o.status not in('paid','preparing_delivery') then raise exception 'Confirme o pagamento antes de comprar o GamePass.'; end if;
 select * into r from public.robux_orders where order_id=p_order_id for update;
 if not found then raise exception 'Detalhes do GamePass ausentes.'; end if;
 if r.supplier_request_id is distinct from p_expected_request then raise exception 'Outro administrador iniciou uma tentativa. Atualize a página.'; end if;
 if r.supplier_status in('PENDING','COMPLETED') then raise exception 'Este GamePass já está em processamento ou foi comprado.'; end if;
 if r.supplier_status='SUBMITTING' and r.execution_lease_until>now() then raise exception 'Uma tentativa já está em andamento. Aguarde dois minutos antes de recuperar o envio.'; end if;
 if r.supplier_status='CANCELLED' then
  insert into public.order_admin_events(order_id,admin_id,action,details)
  values(p_order_id,p_admin_id,'gamepass:retry_cancelled',jsonb_build_object('previous_request_id',r.supplier_request_id,'previous_batch_id',r.supplier_batch_id));
  r.supplier_request_id:=gen_random_uuid();
 end if;
 update public.robux_orders set supplier_request_id=r.supplier_request_id,supplier_status='SUBMITTING',
  supplier_batch_id=null,supplier_order_id=null,completed_at=null,
  execution_lease_until=now()+interval '2 minutes',executed_by=p_admin_id,executed_at=now(),
  supplier_error_code=null,supplier_error_message=null
 where order_id=p_order_id returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.claim_gamepass_execution(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_gamepass_execution(uuid,uuid,uuid) to service_role;

create or replace function public.finish_gamepass_execution(p_order_id uuid,p_admin_id uuid,p_request uuid,p_batch text,p_rate numeric,p_cost numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; r public.robux_orders%rowtype; result jsonb;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 select * into r from public.robux_orders where order_id=p_order_id for update;
 if r.supplier_request_id is distinct from p_request or o.status not in('paid','preparing_delivery') then raise exception 'A tentativa mudou. Reconcilie o pedido antes de continuar.'; end if;
 if r.supplier_status='PENDING' and r.supplier_batch_id=p_batch then return jsonb_build_object('changed',false); end if;
 if r.supplier_status<>'SUBMITTING' or char_length(trim(coalesce(p_batch,''))) not between 1 and 200 or p_rate is null or p_rate<=0 or p_cost is null or p_cost<0 then raise exception 'Resposta inválida da compra do GamePass.'; end if;
 update public.robux_orders set supplier_batch_id=p_batch,supplier_status='PENDING',execution_lease_until=null,
  supplier_rate_at_execute=p_rate,supplier_cost_at_execute=p_cost,last_checked_at=now(),supplier_error_code=null,supplier_error_message=null
 where order_id=p_order_id;
 if o.status='paid' then result:=public.transition_store_order(p_order_id,p_admin_id,'preparing_delivery','paid','');
 else result:=jsonb_build_object('changed',false); end if;
 return result;
end $$;
revoke all on function public.finish_gamepass_execution(uuid,uuid,uuid,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.finish_gamepass_execution(uuid,uuid,uuid,text,numeric,numeric) to service_role;
