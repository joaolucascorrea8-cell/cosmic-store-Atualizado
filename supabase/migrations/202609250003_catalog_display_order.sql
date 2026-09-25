-- Ordem manual de jogos e categorias.
-- Jogos usam ordem global; categorias usam ordem dentro de cada jogo.

alter table public.games
  add column if not exists display_order integer;

with ranked as (
  select id, (row_number() over (order by lower(name), id) * 10)::integer as new_order
  from public.games
)
update public.games as game
set display_order = ranked.new_order
from ranked
where game.id = ranked.id
  and game.display_order is null;

alter table public.games
  alter column display_order set default 1000000,
  alter column display_order set not null;

alter table public.games
  drop constraint if exists games_display_order_nonnegative;

alter table public.games
  add constraint games_display_order_nonnegative
  check (display_order >= 0);

create index if not exists games_display_order_idx
  on public.games(display_order, name);

comment on column public.games.display_order is
  'Ordem manual de exibição dos jogos. Valores menores aparecem primeiro.';

alter table public.categories
  add column if not exists display_order integer;

with ranked as (
  select
    id,
    (row_number() over (partition by game_id order by lower(name), id) * 10)::integer as new_order
  from public.categories
)
update public.categories as category
set display_order = ranked.new_order
from ranked
where category.id = ranked.id
  and category.display_order is null;

alter table public.categories
  alter column display_order set default 1000000,
  alter column display_order set not null;

alter table public.categories
  drop constraint if exists categories_display_order_nonnegative;

alter table public.categories
  add constraint categories_display_order_nonnegative
  check (display_order >= 0);

create index if not exists categories_game_display_order_idx
  on public.categories(game_id, display_order, name);

comment on column public.categories.display_order is
  'Ordem manual da categoria dentro do respectivo jogo.';

create or replace function public.set_game_display_order(game_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_count integer;
  distinct_count integer;
begin
  if game_ids is null then
    raise exception 'Lista de jogos ausente.';
  end if;

  select count(*) into row_count from public.games;
  select count(distinct item_id) into distinct_count
  from unnest(game_ids) as items(item_id);

  if cardinality(game_ids) <> row_count or distinct_count <> row_count then
    raise exception 'A lista de jogos está desatualizada.';
  end if;

  if exists (
    select 1
    from unnest(game_ids) as items(item_id)
    left join public.games as game on game.id = item_id
    where game.id is null
  ) then
    raise exception 'A lista contém um jogo inexistente.';
  end if;

  with desired as (
    select item_id as id, ordinal_position
    from unnest(game_ids) with ordinality as ordered(item_id, ordinal_position)
  )
  update public.games as game
  set display_order = (desired.ordinal_position * 10)::integer
  from desired
  where game.id = desired.id;
end;
$$;

revoke all on function public.set_game_display_order(uuid[]) from public;
grant execute on function public.set_game_display_order(uuid[]) to service_role;

create or replace function public.set_category_display_order(target_game_id uuid, category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_count integer;
  distinct_count integer;
begin
  if target_game_id is null or category_ids is null then
    raise exception 'Jogo ou lista de categorias ausente.';
  end if;

  select count(*) into row_count
  from public.categories
  where game_id = target_game_id;

  select count(distinct item_id) into distinct_count
  from unnest(category_ids) as items(item_id);

  if cardinality(category_ids) <> row_count or distinct_count <> row_count then
    raise exception 'A lista de categorias está desatualizada.';
  end if;

  if exists (
    select 1
    from unnest(category_ids) as items(item_id)
    left join public.categories as category
      on category.id = item_id and category.game_id = target_game_id
    where category.id is null
  ) then
    raise exception 'A lista contém categoria de outro jogo ou inexistente.';
  end if;

  with desired as (
    select item_id as id, ordinal_position
    from unnest(category_ids) with ordinality as ordered(item_id, ordinal_position)
  )
  update public.categories as category
  set display_order = (desired.ordinal_position * 10)::integer
  from desired
  where category.id = desired.id
    and category.game_id = target_game_id;
end;
$$;

revoke all on function public.set_category_display_order(uuid, uuid[]) from public;
grant execute on function public.set_category_display_order(uuid, uuid[]) to service_role;
