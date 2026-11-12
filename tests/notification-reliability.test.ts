import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids, confirmPayment } from "./fixture";
import { notificationFetch } from "../lib/notification-http";

let db: PGlite;
before(async () => { db = await createDatabase(); });
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec("truncate public.orders cascade; update public.products set stock=10"); });
async function order() {
  const { rows } = await db.query<{ r: { order: { id: string } } }>("select public.create_store_order($1,$2,'ClienteTeste',$3,'000201-pix-ficticio-nao-pagar',$4::jsonb,20) r", [ids.user, randomUUID(), `TEST-${randomUUID()}`, JSON.stringify([{ id: ids.a, quantity: 1, unit_price: 20 }])]);
  const id = rows[0].r.order.id;
  await confirmPayment(db, id, "awaiting_payment");
  return id;
}
async function claim(id: string, manual = false) {
  return (await db.query<{ token: string | null }>("select public.claim_order_email($1,'payment',$2) token", [id, manual])).rows[0].token;
}
test("evento de pagamento e fila são atômicos; só uma sessão obtém envio", async () => {
  const id = await order();
  assert.equal((await db.query("select * from public.order_email_jobs")).rows.length, 1);
  const tokens = await Promise.all([claim(id), claim(id)]);
  assert.equal(tokens.filter(Boolean).length, 1);
  const token = tokens.find(Boolean);
  await db.query("select public.finish_order_email($1,'payment',$2,'sent','')", [id, token]);
  assert.equal(await claim(id), null);
  assert.ok((await db.query<{ payment_email_sent_at: string }>("select payment_email_sent_at from public.orders where id=$1", [id])).rows[0].payment_email_sent_at);
});
test("interrupção ambígua não reenvia automaticamente; administrador precisa conferir provedor", async () => {
  const id = await order();
  const old = await claim(id);
  await db.query("update public.order_email_jobs set lease_until=now()-interval '1 second' where order_id=$1", [id]);
  assert.equal(await claim(id), null);
  assert.equal((await db.query<{ status: string }>("select status from public.order_email_jobs where order_id=$1", [id])).rows[0].status, "uncertain");
  assert.equal(await claim(id), null);
  const next = await claim(id, true);
  assert.ok(next);
  await assert.rejects(db.query("select public.finish_order_email($1,'payment',$2,'sent','')", [id, old]), /execução/);
});
test("falha anterior ao envio permite retry; não muda pagamento nem estoque", async () => {
  const id = await order(), token = await claim(id);
  await db.query("select public.finish_order_email($1,'payment',$2,'failed','Falha simulada antes do SMTP')", [id, token]);
  assert.equal(await claim(id), null); // backoff
  await db.query("update public.order_email_jobs set next_attempt_at=now()-interval '1 second' where order_id=$1", [id]);
  assert.ok(await claim(id));
  assert.equal((await db.query<{ status: string }>("select status from public.orders where id=$1", [id])).rows[0].status, "paid");
  assert.equal((await db.query<{ stock: number }>("select stock from public.products where id=$1", [ids.a])).rows[0].stock, 9);
});
test("Discord 401/429/500 é falha e não inclui corpo sensível no erro; HTTP 204 é sucesso", async () => {
  for (const status of [401, 429, 500]) {
    await assert.rejects(notificationFetch("https://example.invalid/webhook", {}, async (_url, init) => {
      assert.ok(init?.signal);
      return new Response("conteudo-privado-que-nao-deve-sair", { status });
    }), error => error instanceof Error && error.message.includes(String(status)) && !error.message.includes("privado"));
  }
  assert.equal((await notificationFetch("https://example.invalid/webhook", {}, async () => new Response(null, { status: 204 }))).status, 204);
});
