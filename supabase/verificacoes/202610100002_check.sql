-- Somente leitura. Execute após 202610100002_robux_account_price_table.sql.
-- Na primeira consulta, todos os valores de confere devem ser true.
select t.robux,t.esperado,
 public.robux_account_table_price(t.robux,34) as preco_com_k_base_34,
 public.robux_account_table_price(t.robux,34)=t.esperado as confere
from (values(350,15.00::numeric),(400,16.00),(450,17.00),
 (500,18.55),(750,26.27),(1000,34.00),(1990,67.66)) t(robux,esperado);

-- Valores ilustrativos usando a configuração ATUAL, sem modificar preços.
select t.robux,s.min_cosmic_k as minimo,s.margin_per_thousand as acrescimo,
 greatest(s.min_cosmic_k,29+s.margin_per_thousand) as k_base,
 public.robux_account_table_price(t.robux,greatest(s.min_cosmic_k,29+s.margin_per_thousand)) as preco
from public.robux_account_settings s cross join (values(350),(500),(1000)) t(robux)
where s.id=1;

-- Esperado: tabela true, snapshot true, coluna da regra true.
select position('robux_account_table_price' in pg_get_functiondef(
 'public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric)'::regprocedure))>0 as tabela_instalada,
 exists(select 1 from pg_trigger where not tgisinternal
 and tgrelid='public.robux_account_orders'::regclass
 and tgname='guard_robux_account_snapshot' and tgenabled='O') as snapshot_protegido,
 exists(select 1 from information_schema.columns where table_schema='public'
 and table_name='robux_account_orders' and column_name='pricing_rule') as regra_no_snapshot;

-- Contagem por regra; não exibe clientes, credenciais ou dados de contas.
select pricing_rule,count(*) as pedidos from public.robux_account_orders group by pricing_rule;

-- Esperado: clientes sem execução; apenas o wrapper executável por service_role.
select p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as customer_can_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('robux_account_table_price','create_robux_account_order','create_robux_account_order_with_policy');

-- Esperado: RLS true, anon false. Authenticated segue a policy somente Admin.
select c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_can_read
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='robux_account_orders';
