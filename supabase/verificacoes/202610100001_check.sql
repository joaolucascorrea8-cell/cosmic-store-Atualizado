-- Read-only verification: run after 202610100001_robux_account_minimum_k.sql.
-- Expected initial minimum = 34, markup = 5, threshold = 29.
select min_cosmic_k as k_cosmic_minimo,
 margin_per_thousand as acrescimo_por_mil,
 min_cosmic_k-margin_per_thousand as limite_k_fornecedor,
 enabled as compras_habilitadas
from public.robux_account_settings where id=1;

select column_name,data_type,column_default,is_nullable
from information_schema.columns
where table_schema='public'
 and table_name in ('robux_account_settings','robux_account_orders')
 and column_name='min_cosmic_k';

-- Illustrative values calculated using the CURRENT settings.
select exemplo.k_fornecedor,
 greatest(s.min_cosmic_k,exemplo.k_fornecedor+s.margin_per_thousand) as k_cosmic,
 round(1.99*greatest(s.min_cosmic_k,exemplo.k_fornecedor+s.margin_per_thousand),2) as preco_1990_robux
from public.robux_account_settings s
cross join (values (25.00::numeric),(29.00),(29.01),(29.50),(30.00),(32.00)) exemplo(k_fornecedor)
where s.id=1 order by exemplo.k_fornecedor;

-- Expected: RLS true, anon false. Authenticated reads remain filtered by Admin RLS.
select c.relname,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_can_read
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('robux_account_settings','robux_account_orders');

-- Expected: only policy wrapper is callable by service_role; neither by clients.
select p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as customer_can_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
 and p.proname in ('create_robux_account_order','create_robux_account_order_with_policy');

select exists(select 1 from pg_trigger where not tgisinternal
 and tgrelid='public.robux_account_orders'::regclass
 and tgname='guard_robux_account_snapshot' and tgenabled='O') as snapshot_protegido,
 position('greatest(v_minimum' in pg_get_functiondef(
 'public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric)'::regprocedure))>0 as formula_com_minimo_instalada;

-- No internal pricing configuration should be in the customer-safe table.
select not exists(select 1 from information_schema.columns
 where table_schema='public' and table_name='robux_account_order_details'
 and column_name in ('min_cosmic_k','margin_per_thousand','supplier_k','supplier_cost','quote_url'))
 as detalhes_do_cliente_sem_dados_internos;
