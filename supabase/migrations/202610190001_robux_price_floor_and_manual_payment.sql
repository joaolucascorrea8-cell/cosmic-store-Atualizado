-- Cosmic Store: piso de R$36/K no Quick Buy e confirmação manual de pagamento.
-- Mantém pedidos anteriores e suas provas; apenas atualiza a configuração padrão.
alter table public.robux_settings
  alter column min_cosmic_k set default 36;

update public.robux_settings
set min_cosmic_k = greatest(min_cosmic_k, 36), updated_at = now()
where id = 1;

-- A falta de anexo não pode bloquear a confirmação manual pelo administrador.
-- A função continua exigindo admin, conferência do estado esperado e registro de auditoria.
create or replace function public.transition_store_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_status text,
  p_expected_status text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_valid boolean;
begin
  if not public.is_store_admin(p_admin_id) then
    raise exception 'Acesso administrativo negado.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_order.status = p_status then
    return jsonb_build_object('changed', false, 'order', to_jsonb(v_order));
  end if;

  if v_order.status is distinct from p_expected_status then
    raise exception 'Outro administrador alterou este pedido. Atualize a página.';
  end if;

  v_valid := case v_order.status
    when 'awaiting_payment' then p_status in ('paid', 'cancelled')
    when 'proof_rejected' then p_status in ('paid', 'cancelled')
    when 'proof_submitted' then p_status in ('paid', 'proof_rejected', 'cancelled')
    when 'under_review' then p_status in ('paid', 'proof_rejected', 'cancelled')
    when 'paid' then p_status in ('preparing_delivery', 'cancelled')
    when 'preparing_delivery' then p_status in ('delivered', 'cancelled')
    else false
  end;

  if not v_valid then
    raise exception 'Transição de pedido inválida.';
  end if;

  if p_status = 'proof_rejected'
     and char_length(trim(p_reason)) not between 5 and 300 then
    raise exception 'Informe um motivo de 5 a 300 caracteres.';
  end if;

  if p_status = 'delivered'
     and v_order.order_type not in ('robux', 'robux_account')
     and not exists (
       select 1
       from public.order_messages m
       where m.order_id = p_order_id
         and m.attachment_path is not null
         and m.attachment_type like 'image/%'
         and public.is_store_admin(m.user_id)
     ) then
    raise exception 'Envie a imagem da entrega no chat antes de concluir.';
  end if;

  if p_status = 'paid' then
    perform public.commit_order_stock(p_order_id);
  end if;

  if p_status = 'cancelled' then
    perform public.restore_order_stock(p_order_id);
  end if;

  update public.orders
  set status = p_status,
      paid_at = case when p_status = 'paid' then now() else paid_at end,
      delivery_due_at = case
        when p_status = 'paid' then now() + case
          when v_order.order_type = 'robux' then interval '7 days'
          else interval '24 hours'
        end
        else delivery_due_at
      end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      chat_closed_at = case
        when p_status = 'paid' then null
        when p_status = 'delivered' then now()
        else chat_closed_at
      end,
      rejection_reason = case
        when p_status = 'proof_rejected' then trim(p_reason)
        when p_status = 'paid' then null
        else rejection_reason
      end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_admin_events(order_id, admin_id, action, details)
  values (
    p_order_id,
    p_admin_id,
    'status:' || p_status,
    case
      when p_status = 'proof_rejected'
        then jsonb_build_object('rejection_reason', trim(p_reason))
      when p_status = 'paid'
        then jsonb_build_object('manual_without_proof', v_order.proof_path is null)
      else null
    end
  );

  return jsonb_build_object('changed', true, 'order', to_jsonb(v_order));
end;
$$;
