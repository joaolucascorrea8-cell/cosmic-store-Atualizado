type AmountRow = { amount: number | string };
export function orderFinance(total: number, paid: boolean, receipts: (AmountRow & { used_for_confirmation?: boolean })[], refunds: AmountRow[]) {
  const cents = (value: number | string) => Math.round(Number(value) * 100);
  const received = (paid ? cents(total) : 0) + receipts.filter(r => !r.used_for_confirmation).reduce((sum, r) => sum + cents(r.amount), 0);
  const refunded = refunds.reduce((sum, r) => sum + cents(r.amount), 0);
  return { received: received / 100, refunded: refunded / 100, remaining: Math.max(0, received - refunded) / 100 };
}
