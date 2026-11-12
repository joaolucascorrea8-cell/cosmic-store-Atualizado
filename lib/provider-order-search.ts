export async function findSupplierBatch<T extends { batchId: string }>(
  batchId: string,
  list: (page: number, limit: number) => Promise<{ orders: T[]; pagination: { totalPages: number } }>,
) {
  const deadline = Date.now() + 25_000;
  for (let page = 1; page <= 20; page++) {
    if (Date.now() > deadline) throw new Error("Consulta ao histórico do fornecedor excedeu o prazo. Tente novamente ou faça a conciliação manual.");
    const result = await list(page, 50);
    if (!Array.isArray(result.orders) || !Number.isInteger(result.pagination?.totalPages) || result.pagination.totalPages < 0)
      throw new Error("Histórico inválido do fornecedor. Não é seguro concluir a entrega.");
    const order = result.orders.find(item => item.batchId === batchId);
    if (order) return order;
    if (page >= result.pagination.totalPages) return null;
  }
  throw new Error("Pedido fora do limite de consulta ao histórico do fornecedor. Conciliação manual necessária.");
}
