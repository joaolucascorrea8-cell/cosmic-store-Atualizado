-- Fase 1 da Cosmic Store: perfis públicos dos usuários.
-- Execute este arquivo no SQL Editor do Supabase antes de testar /conta.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  auth_provider text not null default 'email',
  discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 3 and 24),
  constraint profiles_nickname_format check (nickname ~ '^[A-Za-z0-9_.-]+$')
);

create unique index if not exists profiles_nickname_unique
  on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

drop policy if exists "Perfis visiveis para usuarios autenticados" on public.profiles;
create policy "Perfis visiveis para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Usuario cria o proprio perfil" on public.profiles;
create policy "Usuario cria o proprio perfil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Usuario atualiza o proprio perfil" on public.profiles;
create policy "Usuario atualiza o proprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_nickname text;
  provider_name text;
begin
  base_nickname := regexp_replace(
    lower(coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'preferred_username',
      new.raw_user_meta_data ->> 'user_name',
      split_part(coalesce(new.email, ''), '@', 1),
      'cliente'
    )),
    '[^a-z0-9_.-]',
    '',
    'g'
  );

  if char_length(base_nickname) < 3 then
    base_nickname := 'cliente';
  end if;

  provider_name := coalesce(new.raw_app_meta_data ->> 'provider', 'email');

  insert into public.profiles (
    id,
    nickname,
    avatar_url,
    auth_provider,
    discord_id
  )
  values (
    new.id,
    left(base_nickname, 15) || '_' || left(new.id::text, 6),
    new.raw_user_meta_data ->> 'avatar_url',
    provider_name,
    case
      when provider_name = 'discord' then coalesce(
        new.raw_user_meta_data ->> 'provider_id',
        new.raw_user_meta_data ->> 'sub'
      )
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.auth_provider := old.auth_provider;
  new.discord_id := old.discord_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

-- Cria perfis para contas que já existiam antes desta migração.
insert into public.profiles (id, nickname, avatar_url, auth_provider, discord_id)
select
  users.id,
  left(
    case
      when char_length(regexp_replace(lower(coalesce(
        users.raw_user_meta_data ->> 'preferred_username',
        users.raw_user_meta_data ->> 'user_name',
        split_part(coalesce(users.email, ''), '@', 1),
        'cliente'
      )), '[^a-z0-9_.-]', '', 'g')) >= 3
      then regexp_replace(lower(coalesce(
        users.raw_user_meta_data ->> 'preferred_username',
        users.raw_user_meta_data ->> 'user_name',
        split_part(coalesce(users.email, ''), '@', 1),
        'cliente'
      )), '[^a-z0-9_.-]', '', 'g')
      else 'cliente'
    end,
    15
  ) || '_' || left(users.id::text, 6),
  users.raw_user_meta_data ->> 'avatar_url',
  coalesce(users.raw_app_meta_data ->> 'provider', 'email'),
  case
    when users.raw_app_meta_data ->> 'provider' = 'discord' then coalesce(
      users.raw_user_meta_data ->> 'provider_id',
      users.raw_user_meta_data ->> 'sub'
    )
    else null
  end
from auth.users as users
on conflict (id) do nothing;

-- Avatares são públicos, mas cada usuário só altera a própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar publico" on storage.objects;
create policy "Avatar publico"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Usuario envia o proprio avatar" on storage.objects;
create policy "Usuario envia o proprio avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Usuario atualiza o proprio avatar" on storage.objects;
create policy "Usuario atualiza o proprio avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Usuario apaga o proprio avatar" on storage.objects;
create policy "Usuario apaga o proprio avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
