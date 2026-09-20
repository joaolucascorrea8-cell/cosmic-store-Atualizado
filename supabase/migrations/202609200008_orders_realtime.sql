-- Permite que a página do cliente seja atualizada assim que o status do pedido mudar.
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;
