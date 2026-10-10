import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCosmicPrice,
  parseQuotes,
  parseQuoteAccounts,
  publicOffer,
  publicUrl,
} from "../lib/providers/byrobux/accounts-parser";
import {
  fetchCatalogWith,
  fetchQuoteAccountsWith,
} from "../lib/providers/byrobux/accounts-catalog";
function quoteLink(id = "MTMz", catalog = "alternate", k = "26.93") {
  return `<a href="/accounts/${id}?catalog=${catalog}"><p>R$${k} / 1k Robux</p></a>`;
}
function page(
  accounts: Array<{ id: string; col_1: string; priceBrl: number }> = [
    { id: "account000660", col_1: "1990", priceBrl: 5359 },
  ],
  options: { pages?: number; page?: number; links?: string; k?: string } = {},
) {
  const flight = JSON.stringify(
    `0:{"accounts":${JSON.stringify(accounts.map((a) => ({ ...a, purchaseToken: "NEVER_RETAIN" })))}}`,
  );
  return `<html><body><h1>R$${options.k || "26.93"} / 1k Robux</h1>${options.links || ""}<table><thead><tr><th>ID</th><th>Robux</th><th>Price</th></tr></thead><tbody>${accounts.map((a) => `<tr><td>******${a.id.slice(-3)}</td><td>${a.col_1}</td><td>R$${(a.priceBrl / 100).toFixed(2)}</td></tr>`).join("")}</tbody></table>${accounts.length ? `Page ${options.page || 1} of ${options.pages || 1}` : "There are no accounts at this quote right now."}<script>self.__next_f.push([1,${flight}])</script></body></html>`;
}
const quote = parseQuotes(quoteLink())[0];
test("contas aceitam mínimo zero e mantêm cálculo em centavos sem finais artificiais", () => {
  assert.deepEqual(calculateCosmicPrice(1990, 26.93, 9, 0), {
    cosmicK: 35.93,
    price: 71.5,
  });
  assert.deepEqual(calculateCosmicPrice(1990, 26.93, 10, 0), {
    cosmicK: 36.93,
    price: 73.49,
  });
  assert.deepEqual(calculateCosmicPrice(1000, 20, 9, 0), {
    cosmicK: 29,
    price: 29,
  });
  for (const amount of [-1, 0, 1.5, NaN])
    assert.throws(() => calculateCosmicPrice(amount, 26.93, 9, 0));
});
test("mesmo K e ID da página em catálogos diferentes não se misturam", () => {
  const q = parseQuotes(quoteLink() + quoteLink("MTMz", "fourth"));
  assert.equal(q.length, 2);
  assert.notEqual(q[0].id, q[1].id);
  assert.equal(
    publicUrl("/accounts/MTMz?page=8&catalog=alternate&sort=robux_desc"),
    quote.url,
  );
  for (const url of [
    "https://evil.invalid/accounts/MTMz",
    "https://byrobux.net/auth/sign-in",
    "http://byrobux.net/accounts/MTMz",
    "https://user:password@byrobux.net/accounts/MTMz",
  ])
    assert.throws(() => publicUrl(url));
});
test("parser cruza HTML com dados públicos, exclui tokens e mantém apenas DTO seguro", () => {
  const result = parseQuoteAccounts(page(), quote);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].maskedId, "******660");
  assert.equal(result.offers[0].quoteUrl, quote.url);
  assert.equal(JSON.stringify(result).includes("NEVER_RETAIN"), false);
  assert.deepEqual(Object.keys(publicOffer(result.offers[0], 5, 34)).sort(), [
    "cosmicK",
    "id",
    "price",
    "robux",
  ]);
});
test("linha defeituosa não derruba contas válidas e gera diagnóstico", () => {
  const result = parseQuoteAccounts(
    page([
      { id: "account000660", col_1: "1990", priceBrl: 5359 },
      { id: "account000999", col_1: "-2", priceBrl: 0 },
    ]),
    quote,
  );
  assert.equal(result.offers.length, 1);
  assert.equal(result.diagnostics.length, 1);
});
test("parser distingue página explicitamente vazia de HTML quebrado ou login", () => {
  assert.equal(parseQuoteAccounts(page([]), quote).offers.length, 0);
  for (const html of [
    "<html>Login</html>",
    "<html><h1>R$26.93 / 1k Robux</h1></html>",
    page().replace("self.__next_f.push", "changed.push"),
  ])
    assert.throws(() => parseQuoteAccounts(html, quote));
});
test("coleta descobre outras cotações e todas as páginas incluindo links intermediários ausentes", async () => {
  const calls: string[] = [];
  const result = await fetchCatalogWith(async (url) => {
    calls.push(url);
    if (url.endsWith("/")) return quoteLink();
    if (url.includes("fourth"))
      return page([{ id: "account000444", col_1: "1000", priceBrl: 2693 }]);
    const n = Number(new URL(url).searchParams.get("page") || 1);
    return page([{ id: `account00000${n}`, col_1: "1990", priceBrl: 5359 }], {
      page: n,
      pages: 3,
      links: quoteLink("MTMz", "fourth"),
    });
  });
  assert.equal(result.quotes.length, 2);
  assert.equal(result.offers.length, 4);
  assert(calls.some((url) => url.includes("page=2")));
});
test("nova conta entra, conta removida sai; erro parcial não produz catálogo vazio/substituto", async () => {
  const load = (html: string) =>
    fetchCatalogWith(async (url) => (url.endsWith("/") ? quoteLink() : html));
  const before = await load(page()),
    after = await load(
      page([{ id: "account000123", col_1: "500", priceBrl: 1346 }]),
    );
  assert.notEqual(before.offers[0].id, after.offers[0].id);
  assert.equal((await load(page([]))).offers.length, 0);
  await assert.rejects(
    fetchCatalogWith(async (url) => {
      if (url.endsWith("/")) return quoteLink();
      throw new Error("HTTP 503");
    }),
    /503/,
  );
  await assert.rejects(
    fetchQuoteAccountsWith(
      async (url) =>
        new URL(url).searchParams.has("page")
          ? "<html>broken</html>"
          : page(undefined, { pages: 2 }),
      quote,
    ),
  );
});
test("paginação instável e duplicatas recusam resultados parciais", async () => {
  await assert.rejects(
    fetchQuoteAccountsWith(
      async (url) =>
        page(undefined, {
          pages: 2,
          page: new URL(url).searchParams.has("page") ? 2 : 1,
        }),
      quote,
    ),
    /duplicatas/,
  );
  await assert.rejects(
    fetchQuoteAccountsWith(
      async (url) =>
        page(undefined, {
          pages: new URL(url).searchParams.has("page") ? 3 : 2,
        }),
      quote,
    ),
    /paginação/,
  );
});
test("fourth sem paginação aceita IDs compostos, máscara real e agrupa linhas indistinguíveis", () => {
  const q = parseQuotes(quoteLink("MTI4", "fourth"))[0];
  const html = page([
    { id: "fourth:128:1600:204800", col_1: "1600", priceBrl: 4340 },
    { id: "fourth:128:1600:204800", col_1: "1600", priceBrl: 4340 },
  ])
    .replace("Page 1 of 1", "")
    .replaceAll("******800", "*****800");
  const result = parseQuoteAccounts(html, q);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].publicCount, 2);
  assert.equal(result.offers[0].maskedId, "*****800");
  assert.equal(result.diagnostics.length, 1);
});
test("falha de uma cotação preserva seu último estoque enquanto as demais atualizam", async () => {
  const previousOffer = parseQuoteAccounts(page(), quote).offers[0];
  const result = await fetchCatalogWith(
    async (url) => {
      if (url.endsWith("/"))
        return quoteLink() + quoteLink("MTQw", "alternate");
      if (url.includes("MTMz")) throw new Error("HTTP 503");
      return page([{ id: "account000555", col_1: "1000", priceBrl: 2693 }]);
    },
    { quotes: [quote], offers: [previousOffer] },
  );
  assert.equal(result.offers.length, 2);
  assert.deepEqual(
    result.offers.find((o) => o.id === previousOffer.id),
    previousOffer,
  );
  assert.equal(result.errors.length, 1);
});
test("moeda pública aceita separadores brasileiros e ingleses para valores acima de mil", () => {
  const data = [{ id: "account000660", col_1: "10000", priceBrl: 263305 }];
  const html = page(data).replaceAll("R$2633.05", "R$2,633.05");
  assert.equal(
    parseQuoteAccounts(html, quote).offers[0].supplierPrice,
    2633.05,
  );
  assert.equal(
    parseQuoteAccounts(html.replaceAll("R$2,633.05", "R$2.633,05"), quote)
      .offers[0].supplierPrice,
    2633.05,
  );
});
test("fourth com paginação reúne unidades de mesmo identificador composto", async () => {
  const q = parseQuotes(quoteLink("MTI4", "fourth"))[0];
  const r = await fetchQuoteAccountsWith(
    async (url) =>
      page([{ id: "fourth:128:1600:204800", col_1: "1600", priceBrl: 4340 }], {
        page: new URL(url).searchParams.has("page") ? 2 : 1,
        pages: 2,
      }),
    q,
  );
  assert.equal(r.offers.length, 1);
  assert.equal(r.offers[0].publicCount, 2);
});
