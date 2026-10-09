import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
let db: PGlite;
before(async () => {
  db = await createDatabase();
});
after(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate public.orders cascade;update public.robux_account_settings set margin_per_thousand=9,enabled=true;update public.robux_account_catalog set lease_until=null,next_attempt_at=now(),last_error=null;truncate public.robux_account_request_limits;",
  );
});
const offer = () => ({
  id: "a".repeat(64),
  providerId: "account000660",
  maskedId: "******660",
  robux: 1990,
  quoteId: "b".repeat(64),
  quoteUrl: "https://www.byrobux.net/accounts/MTMz?catalog=alternate",
  supplierK: 26.93,
  supplierPrice: 53.59,
  seenAt: new Date().toISOString(),
});
async function order(
  token = randomUUID(),
  expected = 71.5,
  selected = offer(),
) {
  const { rows } = await db.query<{
    result: { created: boolean; order: { id: string; total: string } };
  }>(
    "select public.create_robux_account_order($1,$2,$3,'000201-pix-payload-valido-para-teste',$4::jsonb,$5) result",
    [
      ids.user,
      token,
      `COSMIC-${randomUUID()}`,
      JSON.stringify(selected),
      expected,
    ],
  );
  return rows[0].result;
}
async function transition(id: string, status: string, expected: string) {
  return db.query(
    "select public.transition_store_order($1,$2,$3,$4,'Motivo de teste')",
    [id, ids.admin, status, expected],
  );
}
test("cria pedido no fluxo existente, snapshot e item; retry é idempotente", async () => {
  const token = randomUUID(),
    first = await order(token),
    repeat = await order(token);
  assert.equal(first.order.id, repeat.order.id);
  assert.equal(repeat.created, false);
  const snapshot = (
    await db.query<{
      quote_url: string;
      margin_per_thousand: string;
      supplier_cost: string;
    }>("select * from public.robux_account_orders")
  ).rows[0];
  assert.equal(snapshot.quote_url, offer().quoteUrl);
  assert.equal(Number(snapshot.margin_per_thousand), 9);
  assert.equal(Number(snapshot.supplier_cost), 53.59);
  assert.equal(
    (await db.query("select * from public.order_items")).rows.length,
    1,
  );
});
test("margem atual recalcula e preço antigo/stale recusam pedido sem órfãos", async () => {
  await db.exec(
    "update public.robux_account_settings set margin_per_thousand=10",
  );
  await assert.rejects(order(), /preço mudou/);
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
  assert.equal(Number((await order(undefined, 73.49)).order.total), 73.49);
  const selected = {
    ...offer(),
    providerId: "account000123",
    id: "c".repeat(64),
    seenAt: "2020-01-01T00:00:00Z",
  };
  await assert.rejects(order(undefined, 73.49, selected), /Valide/);
});
test("reserva transacional impede segundo pedido da mesma conta e expira só sem comprovante", async () => {
  const first = await order();
  await assert.rejects(order(), /outro pedido/);
  // Aging requires bypassing the immutable snapshot trigger only in the isolated test database.
  await db.exec(
    "alter table public.robux_account_orders disable trigger guard_robux_account_snapshot;update public.robux_account_orders set reservation_until=now()-interval '1 second';alter table public.robux_account_orders enable trigger guard_robux_account_snapshot;",
  );
  await assert.rejects(
    db.query("update public.orders set status='proof_submitted' where id=$1", [
      first.order.id,
    ]),
    /reserva expirou/,
  );
  const next = await order();
  assert.notEqual(next.order.id, first.order.id);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.orders where id=$1",
        [first.order.id],
      )
    ).rows[0].status,
    "cancelled",
  );
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [next.order.id],
  );
  await assert.rejects(order(), /outro pedido/);
});
test("falha de consulta não apaga cache; lease e rate limit impedem chamadas simultâneas", async () => {
  await db.query(
    "update public.robux_account_catalog set offers=$1::jsonb,quotes=$2::jsonb,last_success_at=now()",
    [JSON.stringify([offer()]), JSON.stringify([{ id: "quote" }])],
  );
  const a = (
    await db.query<{ ok: boolean }>(
      "select public.robux_account_claim_sync($1) ok",
      [randomUUID()],
    )
  ).rows[0].ok;
  const b = (
    await db.query<{ ok: boolean }>(
      "select public.robux_account_claim_sync($1) ok",
      [randomUUID()],
    )
  ).rows[0].ok;
  assert.equal(a, true);
  assert.equal(b, false);
  await db.exec(
    "update public.robux_account_catalog set last_error='HTTP 503',lease_until=null,lease_token=null",
  );
  assert.equal(
    (
      await db.query<{ offers: unknown[] }>(
        "select offers from public.robux_account_catalog",
      )
    ).rows[0].offers.length,
    1,
  );
  assert.equal(
    (
      await db.query<{ ok: boolean }>(
        "select public.robux_account_take_limit('quote:1',5) ok",
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await db.query<{ ok: boolean }>(
        "select public.robux_account_take_limit('quote:1',5) ok",
      )
    ).rows[0].ok,
    false,
  );
});
test("snapshot é imutável; confirmação exige disponibilidade fresca; aquisição é manual", async () => {
  const first = await order();
  await assert.rejects(
    db.exec("update public.robux_account_orders set supplier_cost=1"),
    /snapshot original/,
  );
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [first.order.id],
  );
  await db.exec(
    "update public.robux_account_orders set availability='unknown'",
  );
  await assert.rejects(
    transition(first.order.id, "paid", "proof_submitted"),
    /Revalide/,
  );
  await db.exec(
    "update public.robux_account_orders set availability='available',last_validated_at=now()",
  );
  await transition(first.order.id, "paid", "proof_submitted");
  assert.equal(
    (
      await db.query<{ fulfillment_status: string }>(
        "select fulfillment_status from public.robux_account_order_details",
      )
    ).rows[0].fulfillment_status,
    "awaiting_acquisition",
  );
  await transition(first.order.id, "preparing_delivery", "paid");
  await assert.rejects(
    transition(first.order.id, "delivered", "preparing_delivery"),
    /imagem da entrega|aquisição/,
  );
  await db.query("select public.mark_robux_account_acquired($1,$2)", [
    first.order.id,
    ids.admin,
  ]);
  assert.equal(
    (
      await db.query<{ fulfillment_status: string }>(
        "select fulfillment_status from public.robux_account_order_details",
      )
    ).rows[0].fulfillment_status,
    "acquired",
  );
  await db.query(
    "insert into public.order_messages(order_id,user_id,message,attachment_path,attachment_type) values($1,$2,'Dados enviados','delivery.png','image/png')",
    [first.order.id, ids.admin],
  );
  await transition(first.order.id, "delivered", "preparing_delivery");
  assert.equal(
    (
      await db.query<{ fulfillment_status: string }>(
        "select fulfillment_status from public.robux_account_order_details",
      )
    ).rows[0].fulfillment_status,
    "delivered",
  );
});
test("RLS cliente lê só detalhes seguros, admin lê snapshot, RPCs não acessíveis ao cliente", async () => {
  const first = await order();
  await db.exec("grant select on public.orders to authenticated;");
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${ids.user}',false);`,
  );
  assert.equal(
    (await db.query("select * from public.robux_account_orders")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.robux_account_catalog")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.robux_account_settings")).rows.length,
    0,
  );
  const safe = (
    await db.query<Record<string, unknown>>(
      "select * from public.robux_account_order_details",
    )
  ).rows[0];
  assert(safe);
  assert.equal("supplier_cost" in safe, false);
  assert.equal("quote_url" in safe, false);
  await assert.rejects(
    db.query("select public.mark_robux_account_acquired($1,$2)", [
      first.order.id,
      ids.user,
    ]),
    /permission denied/,
  );
  await db.exec(
    `select set_config('request.jwt.claim.sub','${ids.admin}',false);`,
  );
  assert.equal(
    (await db.query("select * from public.robux_account_orders")).rows.length,
    1,
  );
  await db.exec("reset role;set role anon;");
  await assert.rejects(
    db.exec("select * from public.robux_account_catalog"),
    /permission denied/,
  );
  await db.exec("reset role;");
});
test("Quick Buy anterior continua criando pedido, guardando GamePass e confirmando pagamento", async () => {
  const { rows } = await db.query<{ result: { order: { id: string } } }>(
    "select public.create_robux_store_order($1,$2,$3,'000201-pix-payload-valido-para-teste',34,'tax_not_paid',1000,1000,700,'https://www.roblox.com/game-pass/123456','123456','ClienteRoblox',25,34,25) result",
    [ids.user, randomUUID(), `COSMIC-${randomUUID()}`],
  );
  const id = rows[0].result.order.id;
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [id],
  );
  await transition(id, "paid", "proof_submitted");
  assert.equal(
    (
      await db.query<{ order_type: string }>(
        "select order_type from public.orders where id=$1",
        [id],
      )
    ).rows[0].order_type,
    "robux",
  );
  assert.equal(
    (
      await db.query<{ gamepass_id: string }>(
        "select gamepass_id from public.robux_orders where order_id=$1",
        [id],
      )
    ).rows[0].gamepass_id,
    "123456",
  );
});
test("grupo fourth bloqueia compras simultâneas e só libera nova unidade após entrega manual", async () => {
  const group = {
    ...offer(),
    providerId: "fourth:128:1990:254720",
    publicCount: 3,
  };
  const first = await order(undefined, 71.5, group);
  await assert.rejects(order(undefined, 71.5, group), /outro pedido/);
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [first.order.id],
  );
  await transition(first.order.id, "paid", "proof_submitted");
  await transition(first.order.id, "preparing_delivery", "paid");
  await db.query("select public.mark_robux_account_acquired($1,$2)", [
    first.order.id,
    ids.admin,
  ]);
  await assert.rejects(order(undefined, 71.5, group), /disponível/);
  await db.query(
    "insert into public.order_messages(order_id,user_id,message,attachment_path,attachment_type) values($1,$2,'Dados enviados','delivery.png','image/png')",
    [first.order.id, ids.admin],
  );
  await transition(first.order.id, "delivered", "preparing_delivery");
  const second = await order(undefined, 71.5, group);
  assert.notEqual(second.order.id, first.order.id);
});
test("SQL de verificação executa e confirma RLS/privilegios sem acessar credenciais", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(
    "supabase/verificacoes/202610090001_check.sql",
    "utf8",
  );
  const results = await db.exec(sql);
  assert.equal(results[0].rows.length, 6);
  assert(results[0].rows.every((row) => row.exists && row.rls_enabled));
  assert(
    results[2].rows.every(
      (row) =>
        !row.anon_can_execute &&
        !row.customer_can_execute &&
        row.server_can_execute,
    ),
  );
});
test("duas criações concorrentes deixam somente um pedido ativo da mesma oferta", async () => {
  const result = await Promise.allSettled([order(), order()]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(result.filter((r) => r.status === "rejected").length, 1);
  assert.equal((await db.query("select * from public.orders")).rows.length, 1);
});
