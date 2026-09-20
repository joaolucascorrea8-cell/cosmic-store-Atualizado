-- Controle de abertura e encerramento do atendimento privado dos pedidos.

alter table public.orders
  add column if not exists chat_closed_at timestamptz;

-- Pedidos já entregues começam com o atendimento encerrado.
update public.orders
set chat_closed_at = coalesce(delivered_at, updated_at, now())
where status = 'delivered' and chat_closed_at is null;

drop policy if exists "Participantes enviam no chat do pedido" on public.order_messages;
create policy "Participantes enviam no chat do pedido"
on public.order_messages for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.orders
    where id = order_id
      and status in ('paid','preparing_delivery','delivered')
      and chat_closed_at is null
      and (user_id = auth.uid() or public.is_store_admin())
  )
);
