export type AccountOption = {
  id: string;
  robux: number;
  cosmicK: number;
  price: number;
  available: boolean;
  options: number;
};

// Com preços por faixa, comparar apenas o K base não revela o melhor valor.
// Produtos cruzados em centavos comparam o preço efetivo sem arredondar o K.
export function compareAccountUnitPrice(a: Pick<AccountOption, "price" | "robux">, b: Pick<AccountOption, "price" | "robux">) {
  const left = BigInt(Math.round(a.price * 100)) * BigInt(b.robux);
  const right = BigInt(Math.round(b.price * 100)) * BigInt(a.robux);
  return left < right ? -1 : left > right ? 1 : 0;
}

// Group only the public presentation. The selected ID still identifies one
// real offer and is freshly validated by the existing checkout service.
export function groupAccountOptions(
  offers: (Omit<AccountOption, "options"> & { publicCount?: number })[],
): AccountOption[] {
  const groups = new Map<string, AccountOption>();
  for (const offer of [...offers].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = `${offer.robux}:${Math.round(offer.cosmicK * 100)}:${Math.round(offer.price * 100)}`;
    const previous = groups.get(key);
    const options = offer.available ? Math.max(1, offer.publicCount ?? 1) : 0;
    if (!previous) {
      groups.set(key, {
        id: offer.id,
        robux: offer.robux,
        cosmicK: offer.cosmicK,
        price: offer.price,
        available: offer.available,
        options,
      });
    } else {
      previous.options += options;
      if (!previous.available && offer.available) previous.id = offer.id;
      previous.available ||= offer.available;
    }
  }
  return [...groups.values()];
}
