-- Read-only installation verification. Never prints supplier snapshots or credentials.
with expected(name) as (values
 ('robux_account_settings'),('robux_account_catalog'),('robux_account_orders'),
 ('robux_account_order_details'),('robux_account_request_limits'),('robux_account_offer_checks'))
select e.name, c.oid is not null as exists, c.relrowsecurity as rls_enabled
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name);

select tablename,policyname,roles,cmd from pg_policies
where schemaname='public' and tablename like 'robux_account_%' order by tablename;
-- Only service_role may execute these RPCs.
select p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as customer_can_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('create_robux_account_order','robux_account_claim_sync','robux_account_take_limit','mark_robux_account_acquired');
-- Expected false for all anon privileges.
select t,has_table_privilege('anon','public.'||t,'SELECT') as anon_can_read
from (values ('robux_account_settings'),('robux_account_catalog'),('robux_account_orders'),('robux_account_order_details'),('robux_account_request_limits'),('robux_account_offer_checks')) v(t);
-- Customer-safe table must contain exactly these public fields, no supplier data.
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='robux_account_order_details' order by ordinal_position;
select tgname from pg_trigger where not tgisinternal and tgname in('guard_robux_account_order','guard_robux_account_snapshot');
select conname,pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid='public.orders'::regclass and conname='orders_order_type_check';
select enabled, margin_per_thousand from public.robux_account_settings where id=1;
select last_complete_at,last_success_at,last_attempt_at,next_attempt_at,last_error,
 jsonb_array_length(quotes) as quotes_found,jsonb_array_length(offers) as accounts_found
from public.robux_account_catalog where id=1;
