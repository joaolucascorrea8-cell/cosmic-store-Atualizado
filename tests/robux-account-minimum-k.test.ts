import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import { calculateCosmicPrice, publicOffer, hashKey } from "../lib/providers/byrobux/accounts-parser";
import { groupAccountOptions } from "../lib/robux-accounts/presentation";

const migration = "202610100001_robux_account_minimum_k.sql";
let db: PGlite;
let initialSettings: Record<string, unknown>;
before(async () => {
  db = await createDatabase();
  initialSettings = (await db.query<Record<string, unknown>>("select * from public.robux_account_settings")).rows[0];
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("reset role;truncate public.orders cascade;update public.robux_account_settings set min_cosmic_k=34,margin_per_thousand=5,enabled=true;");
});
function offer(supplierK = 29, robux = 1990) {
  const providerId = randomUUID();
  const quoteUrl = "https://www.byrobux.net/accounts/MTMz?catalog=alternate";
  return {
    id: hashKey(quoteUrl + "|" + providerId), providerId, maskedId: "***660",
    robux, supplierK, supplierPrice: Math.round(robux * supplierK / 10) / 100,
    quoteId: hashKey(quoteUrl), quoteUrl, seenAt: new Date().toISOString(),
  };
}
async function order(database: PGlite, selected: ReturnType<typeof offer>, expected: number, token = randomUUID()) {
  const { rows } = await database.query<{ result: { created: boolean; order: { id: string; total: number } } }>(
    "select public.create_robux_account_order_with_policy($1,$2,$3,'000201-pix-payload-valido-para-teste',$4::jsonb,$5,(select version from public.robux_account_policy where id=1),true) result",
    [ids.user, token, `COSMIC-${randomUUID()}`, JSON.stringify(selected), expected],
  );
  return rows[0].result;
}

test("regra aprovada mantém K 34 até fornecedor 29 e sobe centavo a centavo acima", () => {
  for (const [supplierK, cosmicK] of [[25,34],[27,34],[28.99,34],[29,34],[29.01,34.01],[29.5,34.5],[30,35],[32,37]]) {
    assert.deepEqual(calculateCosmicPrice(1000, supplierK, 5, 34), { cosmicK, price: cosmicK });
  }
  assert.deepEqual(calculateCosmicPrice(1990, 26.93, 5, 34), { cosmicK: 34, price: 67.66 });
  assert.deepEqual(calculateCosmicPrice(1990, 29.5, 5, 34), { cosmicK: 34.5, price: 68.66 });
  assert.deepEqual(calculateCosmicPrice(250, 29.5, 5, 34), { cosmicK: 34.5, price: 8.63 });
  assert.deepEqual(calculateCosmicPrice(1000, 29, 6, 36), { cosmicK: 36, price: 36 });
  assert.deepEqual(calculateCosmicPrice(1000, 31, 6, 36), { cosmicK: 37, price: 37 });
  for (const minimum of [-1, NaN, Infinity]) assert.throws(() => calculateCosmicPrice(1000, 29, 5, minimum));
});

test("migration instala a configuração 34/5 e banco coincide com cálculo do catálogo", async () => {
  assert.equal(Number(initialSettings.min_cosmic_k), 34);
  assert.equal(Number(initialSettings.margin_per_thousand), 5);
  for (const [supplierK, robux] of [[25,1990],[29,1000],[29.01,1990],[29.5,250],[32,1000]]) {
    const selected = offer(supplierK, robux);
    const safe = publicOffer(selected, 5, 34);
    const created = await order(db, selected, safe.price);
    assert.equal(Number(created.order.total), safe.price);
    const row = (await db.query<Record<string, unknown>>("select * from public.robux_account_orders where order_id=$1", [created.order.id])).rows[0];
    assert.equal(Number(row.min_cosmic_k), 34);
    assert.equal(Number(row.margin_per_thousand), 5);
    assert.equal(Number(row.cosmic_k), safe.cosmicK);
    assert.equal(row.quote_url, selected.quoteUrl);
    assert.equal(row.offer_id, selected.id);
  }
});

test("mudança de mínimo ou acréscimo exige novo preço e preserva snapshot e retry", async () => {
  const selected = offer(), token = randomUUID();
  const created = await order(db, selected, 67.66, token);
  await db.exec("update public.robux_account_settings set min_cosmic_k=36");
  const next = offer();
  await assert.rejects(order(db, next, 67.66), /preço mudou/);
  assert.equal((await db.query("select * from public.orders")).rows.length, 1);
  assert.equal(Number((await order(db, next, 71.64)).order.total), 71.64);
  await db.exec("update public.robux_account_settings set margin_per_thousand=8");
  await assert.rejects(order(db, offer(), 71.64), /preço mudou/);
  assert.equal(Number((await order(db, offer(), 73.63)).order.total), 73.63);
  const retry = await order(db, selected, 67.66, token);
  assert.equal(retry.created, false);
  assert.equal(retry.order.id, created.order.id);
  assert.equal(Number(retry.order.total), 67.66);
  const snapshot = (await db.query<Record<string, unknown>>("select * from public.robux_account_orders where order_id=$1", [created.order.id])).rows[0];
  assert.equal(Number(snapshot.min_cosmic_k), 34);
  assert.equal(Number(snapshot.margin_per_thousand), 5);
  await assert.rejects(db.query("update public.robux_account_orders set min_cosmic_k=1 where order_id=$1", [created.order.id]), /snapshot original/);
});

test("ofertas com K público igual agrupam na vitrine sem perder a origem no pedido", async () => {
  const a = offer(25), b = offer(29);
  b.quoteUrl = "https://www.byrobux.net/accounts/MTMz?catalog=fourth";
  b.quoteId = hashKey(b.quoteUrl); b.id = hashKey(b.quoteUrl + "|" + b.providerId);
  const safeA = publicOffer(a, 5, 34), safeB = publicOffer(b, 5, 34);
  assert.deepEqual(Object.keys(safeA).sort(), ["cosmicK","id","price","robux"]);
  const grouped = groupAccountOptions([{ ...safeA, available: true }, { ...safeB, available: true }]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].options, 2);
  const selected = grouped[0].id === a.id ? a : b;
  const created = await order(db, selected, grouped[0].price);
  const row = (await db.query<Record<string, unknown>>("select * from public.robux_account_orders where order_id=$1", [created.order.id])).rows[0];
  assert.equal(row.quote_url, selected.quoteUrl);
  assert.equal(row.quote_id, selected.quoteId);
  assert.equal(Number(row.supplier_k), selected.supplierK);
  await db.exec(`grant select on public.orders to authenticated;set role authenticated;select set_config('request.jwt.claim.sub','${ids.user}',false);`);
  assert.equal((await db.query("select * from public.robux_account_settings")).rows.length, 0);
  assert.equal((await db.query("select * from public.robux_account_orders")).rows.length, 0);
  const safe = (await db.query<Record<string, unknown>>("select * from public.robux_account_order_details")).rows[0];
  assert.deepEqual(Object.keys(safe).sort(), ["cosmic_k","fulfillment_status","order_id","robux","sale_price"]);
  await db.exec("reset role");
});

test("upgrade preserva pedidos antigos, política, Quick Buy e regras de entrega", async () => {
  const previous = await createDatabase("202610090002_robux_account_delivery_policy.sql");
  try {
    const selected = offer(26.93), token = randomUUID();
    const created = await order(previous, selected, 71.5, token);
    const beforeSnapshot = (await previous.query<Record<string, unknown>>("select * from public.robux_account_orders")).rows[0];
    const beforeOrders = (await previous.query("select * from public.orders")).rows;
    const beforeItems = (await previous.query("select * from public.order_items")).rows;
    const beforeAcceptance = (await previous.query("select * from public.robux_account_policy_acceptances")).rows;
    const functionsSql = "select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_robux_store_order','transition_store_order','guard_robux_account_credentials') order by p.proname";
    const beforeFunctions = (await previous.query(functionsSql)).rows;
    await previous.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    const afterSnapshot = (await previous.query<Record<string, unknown>>("select * from public.robux_account_orders")).rows[0];
    assert.equal(afterSnapshot.min_cosmic_k, null);
    delete afterSnapshot.min_cosmic_k;
    assert.deepEqual(afterSnapshot, beforeSnapshot);
    assert.deepEqual((await previous.query("select * from public.orders")).rows, beforeOrders);
    assert.deepEqual((await previous.query("select * from public.order_items")).rows, beforeItems);
    assert.deepEqual((await previous.query("select * from public.robux_account_policy_acceptances")).rows, beforeAcceptance);
    assert.deepEqual((await previous.query(functionsSql)).rows, beforeFunctions);
    const retry = await order(previous, selected, 71.5, token);
    assert.equal(retry.order.id, created.order.id);
    assert.equal(Number(retry.order.total), 71.5);
    assert.equal(Number((await order(previous, offer(26.93), 67.66)).order.total), 67.66);
  } finally { await previous.close(); }
});

test("SQL de verificação confirma fórmula, RLS, snapshot e acesso restrito às RPCs", async () => {
  const result = await db.exec(await readFile("supabase/verificacoes/202610100001_check.sql", "utf8"));
  assert.equal(Number(result[0].rows[0].k_cosmic_minimo), 34);
  assert.equal(Number(result[0].rows[0].acrescimo_por_mil), 5);
  assert(result[3].rows.every(r => r.rls_enabled && !r.anon_can_read));
  assert(result[4].rows.every(r => !r.anon_can_execute && !r.customer_can_execute && r.server_can_execute === (r.proname === "create_robux_account_order_with_policy")));
  assert.equal(result[5].rows[0].snapshot_protegido, true);
  assert.equal(result[5].rows[0].formula_com_minimo_instalada, true);
  assert.equal(result[6].rows[0].detalhes_do_cliente_sem_dados_internos, true);
});
