import test from "node:test";
import assert from "node:assert/strict";
import { parsePrice, matchesProductName, slugify } from "../lib/catalog";
import { cartKey, cartSignature, sanitizeCart, maxQuantity } from "../lib/cart";
import { readProductForm } from "../lib/product-form";
const id = "50000000-0000-4000-8000-000000000001";
test("preços brasileiros e rejeição de formatos ambíguos", () => {
  assert.equal(parsePrice("R$ 1.234,56"), 1234.56);
  assert.equal(parsePrice("29,90"), 29.9);
  assert.equal(parsePrice("29.90"), 29.9);
  for (const value of ["1.000", "29.900", "-1", "1,23.45", "Infinity", ""])
    assert.equal(parsePrice(value), null);
});
test("busca por início das palavras, acentos e múltiplos termos", () => {
  assert.ok(matchesProductName("Dragón Permanente", "dr perm"));
  assert.ok(matchesProductName("Spirit Física", "fis"));
  assert.equal(matchesProductName("Dragon", "agon"), false);
  assert.equal(slugify("Spirit Física!"), "spirit-fisica");
});
test("carrinho separa combo e produto, limita quantidades e remove itens inválidos", () => {
  const base = {
    id,
    name: "Dragon",
    price: 20,
    image_url: null,
    stock: 2,
    unlimited_stock: false,
    quantity: 9,
  };
  const cart = sanitizeCart([
    base,
    { ...base, kind: "combo" },
    { ...base, id: "invalid" },
    { ...base, stock: 0 },
    base,
  ]);
  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 2);
  assert.notEqual(cartKey(cart[0]), cartKey(cart[1]));
  assert.equal(maxQuantity({ ...base, stock: 0 }), 0);
  assert.equal(cartSignature(cart), cartSignature([...cart].reverse()));
  assert.equal(sanitizeCart([{ ...base, price: Infinity }]).length, 0);
});
test("formulário compartilhado valida preço, categoria e estoque", () => {
  const form = new FormData();
  Object.entries({
    name: "Dragon",
    slug: "dragon",
    category_id: "40000000-0000-4000-8000-000000000001",
    price: "170,00",
    stock: "5",
    unlimited_stock: "false",
    is_active: "true",
  }).forEach(([k, v]) => form.set(k, v));
  const result = readProductForm(form);
  assert.equal(result.error, null);
  assert.equal(result.values?.price, 170);
  form.set("stock", "1.5");
  assert.ok(readProductForm(form).error);
});
import { allRows } from "../lib/query-pages";
import { isViewedConversation } from "../lib/notification-view";
test("catálogo carrega páginas além do limite padrão sem esconder falhas", async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const pages: number[] = [];
  const result = await allRows({
    range: (from, to) => {
      pages.push(from);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  });
  assert.equal(result.data?.length, 1201);
  assert.deepEqual(pages, [0, 500, 1000]);
  const failure = await allRows({
    range: () => Promise.resolve({ data: null, error: { message: "Falha" } }),
  });
  assert.equal(failure.data, null);
  assert.equal(failure.error?.message, "Falha");
});
test("conversa visível silencia mensagens, mas comprovante e novos pedidos sempre avisam", () => {
  const link = "/admin/pedidos/abc";
  assert.equal(
    isViewedConversation(
      { title: "Nova mensagem de pedido", link },
      link + "?aba=chat",
      true,
      true,
    ),
    true,
  );
  for (const title of [
    "Novo comprovante recebido",
    "Novo pedido",
    "Novo atendimento de suporte",
  ])
    assert.equal(
      isViewedConversation({ title, link }, link, true, true),
      false,
    );
  assert.equal(
    isViewedConversation(
      { title: "Nova mensagem de pedido", link },
      "/admin",
      true,
      true,
    ),
    false,
  );
  assert.equal(
    isViewedConversation(
      { title: "Nova mensagem de pedido", link },
      link,
      false,
      true,
    ),
    false,
  );
  assert.equal(
    isViewedConversation(
      { title: "Nova mensagem de pedido", link },
      link,
      true,
      false,
    ),
    false,
  );
});
