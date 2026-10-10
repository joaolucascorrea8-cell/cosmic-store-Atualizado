// Tabela pública compartilhada pelo cadastro de produtos e pelas contas.
// Usa a referência histórica K34 e arredonda somente o preço final.
export function priceFromRobuxTable(quantity: number, rate: number): number {
  const rateCents = Math.round(rate * 100);
  if (
    !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000000 ||
    !Number.isSafeInteger(rateCents) || rateCents < 1 || rateCents > 2000000
  ) throw new Error("Quantidade ou cotação inválida.");

  const q = BigInt(quantity);
  let n: bigint, d: bigint;
  if (quantity <= 350) {
    n = q * BigInt(1500);
    d = BigInt(350);
  } else if (quantity <= 450) {
    n = BigInt(1500) + (q - BigInt(350)) * BigInt(2);
    d = BigInt(1);
  } else if (quantity < 1000) {
    n = BigInt(1700) * (q + BigInt(100));
    d = BigInt(550);
  } else {
    n = q * BigInt(3400);
    d = BigInt(1000);
  }
  n *= BigInt(rateCents);
  d *= BigInt(3400);
  return Number((BigInt(2) * n + d) / (BigInt(2) * d)) / 100;
}
