-- Cosmic Store: avaliações importadas do Discord + anexos opcionais.
-- Avaliações do Discord ficam no mesmo catálogo de feedbacks, mas sem pedido/usuário local.

alter table public.feedbacks alter column order_id drop not null;
alter table public.feedbacks alter column user_id drop not null;

alter table public.feedbacks add column if not exists source text not null default 'site';
alter table public.feedbacks add column if not exists discord_message_id text;
alter table public.feedbacks add column if not exists discord_author_id text;
alter table public.feedbacks add column if not exists discord_created_at timestamptz;
alter table public.feedbacks add column if not exists attachment_path text;
alter table public.feedbacks add column if not exists attachment_name text;
alter table public.feedbacks add column if not exists attachment_type text;

alter table public.feedbacks drop constraint if exists feedbacks_source_check;
alter table public.feedbacks add constraint feedbacks_source_check check (source in ('site','discord'));

create unique index if not exists feedbacks_discord_message_uidx
  on public.feedbacks(discord_message_id)
  where discord_message_id is not null;
create index if not exists feedbacks_source_created_idx
  on public.feedbacks(source, created_at desc);

create or replace function public.fill_feedback_author()
returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_row public.profiles%rowtype;
begin
  if coalesce(new.source, 'site') = 'discord' then
    if nullif(trim(coalesce(new.discord_message_id, '')), '') is null then
      raise exception 'Avaliação importada do Discord precisa do ID da mensagem.';
    end if;
    new.rating := 5;
    new.order_id := null;
    new.user_id := null;
    if nullif(trim(coalesce(new.author_nickname, '')), '') is null then
      new.author_nickname := 'Cliente do Discord';
    end if;
    return new;
  end if;

  if new.order_id is null or new.user_id is null or not exists (
    select 1 from public.orders
    where id = new.order_id and user_id = new.user_id and status = 'delivered'
  ) then
    raise exception 'Somente pedidos entregues podem ser avaliados.';
  end if;

  select * into profile_row from public.profiles where id = new.user_id;
  new.author_nickname := profile_row.nickname;
  new.author_avatar_url := profile_row.avatar_url;
  new.source := 'site';
  new.discord_message_id := null;
  new.discord_author_id := null;
  new.discord_created_at := null;

  if tg_op = 'UPDATE' and not public.is_store_admin() then
    new.is_visible := old.is_visible;
  end if;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-attachments',
  'review-attachments',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- O bucket permanece privado. Upload e URLs assinadas passam apenas pelo servidor da loja.
