-- Somente leitura. Rode depois da atualização 202610040003 no SQL Editor.
-- Todas as linhas devem mostrar ok = true. Não imprime dados de clientes.
select 'Tabela de reajustes' verificacao,to_regclass('public.price_batches') is not null ok
union all select 'Histórico de catálogo',to_regclass('public.catalog_events') is not null
union all select 'Notas privadas',to_regclass('public.admin_work_notes') is not null
union all select 'Configuração da automação',to_regclass('public.store_ops_settings') is not null
union all select 'Diagnóstico',to_regclass('public.store_issues') is not null
union all select 'Campos de produtos',count(*)=7 from information_schema.columns where table_schema='public' and table_name='products' and column_name in('delivery_instructions','robux_quantity','pricing_reference','pricing_rate','pricing_locked','low_stock_threshold','ops_version')
union all select 'Prévia de preços',to_regprocedure('public.ops_preview_prices(uuid,uuid[],numeric,numeric)') is not null
union all select 'Aplicação de preços',to_regprocedure('public.ops_apply_prices(uuid,uuid)') is not null
union all select 'Desfazer preços',to_regprocedure('public.ops_revert_prices(uuid,uuid)') is not null
union all select 'Importação',to_regprocedure('public.ops_import_products(uuid,uuid,jsonb)') is not null
union all select 'Organização da equipe',to_regprocedure('public.ops_work_update(uuid,text,uuid,uuid,text,timestamptz)') is not null
union all select 'Rotina sem comprovante',to_regprocedure('public.ops_expire_orders()') is not null
union all select 'Relatórios',to_regprocedure('public.ops_report(timestamptz,timestamptz)') is not null
union all select 'Revisão do produto',exists(select 1 from pg_trigger where tgrelid=to_regclass('public.products') and tgname='ops_product_revision' and tgenabled='O')
union all select 'Instruções nos pedidos',exists(select 1 from pg_trigger where tgrelid=to_regclass('public.order_items') and tgname='ops_snapshot_instructions' and tgenabled='O')
union all select 'Painel usa limite por produto',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='store_dashboard_summary' and pg_get_functiondef(p.oid) like '%low_stock_threshold%')
union all select 'Operações novas restritas ao backend',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ops_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')))
union all select 'Tabelas operacionais com RLS',count(*)=8 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('catalog_events','price_batches','product_import_batches','admin_work_items','admin_work_notes','admin_quick_replies','store_ops_settings','store_issues')
union all select 'Sem leitura pública de notas',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('admin_work_items','admin_work_notes') and (has_table_privilege('anon',c.oid,'select') or has_table_privilege('authenticated',c.oid,'select')));
