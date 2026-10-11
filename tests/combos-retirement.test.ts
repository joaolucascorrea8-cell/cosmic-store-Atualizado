import test from "node:test";
import assert from "node:assert/strict";
import { checkoutItems } from "../lib/checkout-request";
import { mergeRepurchase, sanitizeCart, type CartItem } from "../lib/cart";
import { readCouponForm } from "../lib/coupons";

const product: CartItem = {
  id: "50000000-0000-4000-8000-000000000001",
  kind: "product",
  name: "Dragon",
  slug: "dragon",
  quantity: 1,
  price: 20,
  image_url: null,
  stock: 10,
  unlimited_stock: false,
};
const combo: CartItem = { ...product, kind: "combo", name: "Combo antigo" };

test("checkout rejeita combos antigos e carrinhos mistos sem tratar combo como produto", () => {
  assert.equal(checkoutItems([combo]), null);
  assert.equal(checkoutItems([product, combo]), null);
  assert.deepEqual(checkoutItems([product]), [
    { id: product.id, kind: "product", quantity: 1, unit_price: 20 },
  ]);
  assert.deepEqual(checkoutItems([{ ...product, kind: undefined }]), checkoutItems([product]));
});

test("restaurar carrinho e recomprar mantém produtos e remove somente combos descontinuados", () => {
  assert.deepEqual(sanitizeCart([product, combo]), [product]);
  const restored = mergeRepurchase([combo], [product, combo]);
  assert.deepEqual(restored.items, [product]);
  assert.equal(restored.added, 1);
});

test("formulário antigo não pode reativar desconto para combos", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    code: "COSMIC10", kind: "percent", amount: "10", min_order: "0",
    per_user_limit: "1", scope: "all", include_combos: "on", is_active: "on",
  })) form.set(key, value);
  const result = readCouponForm(form);
  assert.equal(result.error, null);
  assert.equal(result.values?.include_combos, false);
  assert.equal(result.values?.amount, 10);
});
