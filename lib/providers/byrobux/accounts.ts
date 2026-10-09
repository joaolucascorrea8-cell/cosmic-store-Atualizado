import "server-only";
import { AccountQuote } from "./accounts-parser";
import {
  fetchCatalogWith,
  fetchQuoteAccountsWith,
  type PreviousCatalog,
} from "./accounts-catalog";

const inFlight = new Map<string, Promise<string>>();
let active = 0;
const waiting: Array<() => void> = [];
async function slot() {
  if (active >= 3) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  return () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
}
async function fetchPublic(url: string) {
  const pending = inFlight.get(url);
  if (pending) return pending;
  const call = (async () => {
    const release = await slot();
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        credentials: "omit",
        headers: {
          Accept: "text/html",
          "User-Agent":
            "CosmicStore-PublicCatalog/1.0 (+https://www.cosmicstore.com.br)",
        },
        signal: AbortSignal.timeout(15000),
      });
      // No redirects into login, retries, cookies, or challenges.
      if (!res.ok || !res.headers.get("content-type")?.includes("text/html"))
        throw new Error(`Consulta pública indisponível (HTTP ${res.status}).`);
      const html = await res.text();
      if (html.length > 5000000 || !html.includes("</html>"))
        throw new Error("HTML público incompleto ou excessivo.");
      return html;
    } finally {
      release();
    }
  })();
  inFlight.set(url, call);
  try {
    return await call;
  } finally {
    inFlight.delete(url);
  }
}
export function fetchQuoteAccounts(quote: AccountQuote) {
  return fetchQuoteAccountsWith(fetchPublic, quote);
}
export function fetchCatalog(previous?: PreviousCatalog) {
  return fetchCatalogWith(fetchPublic, previous);
}
export function findQuoteAccount(quote: AccountQuote, providerId: string) {
  return fetchQuoteAccountsWith(fetchPublic, quote, providerId);
}
