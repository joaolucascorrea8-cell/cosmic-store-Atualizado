import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesCatalogSearch,
  matchingServices,
} from "../lib/storefront-search";

test("busca da vitrine combina produto, categoria e jogo sem perder prefixos", () => {
  const names = ["Dragón", "Frutas Permanentes", "Blox Fruits"];
  for (const query of [
    "d",
    "dr",
    "dra",
    "dragon blox",
    "frutas perman",
    "BLOX FRUITS",
    "  ",
  ])
    assert.equal(matchesCatalogSearch(query, ...names), true, query);
  for (const query of ["agon", "dragon fisch", "brookhaven"])
    assert.equal(matchesCatalogSearch(query, ...names), false, query);
  assert.equal(matchesCatalogSearch("dragon", "Dragon", undefined, null), true);
});

test("busca encontra serviços existentes, com links distintos para Robux e contas", () => {
  assert.deepEqual(
    matchingServices("robux").map((service) => service.href),
    ["/robux", "/robux/contas"],
  );
  assert.deepEqual(
    matchingServices("conta robux").map((service) => service.href),
    ["/robux/contas"],
  );
  assert.deepEqual(
    matchingServices("vip").map((service) => service.href),
    ["/servidores"],
  );
  assert.deepEqual(
    matchingServices("combo").map((service) => service.href),
    ["/combos"],
  );
  assert.deepEqual(matchingServices("não existe"), []);
  assert.deepEqual(matchingServices("   "), []);
});
