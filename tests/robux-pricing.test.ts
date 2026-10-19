import assert from "node:assert/strict";
import test from "node:test";
import {
  cosmicRateFromSupplier,
  estimatedNetFromGamepass,
  gamepassForDesiredNetRobux,
  robuxBreakdown,
  salePriceForGamepass,
} from "../lib/robux-pricing";

test("taxa paga calcula GamePass para 1.000 líquidos", () => {
  assert.equal(gamepassForDesiredNetRobux(1000), 1429);
  assert.equal(estimatedNetFromGamepass(1429), 1000);
  assert.deepEqual(robuxBreakdown(1000, "tax_paid"), {
    requestedRobux: 1000,
    gamepassRobux: 1429,
    netRobux: 1000,
    feeRobux: 429,
  });
});

test("sem taxa paga desconta 30%", () => {
  assert.deepEqual(robuxBreakdown(1000, "tax_not_paid"), {
    requestedRobux: 1000,
    gamepassRobux: 1000,
    netRobux: 700,
    feeRobux: 300,
  });
});

test("K Cosmic respeita piso de R$36 e preserva o acréscimo da cotação", () => {
  assert.equal(cosmicRateFromSupplier(25, { minCosmicK: 36, marginPerThousand: 9 }), 36);
  assert.equal(cosmicRateFromSupplier(26.3, { minCosmicK: 36, marginPerThousand: 9 }), 36);
  assert.equal(cosmicRateFromSupplier(27.3, { minCosmicK: 36, marginPerThousand: 9 }), 36.3);
});

test("1K sem taxa custa R$36 e a opção taxa paga mantém o cálculo automático", () => {
  assert.equal(salePriceForGamepass(1000, 36), 36);
  assert.equal(salePriceForGamepass(1429, 36), 51.44);
});
