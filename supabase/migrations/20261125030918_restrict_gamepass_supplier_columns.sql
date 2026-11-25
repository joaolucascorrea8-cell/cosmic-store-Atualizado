-- A política existente continua limitando a leitura aos pedidos do cliente.
-- A operação administrativa usa service_role após verificar a função do operador.
revoke all on table public.robux_orders from public, anon, authenticated;
grant select (
  order_id, mode, requested_robux, gamepass_robux, net_robux, gamepass_url,
  gamepass_id, roblox_username, quoted_cosmic_k, quoted_sale_price,
  supplier_status, executed_at, completed_at, created_at, updated_at
) on public.robux_orders to authenticated;
