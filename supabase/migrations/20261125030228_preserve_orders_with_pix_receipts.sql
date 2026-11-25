-- Um recebimento excepcional exige conferência manual antes de liberar a reserva.
create or replace function public.ops_expire_orders() returns integer language plpgsql security definer set search_path='' as $$
declare s public.store_ops_settings%rowtype;o record;n integer:=0;
begin
 delete from public.price_batches where status='draft' and created_at<now()-interval '7 days';
 select * into s from public.store_ops_settings where id for update;
 if not s.auto_close_enabled or s.enabled_at is null or not public.is_store_admin(s.enabled_by) then return 0;end if;
 for o in select ord.* from public.orders ord where ord.status='awaiting_payment' and ord.proof_path is null and ord.proof_uploaded_at is null and ord.paid_at is null and (ord.stock_deducted_at is null or ord.stock_reserved_at is not null)
 and greatest(ord.created_at,ord.updated_at,s.enabled_at)<now()-make_interval(hours=>s.auto_close_hours)
 and not exists(select 1 from public.order_additional_payments receipt where receipt.order_id=ord.id)
 and not exists(select 1 from public.order_messages m where m.order_id=ord.id and (m.attachment_path is not null or m.created_at>now()-make_interval(hours=>s.auto_close_hours)))
 and not exists(select 1 from public.admin_work_items w where w.order_id=ord.id and w.updated_at>now()-make_interval(hours=>s.auto_close_hours))
 order by ord.id limit 200 for update of ord skip locked loop
  -- Quem registra um crédito também trava o pedido. Releia após obter a trava.
  if exists(select 1 from public.order_additional_payments receipt where receipt.order_id=o.id) then continue; end if;
  perform public.transition_store_order(o.id,s.enabled_by,'cancelled','awaiting_payment','');
  insert into public.order_admin_events(order_id,admin_id,action,details) values(o.id,s.enabled_by,'auto:unpaid_closed',jsonb_build_object('hours',s.auto_close_hours));
  insert into public.notifications(user_id,title,body,link) values(o.user_id,'Pedido encerrado sem comprovante','O pedido '||o.order_code||' foi encerrado após o período sem comprovante. Se você realizou o Pix, fale com o suporte.','/pedidos/'||o.id::text);
  n:=n+1;
 end loop;
 update public.store_ops_settings set last_run_at=now(),last_run_count=n where id;
 return n;
end $$;
