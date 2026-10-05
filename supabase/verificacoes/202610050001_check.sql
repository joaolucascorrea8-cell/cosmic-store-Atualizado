-- Verificação da integração de Robux / ByRobux.
select 'orders.order_type' item,
       exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='order_type') ok
union all
select 'robux_settings', to_regclass('public.robux_settings') is not null
union all
select 'robux_orders', to_regclass('public.robux_orders') is not null
union all
select 'create_robux_store_order', to_regprocedure('public.create_robux_store_order(uuid,uuid,text,text,numeric,text,integer,integer,integer,text,text,text,numeric,numeric,numeric)') is not null
union all
select 'transition_store_order', to_regprocedure('public.transition_store_order(uuid,uuid,text,text,text)') is not null;
