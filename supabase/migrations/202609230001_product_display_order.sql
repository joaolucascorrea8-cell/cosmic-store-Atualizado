-- Ordem manual dos produtos na vitrine.
-- Execute esta migration antes de publicar a versão que usa display_order.

alter table public.products
  add column if not exists display_order integer;

-- Preserva a ordem antiga de forma determinística no primeiro uso.
-- Só preenche linhas que ainda não possuem uma ordem definida.
with ranked as (
  select
    id,
    (row_number() over (order by lower(name), id) * 10)::integer as new_order
  from public.products
)
update public.products as product
set display_order = ranked.new_order
from ranked
where product.id = ranked.id
  and product.display_order is null;

alter table public.products
  alter column display_order set default 1000000,
  alter column display_order set not null;

alter table public.products
  drop constraint if exists products_display_order_nonnegative;

alter table public.products
  add constraint products_display_order_nonnegative
  check (display_order >= 0);

create index if not exists products_display_order_idx
  on public.products(display_order, name);

comment on column public.products.display_order is
  'Ordem manual de exibição dos produtos. Valores menores aparecem primeiro.';

-- Salva a lista inteira em uma única transação. A função só é executável
-- pela service role usada nas Server Actions do painel administrativo.
create or replace function public.set_product_display_order(product_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_count integer;
  distinct_count integer;
begin
  if product_ids is null then
    raise exception 'Lista de produtos ausente.';
  end if;

  select count(*) into product_count from public.products;
  select count(distinct item_id) into distinct_count
  from unnest(product_ids) as items(item_id);

  if cardinality(product_ids) <> product_count or distinct_count <> product_count then
    raise exception 'A lista de produtos está desatualizada.';
  end if;

  if exists (
    select 1
    from unnest(product_ids) as items(item_id)
    left join public.products as product on product.id = item_id
    where product.id is null
  ) then
    raise exception 'A lista contém um produto inexistente.';
  end if;

  with desired as (
    select item_id as id, ordinal_position
    from unnest(product_ids) with ordinality as ordered(item_id, ordinal_position)
  )
  update public.products as product
  set display_order = (desired.ordinal_position * 10)::integer
  from desired
  where product.id = desired.id;
end;
$$;

revoke all on function public.set_product_display_order(uuid[]) from public;
grant execute on function public.set_product_display_order(uuid[]) to service_role;
