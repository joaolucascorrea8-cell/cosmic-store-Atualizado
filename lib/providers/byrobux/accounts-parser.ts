// Pure parser of anonymous, public HTML. Never evaluates scripts or retains purchase tokens.
import { createHash } from "node:crypto";
import { priceFromRobuxTable } from "../../robux-price-table";

export type AccountQuote = {
  id: string;
  url: string;
  supplierK: number;
  seenAt: string;
};
export type AccountOffer = {
  id: string;
  providerId: string;
  maskedId: string;
  robux: number;
  supplierPrice: number;
  supplierK: number;
  quoteId: string;
  quoteUrl: string;
  seenAt: string;
  publicCount?: number;
};
export const providerOrigin = "https://www.byrobux.net";
export function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function rendered(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}
function text(html: string) {
  return decode(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
export function publicUrl(value: string, base = providerOrigin) {
  const url = new URL(decode(value), base);
  if (
    url.protocol !== "https:" ||
    !["www.byrobux.net", "byrobux.net"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error("URL pública inválida.");
  if (!/^\/accounts\/[A-Za-z0-9_-]{1,100}\/?$/.test(url.pathname))
    throw new Error("URL de cotação inválida.");
  const result = new URL(url.pathname.replace(/\/$/, ""), providerOrigin);
  const catalog = url.searchParams.get("catalog");
  if (catalog && !/^[a-zA-Z0-9_-]{1,40}$/.test(catalog))
    throw new Error("Catálogo inválido.");
  if (catalog) result.searchParams.set("catalog", catalog);
  return result.toString();
}
export function moneyNumber(value: string) {
  const n = value.replace(/\s/g, "");
  if (n.includes(",") && n.includes("."))
    return Number(
      n.lastIndexOf(",") > n.lastIndexOf(".")
        ? n.replace(/\./g, "").replace(",", ".")
        : n.replace(/,/g, ""),
    );
  if (n.includes(","))
    return Number(
      /,\d{3}$/.test(n) ? n.replace(/,/g, "") : n.replace(",", "."),
    );
  return Number(/\.\d{3}$/.test(n) ? n.replace(/\./g, "") : n);
}

export function calculateCosmicPrice(
  robux: number,
  supplierK: number,
  margin: number,
  minCosmicK: number,
) {
  if (
    !Number.isSafeInteger(robux) ||
    robux <= 0 ||
    robux > 10000000 ||
    !Number.isFinite(supplierK) ||
    supplierK <= 0 ||
    !Number.isFinite(margin) ||
    margin < 0 ||
    !Number.isFinite(minCosmicK) ||
    minCosmicK < 0
  )
    throw new Error("Cotação inválida.");
  const kCents = Math.max(
    Math.round(minCosmicK * 100),
    Math.round(supplierK * 100) + Math.round(margin * 100),
  );
  return {
    cosmicK: kCents / 100,
    price: priceFromRobuxTable(robux, kCents / 100),
  };
}
export function parseQuotes(html: string, seenAt = new Date().toISOString()) {
  const quotes = new Map<string, AccountQuote>();
  for (const match of rendered(html).matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    if (!decode(match[1]).startsWith("/accounts/")) continue;
    const rate = text(match[2]).match(/R\$\s*([\d.,]+)\s*\/\s*1\s*k/i);
    if (!rate) continue; // pagination links have no K
    const supplierK = moneyNumber(rate[1]);
    if (!Number.isFinite(supplierK) || supplierK <= 0 || supplierK > 10000)
      throw new Error("Cotação pública inválida.");
    const url = publicUrl(match[1]),
      id = hashKey(url);
    const prior = quotes.get(id);
    if (prior && prior.supplierK !== supplierK)
      throw new Error("Cotações conflitantes na mesma página.");
    quotes.set(id, { id, url, supplierK, seenAt });
  }
  return [...quotes.values()];
}
// Decode only JSON strings from the public React flight stream; do not execute Javascript.
function flightStream(html: string) {
  let stream = "";
  for (const match of html.matchAll(
    /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g,
  )) {
    try {
      stream += JSON.parse(match[1]);
    } catch {
      throw new Error("HTML público incompleto.");
    }
  }
  return stream;
}
function publicAccounts(html: string): unknown[] {
  const stream = flightStream(html);
  const start = /"accounts"\s*:\s*\[/.exec(stream);
  if (!start) return [];
  const offset = start.index + start[0].length - 1;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = offset; i < stream.length; i++) {
    const c = stream[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) {
      const value: unknown = JSON.parse(stream.slice(offset, i + 1));
      if (!Array.isArray(value)) throw new Error("Contas públicas inválidas.");
      return value;
    }
  }
  throw new Error("Lista pública incompleta.");
}
export function parseQuoteAccounts(html: string, quote: AccountQuote) {
  const visible = rendered(html),
    content = text(visible);
  const heading = text(
    visible.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "",
  );
  const rate = heading.match(/R\$\s*([\d.,]+)\s*\/\s*1\s*k/i);
  if (!rate) throw new Error("Estrutura externa não reconhecida: cotação.");
  const supplierK = moneyNumber(rate[1]);
  if (!Number.isFinite(supplierK) || supplierK <= 0 || supplierK > 10000)
    throw new Error("Cotação inválida.");
  const page = content.match(/(?:Page|Página)\s+(\d+)\s+(?:of|de)\s+(\d+)/i);
  const empty =
    /There are no accounts at this quote right now|Não há contas (?:disponíveis )?nesta cotação|Nenhuma conta (?:disponível )?nesta cotação/i.test(
      content,
    );
  const raw = publicAccounts(html);
  const rows = [...visible.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((m) =>
      [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
        text(c[1]),
      ),
    )
    .filter((c) => c.length);
  const nonPaginatedFourth =
    new URL(quote.url).searchParams.get("catalog") === "fourth" &&
    raw.length > 0 &&
    raw.every(
      (a) =>
        a &&
        typeof a === "object" &&
        /^fourth:[0-9:]+$/.test(String((a as Record<string, unknown>).id)),
    );
  if (!empty && ((!page && !nonPaginatedFourth) || !rows.length || !raw.length))
    throw new Error("Estrutura externa não reconhecida: contas/paginação.");
  if (empty && (rows.length || raw.length))
    throw new Error("Estoque público inconsistente.");
  const pages = page ? Number(page[2]) : 1;
  if (pages < 1 || pages > 100 || (page && Number(page[1]) > pages))
    throw new Error("Paginação externa inválida.");
  const offers: AccountOffer[] = [],
    diagnostics: string[] = [];
  for (const [index, value] of raw.entries()) {
    if (!value || typeof value !== "object") {
      diagnostics.push(`Linha ${index + 1} inválida`);
      continue;
    }
    const a = value as Record<string, unknown>;
    const providerId = typeof a.id === "string" ? a.id : "";
    const robux =
      typeof a.col_1 === "string"
        ? Number(a.col_1.replace(/[.,\s]/g, ""))
        : Number(a.col_1);
    const supplierPrice =
      typeof a.priceBrl === "number" ? a.priceBrl / 100 : NaN;
    const row = rows.find(
      (c) =>
        /^\*{3,10}[a-zA-Z0-9]{1,10}$/.test(c[0]) &&
        providerId.endsWith(c[0].replace(/^\*+/, "")) &&
        Number(c[1].replace(/[.,\s]/g, "")) === robux &&
        Math.round(moneyNumber(c[2].replace(/^R\$\s*/, "")) * 100) ===
          Math.round(supplierPrice * 100),
    );
    const maskedId = row?.[0] ?? "";
    if (
      !/^[a-zA-Z0-9_:-]{6,100}$/.test(providerId) ||
      !Number.isSafeInteger(robux) ||
      robux <= 0 ||
      robux > 10000000 ||
      !Number.isFinite(supplierPrice) ||
      supplierPrice <= 0 ||
      !row
    ) {
      diagnostics.push(
        `Linha ${index + 1} ignorada: dados inválidos ou divergentes`,
      );
      continue;
    }
    offers.push({
      id: hashKey(`${quote.url}|${providerId}`),
      providerId,
      maskedId,
      robux,
      supplierPrice,
      supplierK,
      quoteId: quote.id,
      quoteUrl: quote.url,
      seenAt: quote.seenAt,
    });
  }
  if (!empty && !offers.length)
    throw new Error("Nenhuma oferta válida em página não vazia.");
  const unique = new Map<string, AccountOffer>();
  for (const o of offers) {
    const prior = unique.get(o.id);
    if (prior) {
      if (
        !nonPaginatedFourth ||
        prior.robux !== o.robux ||
        prior.supplierPrice !== o.supplierPrice
      )
        throw new Error("Identificadores públicos duplicados ou conflitantes.");
      prior.publicCount = (prior.publicCount ?? 1) + 1;
      diagnostics.push(
        "Linhas indistinguíveis no catálogo fourth agrupadas; a identidade da conta física não é pública.",
      );
    } else unique.set(o.id, { ...o, publicCount: 1 });
  }
  return {
    offers: [...unique.values()],
    diagnostics,
    pages,
    page: page ? Number(page[1]) : 1,
    quote: { ...quote, supplierK },
    quotes: parseQuotes(html, quote.seenAt),
  };
}
export function publicOffer(offer: AccountOffer, margin: number, minCosmicK: number) {
  return {
    id: offer.id,
    robux: offer.robux,
    ...calculateCosmicPrice(offer.robux, offer.supplierK, margin, minCosmicK),
  };
}
