-- Inspeção APÓS aplicar as migrations em homologação autorizada.
-- Somente leitura: sem nomes, e-mails, referências bancárias, anexos ou credenciais.
begin read only;
select count(*) as historical_unpaid_without_reservation
from public.orders where order_type='store' and status in('awaiting_payment','proof_rejected','proof_submitted','under_review')
 and stock_reserved_at is null and stock_deducted_at is null;
select status,count(*) from public.orders group by status order by status;
select count(*) as cancelled_paid_with_refund_balance
from public.orders o where status='cancelled'
 and (case when paid_at is not null then total else 0 end)+(select coalesce(sum(amount),0) from public.order_additional_payments where order_id=o.id and not used_for_confirmation)
 >(select coalesce(sum(amount),0) from public.order_refunds where order_id=o.id);
select status,count(*) from public.order_email_jobs group by status order by status;
select supplier_status,count(*) from public.robux_orders
where supplier_status in('SUBMITTING','PENDING','FAILED') group by supplier_status;
select auto_close_enabled,auto_close_hours,last_run_at from public.store_ops_settings;
select p.proname,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as customer_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('confirm_manual_store_payment','record_manual_store_refund','record_additional_store_payment','store_financial_summary','claim_gamepass_execution','finish_gamepass_execution','claim_order_email','finish_order_email');
select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relname in('admins','orders','order_items','order_payment_confirmations','order_additional_payments','order_refunds','order_email_jobs');
select has_table_privilege('authenticated','public.admins','INSERT,UPDATE,DELETE,TRUNCATE') as customer_can_change_admins;
select public.store_checkout_capabilities();
rollback;
