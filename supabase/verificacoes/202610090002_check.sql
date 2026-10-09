-- Read-only. No credentials, ciphertext, customer identities or private snapshots.
with expected(name) as (values ('robux_account_policy'),('robux_account_policy_acceptances'),('robux_account_deliveries'))
select e.name,c.oid is not null as exists,c.relrowsecurity as rls_enabled
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name);

-- Expected: false, false, true on every line.
select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') customer_can_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') server_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('save_robux_account_policy','create_robux_account_order_with_policy','save_robux_account_delivery');

-- Expected: false for direct credential access, including admins in the browser.
select has_table_privilege('anon','public.robux_account_deliveries','SELECT') anon_reads_credentials,
 has_table_privilege('authenticated','public.robux_account_deliveries','SELECT') browser_reads_credentials,
 has_function_privilege('service_role','public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric)','EXECUTE') legacy_checkout_access;

select version,updated_at,char_length(body) policy_characters from public.robux_account_policy where id=1;
select tgname from pg_trigger where not tgisinternal and tgname in('guard_account_policy_acceptance','guard_robux_account_credentials');
-- Only aggregate counts; legacy orders are allowed to have no consent record.
select (select count(*) from public.robux_account_deliveries) deliveries_saved,
 (select count(*) from public.robux_account_policy_acceptances) policies_read;
