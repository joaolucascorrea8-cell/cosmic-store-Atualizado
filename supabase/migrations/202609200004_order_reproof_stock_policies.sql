-- Reenvio de comprovante, prazo de entrega e controle idempotente de estoque.

alter table public.orders add column if not exists rejection_reason text;
alter table public.orders add column if not exists delivery_due_at timestamptz;
alter table public.orders add column if not exists stock_deducted_at timestamptz;
alter table public.orders add column if not exists stock_restored_at timestamptz;

alter table public.orders drop constraint if exists orders_rejection_reason_length;
alter table public.orders add constraint orders_rejection_reason_length
check (rejection_reason is null or char_length(rejection_reason) between 5 and 300);

update public.orders
set stock_deducted_at = coalesce(paid_at, updated_at, now()),
    delivery_due_at = coalesce(delivery_due_at, paid_at + interval '24 hours')
where status in ('paid','preparing_delivery','delivered')
  and stock_deducted_at is null;

create or replace function public.commit_order_stock(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  item record;
  changed integer;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if current_order.stock_deducted_at is not null and current_order.stock_restored_at is null then return; end if;
  if current_order.stock_restored_at is not null then raise exception 'O estoque deste pedido já foi devolvido.'; end if;

  for item in select product_id, quantity from public.order_items where order_id = target_order_id and product_id is not null loop
    update public.products
    set stock = stock - item.quantity
    where id = item.product_id and unlimited_stock = false and stock >= item.quantity;
    get diagnostics changed = row_count;
    if changed = 0 and exists (select 1 from public.products where id = item.product_id and unlimited_stock = false) then
      raise exception 'Estoque insuficiente para confirmar este pedido.';
    end if;
  end loop;

  update public.orders set stock_deducted_at = now(), stock_restored_at = null where id = target_order_id;
end;
$$;

create or replace function public.restore_order_stock(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  item record;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if current_order.stock_deducted_at is null or current_order.stock_restored_at is not null then return; end if;

  for item in select product_id, quantity from public.order_items where order_id = target_order_id and product_id is not null loop
    update public.products set stock = stock + item.quantity
    where id = item.product_id and unlimited_stock = false;
  end loop;

  update public.orders set stock_restored_at = now() where id = target_order_id;
end;
$$;

revoke all on function public.commit_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.restore_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.commit_order_stock(uuid) to service_role;
grant execute on function public.restore_order_stock(uuid) to service_role;
