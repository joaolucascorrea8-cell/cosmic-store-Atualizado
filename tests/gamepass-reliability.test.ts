import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids, confirmPayment } from "./fixture";
import { findSupplierBatch } from "../lib/provider-order-search";

let db: PGlite;
before(async () => { db = await createDatabase(); });
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec("truncate public.orders cascade"); });
async function order(paid = true) {
  const { rows } = await db.query<{ result: { order: { id: string }; robux: { supplier_request_id: string } } }>(
    "select public.create_robux_store_order($1,$2,$3,'000201-pix-ficticio-nao-pagar',36,'tax_not_paid',1000,1000,700,'https://www.roblox.com/game-pass/123456','123456','ClienteRoblox',25,36,25) result",
    [ids.user, randomUUID(), `TEST-${randomUUID()}`],
  );
  if (paid) await confirmPayment(db, rows[0].result.order.id, "awaiting_payment");
  return { id: rows[0].result.order.id, request: rows[0].result.robux.supplier_request_id };
}
const claim = (id: string, request: string) => db.query<{ r: { supplier_request_id: string } }>("select public.claim_gamepass_execution($1,$2,$3) r", [id, ids.admin, request]);
test("duas sessões não executam juntas; timeout mantém chave e bloqueia cancelamento", async () => {
  const o = await order();
  const results = await Promise.allSettled([claim(o.id, o.request), claim(o.id, o.request)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  await assert.rejects(db.query("select public.transition_store_order($1,$2,'cancelled','paid','')", [o.id, ids.admin]), /Reconcilie/);
  await db.query("update public.robux_orders set execution_lease_until=now()-interval '1 second' where order_id=$1", [o.id]);
  assert.equal((await claim(o.id, o.request)).rows[0].r.supplier_request_id, o.request);
});
test("somente cancelamento definitivo do fornecedor permite nova chave, uma vez", async () => {
  const o = await order();
  await db.query("update public.robux_orders set supplier_status='CANCELLED',supplier_batch_id='old-batch' where order_id=$1", [o.id]);
  const next = (await claim(o.id, o.request)).rows[0].r.supplier_request_id;
  assert.notEqual(next, o.request);
  await assert.rejects(claim(o.id, o.request), /Outro administrador/);
  assert.equal((await db.query("select * from public.order_admin_events where action='gamepass:retry_cancelled'")).rows.length, 1);
});
test("resultado do fornecedor e preparação são gravados juntos; conclusão exige COMPLETED", async () => {
  const o = await order();
  await claim(o.id, o.request);
  const finish = () => db.query("select public.finish_gamepass_execution($1,$2,$3,'batch-test',25,25)", [o.id, ids.admin, o.request]);
  await finish(); await finish();
  await assert.rejects(db.query("select public.transition_store_order($1,$2,'delivered','preparing_delivery','')", [o.id, ids.admin]), /fornecedor/);
  await db.query("update public.robux_orders set supplier_status='COMPLETED' where order_id=$1", [o.id]);
  await db.query("select public.transition_store_order($1,$2,'delivered','preparing_delivery','')", [o.id, ids.admin]);
  assert.equal((await db.query("select * from public.order_admin_events where action='status:preparing_delivery'")).rows.length, 1);
});
test("sem pagamento, não se reserva execução nem se compra Game Pass", async () => {
  const o = await order(false);
  await assert.rejects(claim(o.id, o.request), /Confirme o pagamento/);
});
test("conciliação encontra lote além dos primeiros 50 e recusa respostas truncadas/inválidas", async () => {
  const pages: number[] = [];
  const found = await findSupplierBatch("older-batch", async page => {
    pages.push(page);
    return { orders: page === 3 ? [{ batchId: "older-batch", status: "COMPLETED" }] : [], pagination: { totalPages: 3 } };
  });
  assert.equal(found?.status, "COMPLETED");
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(await findSupplierBatch("missing", async () => ({ orders: [], pagination: { totalPages: 1 } })), null);
  await assert.rejects(findSupplierBatch("missing", async () => ({ orders: [], pagination: { totalPages: 21 } })), /limite/);
});
