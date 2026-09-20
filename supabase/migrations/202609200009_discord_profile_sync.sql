-- Permite que o servidor sincronize o ID do Discord após o OAuth,
-- sem permitir que o próprio cliente altere auth_provider ou discord_id.
create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.id then
    new.auth_provider := old.auth_provider;
    new.discord_id := old.discord_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();
