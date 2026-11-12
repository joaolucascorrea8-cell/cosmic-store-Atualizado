import test from "node:test";
import assert from "node:assert/strict";
import { catalogSitemapPaths, hasCatalogVariants } from "../lib/store-seo";
test("sitemap só inclui produtos ligados a jogos visíveis e elimina URLs repetidas", () => {
  const paths=catalogSitemapPaths([{id:'game',slug:'blox-fruits'}],[{id:'c',slug:'frutas',game_id:'game'},{id:'hidden',slug:'oculta',game_id:'inactive'}],[{slug:'dragon',category_id:'c'},{slug:'dragon',category_id:'c'},{slug:'hidden',category_id:'hidden'}]);
  assert.ok(paths.includes('/produto/dragon'));assert.ok(paths.includes('/blox-fruits/frutas'));assert.ok(paths.includes('/blox-fruits'));assert.ok(!paths.includes('/produto/hidden'));assert.equal(paths.filter(p=>p==='/produto/dragon').length,1);assert.ok(!paths.includes('/robux/contas'));
});
test("filtros, busca e paginação são variantes não indexáveis; base permanece indexável", () => {
  assert.equal(hasCatalogVariants({}),false);
  for(const key of ['q','jogo','categoria','ordem','estoque','pagina'])assert.equal(hasCatalogVariants({[key]:'valor'}),true);
});
