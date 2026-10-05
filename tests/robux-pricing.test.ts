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

test("K Cosmic respeita piso e margem", () => {
  assert.equal(cosmicRateFromSupplier(25, { minCosmicK: 34, marginPerThousand: 9 }), 34);
  assert.equal(cosmicRateFromSupplier(26.3, { minCosmicK: 34, marginPerThousand: 9 }), 35.3);
});

test("preço usa o valor bruto do GamePass", () => {
  assert.equal(salePriceForGamepass(1429, 34), 48.59);
  assert.equal(salePriceForGamepass(1000, 34), 34);
});
