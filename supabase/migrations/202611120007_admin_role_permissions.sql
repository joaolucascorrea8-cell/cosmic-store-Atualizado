-- A tabela base admins é preexistente. Preserva todas as atribuições e fecha escrita
-- pelo cliente; não há fluxo de manutenção de roles pelo cliente no código da loja.
alter table public.admins enable row level security;
revoke all on public.admins from public,anon,authenticated;
grant select on public.admins to authenticated;
grant all on public.admins to service_role;

drop policy if exists "Read own admin role" on public.admins;
create policy "Read own admin role" on public.admins for select to authenticated using(user_id=auth.uid());
-- Restritiva também limita políticas permissivas anteriores sem removê-las.
drop policy if exists "Limit client admin role visibility" on public.admins;
create policy "Limit client admin role visibility" on public.admins as restrictive for select to authenticated using(user_id=auth.uid());

create or replace function public.store_checkout_capabilities() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,'ready', public.store_checkout_ready()
 and (select relrowsecurity from pg_class where oid='public.admins'::regclass)
 and not has_table_privilege('authenticated','public.admins','INSERT,UPDATE,DELETE,TRUNCATE'));
$$;
revoke all on function public.store_checkout_capabilities() from public,anon,authenticated;
grant execute on function public.store_checkout_capabilities() to service_role;
