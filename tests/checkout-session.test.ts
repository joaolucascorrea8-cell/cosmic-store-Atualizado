import { test } from "node:test";
import assert from "node:assert/strict";
import { cartSignature, reconcileCart, type CartItem } from "../lib/cart";
import { orderIsPayable } from "../lib/order-status";
import { estimatedNetFromGamepass, gamepassForDesiredNetRobux, supplierQuoteFits } from "../lib/robux-pricing";

const base: CartItem = { id: "a", price: 20, stock: 5, quantity: 3, unlimited_stock: false, name: "Dragon", image_url: null };

test("o carrinho incorpora preço e limite atuais sem descartar linhas temporariamente indisponíveis", () => {
  const items = [base];
  const current = reconcileCart(items, { a: { price: 21, stock: 2, unlimited_stock: false } });
  assert.equal(current[0].quantity, 2);
  assert.equal(current[0].price, 21);
  assert.notEqual(cartSignature(current), cartSignature(items));
  assert.equal(reconcileCart(items, {}), items);
  assert.equal(reconcileCart(items, { a: { price: 20, stock: 0, unlimited_stock: false } }), items);
});

test("Pix requer situação pagável, modalidade ativa e ausência de confirmação anterior", () => {
  for (const status of ["cancelled", "paid", "submitted", "proof_submitted", "under_review", "delivered", "preparing_delivery"])
    assert.equal(orderIsPayable({ status }), false);
  assert.equal(orderIsPayable({ status: "awaiting_payment", paid_at: "2026-01-01" }), false);
  assert.equal(orderIsPayable({ status: "awaiting_payment", order_type: "robux_account" }), false);
  for (const status of ["awaiting_payment", "proof_rejected"])
    assert.equal(orderIsPayable({ status, order_type: "robux" }), true);
});

test("arredondamento da taxa do Roblox preserva múltiplos exatos de 70%", () => {
  assert.equal(gamepassForDesiredNetRobux(21), 30);
  assert.equal(estimatedNetFromGamepass(90), 63);
  for (let net = 1; net <= 10000; net++) {
    const pass = gamepassForDesiredNetRobux(net);
    assert.equal(estimatedNetFromGamepass(pass), net);
    assert.ok(estimatedNetFromGamepass(pass - 1) < net);
  }
});
test("custo efetivo e cotação precisam respeitar os limites para emitir e executar o pedido", () => {
  const settings = { minCosmicK: 36, marginPerThousand: 9, maxSupplierK: 30, minMarginPerThousand: 7 };
  assert.equal(supplierQuoteFits(25, 25, 1000, 36, settings), true);
  for (const cost of [NaN, Infinity, -1, 0, 30])
    assert.equal(supplierQuoteFits(cost, 25, 1000, 36, settings), false);
  assert.equal(supplierQuoteFits(25, 31, 1000, 36, settings), false);
});
