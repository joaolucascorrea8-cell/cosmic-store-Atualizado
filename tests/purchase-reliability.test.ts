import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids, confirmPayment } from "./fixture";
import { orderFinance } from "../lib/order-finance";

let db: PGlite;
before(async () => { db = await createDatabase(); });
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`reset role; truncate public.orders cascade;
    update public.products set stock=1,unlimited_stock=false,is_active=true;
    update public.store_ops_settings set auto_close_enabled=false;`);
});
async function order(token = randomUUID(), buyer = ids.user) {
  const { rows } = await db.query<{ r: { created: boolean; order: { id: string } } }>(
    "select public.create_store_order_with_coupon($1,$2,'ClienteTeste',$3,'000201-pix-ficticio-nao-pagar',$4::jsonb,20,'') r",
    [buyer, token, `TEST-${randomUUID()}`, JSON.stringify([{ id: ids.a, kind: "product", quantity: 1, unit_price: 20 }])],
  );
  return rows[0].r;
}
async function stock() { return Number((await db.query<{ stock: number }>("select stock from public.products where id=$1", [ids.a])).rows[0].stock); }

test("última unidade fica reservada antes do Pix; segundo checkout não cria pedido", async () => {
  const results = await Promise.allSettled([order(), order(randomUUID(), ids.admin)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await stock(), 0);
  assert.equal((await db.query("select * from public.orders")).rows.length, 1);
});
test("retry do mesmo token recupera a reserva e não desconta estoque novamente", async () => {
  const token = randomUUID();
  const first = await order(token), repeat = await order(token);
  assert.equal(first.order.id, repeat.order.id);
  assert.equal(repeat.created, false);
  assert.equal(await stock(), 0);
});
test("cancelar sem pagamento libera a reserva exatamente uma vez", async () => {
  const first = await order();
  for (let n = 0; n < 2; n++) await db.query("select public.transition_store_order($1,$2,'cancelled','awaiting_payment','')", [first.order.id, ids.admin]);
  assert.equal(await stock(), 1);
  assert.equal((await order()).created, true);
});
test("expiração opt-in libera reserva sem comprovante e preserva histórico", async () => {
  const first = await order();
  await db.exec(`update public.store_ops_settings set auto_close_enabled=true,auto_close_hours=24,enabled_by='${ids.admin}',enabled_at=now()-interval '3 days';
    update public.orders set created_at=now()-interval '2 days';`);
  // updated_at é protegido pelo trigger; o relógio antigo é simulado explicitamente no fixture.
  await db.exec("alter table public.orders disable trigger orders_updated_at; update public.orders set updated_at=created_at; alter table public.orders enable trigger orders_updated_at;");
  assert.equal((await db.query<{ n: number }>("select public.ops_expire_orders() n")).rows[0].n, 1);
  assert.equal(await stock(), 1);
  assert.equal((await db.query("select * from public.orders where id=$1", [first.order.id])).rows.length, 1);
});

async function confirm(id: string, { amount = 20, reference = `BANK-${randomUUID()}`, verified = true, actor = ids.admin, reason = "Conferido no extrato fictício" } = {}) {
  return db.query("select public.confirm_manual_store_payment($1,$2,'awaiting_payment',$3,$4,$5,$6)", [id, actor, amount, reference, verified, reason]);
}
async function refund(id: string, amount: number, token = randomUUID(), reference = `REFUND-${randomUUID()}`) {
  return db.query("select public.record_manual_store_refund($1,$2,$3,$4,$5,'Devolução fictícia conferida no banco',true)", [id, ids.admin, token, amount, reference]);
}
test("comprovante ou transição direta não confirma banco; conferência exige valor, referência e administrador", async () => {
  const { order: o } = await order();
  await assert.rejects(db.query("select public.transition_store_order($1,$2,'paid','awaiting_payment','')", [o.id, ids.admin]), /extrato/);
  await assert.rejects(confirm(o.id, { verified: false }), /extrato/);
  await assert.rejects(confirm(o.id, { amount: 19 }), /valor recebido/);
  await assert.rejects(confirm(o.id, { reference: "curta" }), /referência/);
  await assert.rejects(confirm(o.id, { actor: ids.user }), /Acesso/);
  await assert.rejects(confirm(o.id, { reason: "" }), /excepcional/);
  assert.equal((await db.query("select * from public.order_payment_confirmations")).rows.length, 0);
  await confirm(o.id);
  assert.equal(await stock(), 0); // já reservado; confirmação não baixa de novo
});
test("uma transação bancária não confirma dois pedidos e o retry não gera eventos extras", async () => {
  await db.exec("update public.products set stock=2");
  const a = await order(), b = await order(), reference = `BANK-${randomUUID()}`;
  await Promise.all([confirm(a.order.id, { reference }), confirm(a.order.id, { reference })]);
  await assert.rejects(confirm(b.order.id, { reference }), /já foi registrada/);
  assert.equal((await db.query("select * from public.order_payment_confirmations")).rows.length, 1);
  assert.equal((await db.query("select * from public.order_admin_events where action='status:paid'")).rows.length, 1);
});
test("cancelamento de pedido pago preserva pagamento e não inventa reembolso", async () => {
  const { order: o } = await order();
  await confirmPayment(db, o.id, "awaiting_payment");
  await db.query("select public.transition_store_order($1,$2,'cancelled','paid','')", [o.id, ids.admin]);
  assert.equal((await db.query("select * from public.order_refunds")).rows.length, 0);
  assert.ok((await db.query<{ paid_at: string }>("select paid_at from public.orders where id=$1", [o.id])).rows[0].paid_at);
  assert.equal(await stock(), 1);
});
test("reembolso parcial e integral são idempotentes, não excedem total e não executam transferências", async () => {
  const { order: o } = await order();
  await assert.rejects(refund(o.id, 10), /Não há pagamento/);
  await confirmPayment(db, o.id, "awaiting_payment");
  const token = randomUUID(), reference = `REFUND-${randomUUID()}`;
  await Promise.all([refund(o.id, 5, token, reference), refund(o.id, 5, token, reference)]);
  await assert.rejects(refund(o.id, 5, randomUUID(), reference), /já foi registrada/);
  await assert.rejects(refund(o.id, 16), /supera/);
  await refund(o.id, 15);
  assert.equal((await db.query("select * from public.order_refunds")).rows.length, 2);
  assert.equal((await db.query<{ status: string }>("select status from public.orders where id=$1", [o.id])).rows[0].status, "paid");
});
test("cliente não executa operações financeiras nem lê referências bancárias", async () => {
  const { order: o } = await order();
  await confirmPayment(db, o.id, "awaiting_payment");
  await refund(o.id, 5);
  await credit(o.id, 1);
  await db.exec(`grant usage on schema public,auth to authenticated; grant select on public.orders to authenticated;
    set role authenticated; select set_config('request.jwt.claim.sub','${ids.user}',false);`);
  await assert.rejects(db.query("select * from public.order_payment_confirmations"), /permission denied/);
  await assert.rejects(db.query("select bank_reference from public.order_refunds"), /permission denied/);
  await assert.rejects(db.query("select bank_reference from public.order_additional_payments"), /permission denied/);
  await assert.rejects(db.query("select public.store_financial_summary(now()-interval '1 day',now())"), /permission denied/);
  assert.equal((await db.query("select id,amount from public.order_additional_payments")).rows.length, 1);
  assert.equal((await db.query("select id,amount from public.order_refunds")).rows.length, 1);
  await db.exec(`select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000099',false);`);
  assert.equal((await db.query("select id,amount from public.order_refunds")).rows.length, 0);
  await assert.rejects(confirm(o.id), /permission denied/);
});

async function credit(id: string, amount: number, reference = `CREDIT-${randomUUID()}`, token = randomUUID()) {
  return db.query("select public.record_additional_store_payment($1,$2,$3,$4,$5,'Pix excepcional fictício conferido no banco',true)", [id, ids.admin, token, amount, reference]);
}
test("Pix tardio é registrado e devolvido sem reabrir pedido nem reservar estoque", async () => {
  const { order: o } = await order();
  await db.query("select public.transition_store_order($1,$2,'cancelled','awaiting_payment','')", [o.id, ids.admin]);
  await credit(o.id, 20);
  await refund(o.id, 20);
  const state = (await db.query<{ status: string; paid_at: string | null }>("select status,paid_at from public.orders where id=$1", [o.id])).rows[0];
  assert.equal(state.status, "cancelled"); assert.equal(state.paid_at, null); assert.equal(await stock(), 1);
  await assert.rejects(refund(o.id, 1), /supera/);
});
test("pagamento bancário repetido é conciliado sem duplicar pedido; devolução usa o total recebido real", async () => {
  const { order: o } = await order();
  await confirmPayment(db, o.id, "awaiting_payment");
  const reference = `CREDIT-${randomUUID()}`, token = randomUUID();
  await credit(o.id, 20, reference, token); await credit(o.id, 20, reference, token);
  await refund(o.id, 25); // maior que total do pedido, menor que os dois Pix recebidos
  await assert.rejects(refund(o.id, 16), /supera/);
  assert.equal((await db.query("select * from public.orders")).rows.length, 1);
  const totals = orderFinance(20, true, [{ amount: 20 }], [{ amount: 25 }]);
  assert.deepEqual(totals, { received: 40, refunded: 25, remaining: 15 });
});
test("referência excepcional não confirma outro pedido; promoção do mesmo crédito não conta duas vezes", async () => {
  await db.exec("update public.products set stock=2");
  const a = await order(), b = await order(), reference = `CREDIT-${randomUUID()}`;
  await credit(a.order.id, 20, reference);
  await assert.rejects(confirm(b.order.id, { reference }), /outro recebimento/);
  await confirm(a.order.id, { reference });
  const row = (await db.query<{ amount: number; used_for_confirmation: boolean }>("select amount,used_for_confirmation from public.order_additional_payments")).rows[0];
  assert.equal(row.used_for_confirmation, true);
  assert.deepEqual(orderFinance(20, true, [row], []), { received: 20, refunded: 0, remaining: 20 });
  await assert.rejects(credit(b.order.id, 20, reference), /já foi registrada/);
});
test("crédito devolvido não pode liberar compra nem entrega", async () => {
  const { order: o } = await order(), reference = `CREDIT-${randomUUID()}`;
  await credit(o.id, 20, reference); await refund(o.id, 20);
  await assert.rejects(confirm(o.id, { reference }), /já foi devolvido/);
  assert.equal((await db.query<{ status: string }>("select status from public.orders where id=$1", [o.id])).rows[0].status, "awaiting_payment");
  assert.equal((await db.query("select * from public.order_payment_confirmations")).rows.length, 0);
});
test("relatório financeiro mantém recebimento cancelado e não duplica crédito promovido", async () => {
  const { order: o } = await order(), reference = `CREDIT-${randomUUID()}`;
  await credit(o.id, 20, reference); await confirm(o.id, { reference });
  await db.query("select public.transition_store_order($1,$2,'cancelled','paid','')", [o.id, ids.admin]);
  await refund(o.id, 5);
  const { rows } = await db.query<{ r: { received: number; refunded: number; net: number } }>("select public.store_financial_summary(now()-interval '1 day',now()+interval '1 day') r");
  assert.deepEqual(rows[0].r, { received: 20, refunded: 5, net: 15 });
});
