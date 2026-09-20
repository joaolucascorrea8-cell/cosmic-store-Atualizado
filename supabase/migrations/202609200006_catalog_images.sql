-- Capas configuráveis para jogos e categorias.
-- Execute uma única vez no SQL Editor do Supabase.

alter table public.games
  add column if not exists image_url text;

alter table public.categories
  add column if not exists image_url text;

alter table public.games
  drop constraint if exists games_image_url_length;
alter table public.games
  add constraint games_image_url_length
  check (image_url is null or char_length(image_url) <= 500);

alter table public.categories
  drop constraint if exists categories_image_url_length;
alter table public.categories
  add constraint categories_image_url_length
  check (image_url is null or char_length(image_url) <= 500);
