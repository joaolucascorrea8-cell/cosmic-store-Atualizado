-- Fila persistente somente para novos eventos; nenhum e-mail histórico é enfileirado.
create table if not exists public.order_email_jobs (
 order_id uuid not null references public.orders(id) on delete restrict,
 kind text not null check(kind in('payment','delivery')),
 status text not null default 'queued' check(status in('queued','processing','failed','uncertain','sent')),
 attempts integer not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 error_message text,
 updated_at timestamptz not null default now(),
 primary key(order_id,kind)
);
alter table public.order_email_jobs enable row level security;
revoke all on public.order_email_jobs from public,anon,authenticated;
grant select on public.order_email_jobs to service_role;

create or replace function public.enqueue_order_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status in('paid','delivered') then
  insert into public.order_email_jobs(order_id,kind) values(new.id,case when new.status='paid' then 'payment' else 'delivery' end) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.enqueue_order_email() from public,anon,authenticated;
drop trigger if exists store_enqueue_email on public.orders;
create trigger store_enqueue_email after update of status on public.orders for each row execute function public.enqueue_order_email();

create or replace function public.claim_order_email(p_order_id uuid,p_kind text,p_manual_retry boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;j public.order_email_jobs%rowtype;t uuid;
begin
 select * into o from public.orders where id=p_order_id;
 if not found or p_kind not in('payment','delivery') then raise exception 'E-mail inválido.'; end if;
 if (p_kind='payment' and (o.status not in('paid','preparing_delivery','delivered') or o.payment_email_sent_at is not null))
 or (p_kind='delivery' and (o.status<>'delivered' or o.delivery_email_sent_at is not null)) then return null; end if;
 insert into public.order_email_jobs(order_id,kind) values(p_order_id,p_kind) on conflict do nothing;
 select * into j from public.order_email_jobs where order_id=p_order_id and kind=p_kind for update;
 if j.status='sent' or (j.status='processing' and j.lease_until>now()) then return null; end if;
 if j.status='processing' and not p_manual_retry then
  update public.order_email_jobs set status='uncertain',error_message='Execução interrompida. Confira o provedor antes de reenviar.',updated_at=now() where order_id=p_order_id and kind=p_kind;
  return null;
 end if;
 if (j.status='uncertain' or j.attempts>=5 or j.next_attempt_at>now()) and not p_manual_retry then return null; end if;
 t:=gen_random_uuid();
 update public.order_email_jobs set status='processing',attempts=attempts+1,lease_token=t,lease_until=now()+interval '10 minutes',error_message=null,updated_at=now()
 where order_id=p_order_id and kind=p_kind;
 return t;
end $$;
revoke all on function public.claim_order_email(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_order_email(uuid,text,boolean) to service_role;

create or replace function public.finish_order_email(p_order_id uuid,p_kind text,p_token uuid,p_status text,p_error text default '')
returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_status not in('sent','failed','uncertain') then raise exception 'Resultado de e-mail inválido.'; end if;
 -- Mesmo lock order de transition_store_order -> enqueue: pedido antes do job.
 perform id from public.orders where id=p_order_id for update;
 update public.order_email_jobs set status=p_status,lease_until=null,
  next_attempt_at=now()+interval '15 minutes',error_message=nullif(left(p_error,500),''),updated_at=now()
 where order_id=p_order_id and kind=p_kind and lease_token=p_token and status='processing';
 get diagnostics n=row_count;
 if n<>1 then raise exception 'A execução do e-mail mudou. Confira o histórico antes de reenviar.'; end if;
 if p_status='sent' then
  if p_kind='payment' then update public.orders set payment_email_sent_at=coalesce(payment_email_sent_at,now()) where id=p_order_id;
  else update public.orders set delivery_email_sent_at=coalesce(delivery_email_sent_at,now()) where id=p_order_id; end if;
 end if;
end $$;
revoke all on function public.finish_order_email(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_order_email(uuid,text,uuid,text,text) to service_role;
