import {
  AccountQuote,
  AccountOffer,
  parseQuotes,
  parseQuoteAccounts,
  providerOrigin,
  publicUrl,
} from "./accounts-parser";

export async function fetchQuoteAccountsWith(
  fetchPublic: (url: string) => Promise<string>,
  quote: AccountQuote,
  targetProviderId?: string,
) {
  const first = parseQuoteAccounts(
    await fetchPublic(
      `${publicUrl(quote.url)}${quote.url.includes("?") ? "&" : "?"}sort=robux_asc`,
    ),
    { ...quote, seenAt: new Date().toISOString() },
  );
  const offers = [...first.offers],
    diagnostics = [...first.diagnostics],
    discovered = [...first.quotes];
  if (targetProviderId && offers.some((o) => o.providerId === targetProviderId))
    return { quote: first.quote, offers, diagnostics, quotes: discovered };
  // Page navigation is generated from the explicit public page count, including gaps in its links.
  for (let page = 2; page <= first.pages; page++) {
    const url = new URL(quote.url);
    url.searchParams.set("sort", "robux_asc");
    url.searchParams.set("page", String(page));
    const result = parseQuoteAccounts(await fetchPublic(url.toString()), {
      ...quote,
      seenAt: new Date().toISOString(),
    });
    if (
      result.page !== page ||
      result.pages !== first.pages ||
      result.quote.supplierK !== first.quote.supplierK
    )
      throw new Error(
        "Estoque mudou durante a paginação; a última sincronização foi preservada.",
      );
    offers.push(...result.offers);
    diagnostics.push(...result.diagnostics);
    discovered.push(...result.quotes);
    if (
      targetProviderId &&
      result.offers.some((o) => o.providerId === targetProviderId)
    )
      return {
        quote: result.quote,
        offers: result.offers,
        diagnostics,
        quotes: discovered,
      };
  }
  const unique = new Map<string, AccountOffer>();
  for (const o of offers) {
    const prior = unique.get(o.id);
    if (!prior) unique.set(o.id, { ...o });
    else if (
      o.providerId.startsWith("fourth:") &&
      prior.robux === o.robux &&
      prior.supplierPrice === o.supplierPrice
    ) {
      prior.publicCount = (prior.publicCount ?? 1) + (o.publicCount ?? 1);
      diagnostics.push(
        "Linhas indistinguíveis agrupadas entre páginas do catálogo fourth.",
      );
    } else throw new Error("Estoque mudou durante a paginação (duplicatas).");
  }
  return {
    quote: first.quote,
    offers: [...unique.values()],
    diagnostics,
    quotes: discovered,
  };
}

export type PreviousCatalog = {
  quotes: AccountQuote[];
  offers: AccountOffer[];
};
export async function fetchCatalogWith(
  fetchPublic: (url: string) => Promise<string>,
  previous: PreviousCatalog = { quotes: [], offers: [] },
) {
  const startedAt = Date.now();
  let requests = 0;
  const originalFetch = fetchPublic;
  fetchPublic = (url) => {
    if (++requests > 500 || Date.now() - startedAt > 240000)
      throw new Error(
        "Limite de duração/páginas excedido; catálogo anterior preservado.",
      );
    return originalFetch(url);
  };
  const seenAt = new Date().toISOString();
  const html = await fetchPublic(`${providerOrigin}/`);
  const quotes = new Map(parseQuotes(html, seenAt).map((q) => [q.id, q]));
  // An empty/unrecognized homepage is not treated as zero stock.
  if (!quotes.size)
    throw new Error(
      "Estrutura externa não reconhecida ou catálogo indisponível.",
    );
  const processed = new Set<string>(),
    succeeded = new Set<string>(),
    offers: AccountOffer[] = [],
    diagnostics: string[] = [],
    errors: string[] = [];
  while (processed.size < quotes.size) {
    if (quotes.size > 200)
      throw new Error("Limite de segurança de cotações excedido.");
    const batch = [...quotes.values()]
      .filter((q) => !processed.has(q.id))
      .slice(0, 3);
    const results = await Promise.allSettled(
      batch.map((q) => fetchQuoteAccountsWith(fetchPublic, q)),
    );
    for (const [index, outcome] of results.entries()) {
      const requested = batch[index];
      processed.add(requested.id);
      if (outcome.status === "rejected") {
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : "Consulta indisponível.";
        errors.push(`${requested.url}: ${message}`);
        const priorQuote = previous.quotes.find((q) => q.id === requested.id);
        if (priorQuote) quotes.set(priorQuote.id, priorQuote);
        offers.push(
          ...previous.offers.filter((o) => o.quoteId === requested.id),
        );
        continue;
      }
      const result = outcome.value;
      succeeded.add(result.quote.id);
      quotes.set(result.quote.id, result.quote);
      offers.push(...result.offers);
      diagnostics.push(...result.diagnostics);
      for (const q of result.quotes) if (!quotes.has(q.id)) quotes.set(q.id, q);
    }
  }
  if (!succeeded.size)
    throw new Error(errors[0] || "Nenhuma cotação pôde ser consultada.");
  if (errors.length) {
    // If discovery was incomplete, absence is not evidence of stock removal.
    for (const prior of previous.quotes)
      if (!quotes.has(prior.id)) {
        quotes.set(prior.id, prior);
        offers.push(...previous.offers.filter((o) => o.quoteId === prior.id));
      }
    diagnostics.push(...errors);
  }
  // A public stable account ID seen in two quotes is ambiguous: do not allow two purchases.
  const ids = new Set<string>();
  for (const offer of offers) {
    if (ids.has(offer.providerId))
      throw new Error(
        "Mesma conta encontrada em cotações diferentes; catálogo preservado.",
      );
    ids.add(offer.providerId);
  }
  return {
    quotes: [...quotes.values()],
    offers,
    diagnostics,
    seenAt: new Date().toISOString(),
    errors,
  };
}
