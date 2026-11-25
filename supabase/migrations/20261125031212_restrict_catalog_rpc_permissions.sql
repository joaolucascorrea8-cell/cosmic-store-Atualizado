-- Instalações podem ter privilégios padrão concedidos diretamente aos papéis da API.
revoke execute on function
  public.set_game_display_order(uuid[]),
  public.set_category_display_order(uuid, uuid[]),
  public.set_product_display_order(uuid[])
from public, anon, authenticated;
grant execute on function
  public.set_game_display_order(uuid[]),
  public.set_category_display_order(uuid, uuid[]),
  public.set_product_display_order(uuid[])
to service_role;

-- Os triggers existentes continuam associados às mesmas funções.
revoke execute on function
  public.create_profile_for_new_user(), public.fill_feedback_author(), public.guard_product_pending_orders()
from public, anon, authenticated;

-- Chamadas diretas respeitam as políticas de leitura da tabela admins.
-- Funções de operação invocam a mesma consulta com seu papel privilegiado.
create or replace function public.is_store_admin(check_user uuid default auth.uid())
returns boolean language plpgsql stable security invoker set search_path = '' as $$
begin
  if not has_table_privilege(current_user, 'public.admins', 'SELECT') then
    return false;
  end if;
  return exists (
    select 1 from public.admins where user_id = check_user and role in ('owner', 'admin')
  );
end;
$$;
