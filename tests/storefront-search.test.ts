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

test("busca encontra serviços ativos e não promove contas descontinuadas", () => {
  assert.deepEqual(
    matchingServices("robux").map((service) => service.href),
    ["/robux"],
  );
  assert.deepEqual(
    matchingServices("conta robux").map((service) => service.href),
    [],
  );
  assert.deepEqual(
    matchingServices("vip").map((service) => service.href),
    ["/servidores"],
  );
  assert.deepEqual(
    matchingServices("combo").map((service) => service.href),
    [],
  );
  assert.deepEqual(matchingServices("não existe"), []);
  assert.deepEqual(matchingServices("   "), []);
});
