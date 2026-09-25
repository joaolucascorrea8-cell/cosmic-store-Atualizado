-- Cosmic Store: marca se o usuário já concluiu a configuração inicial do perfil.
-- Contas que já existiam antes desta migration são consideradas configuradas,
-- para não redirecionar clientes antigos para o onboarding novamente.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default true;

-- A partir de agora, novos perfis começam pendentes e são concluídos no
-- primeiro salvamento da página Meu Perfil.
alter table public.profiles
  alter column onboarding_completed set default false;

comment on column public.profiles.onboarding_completed is
  'True depois que o usuário salva o perfil pela primeira vez.';
