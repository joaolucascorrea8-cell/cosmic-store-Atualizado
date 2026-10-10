import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import { robuxPrice, salePriceForGamepass } from "../lib/robux-pricing";
import { priceFromRobuxTable } from "../lib/robux-price-table";
import { calculateCosmicPrice, hashKey, publicOffer } from "../lib/providers/byrobux/accounts-parser";
import { compareAccountUnitPrice } from "../lib/robux-accounts/presentation";

const migration = "202610100002_robux_account_price_table.sql";
let db: PGlite;
before(async () => { db = await createDatabase(); });
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("reset role;truncate public.orders cascade;update public.robux_account_settings set min_cosmic_k=34,margin_per_thousand=5,enabled=true;");
});
function offer(robux = 500, supplierK = 29) {
  const providerId = randomUUID(), quoteUrl = "https://www.byrobux.net/accounts/MTMz?catalog=alternate";
  return { id: hashKey(quoteUrl+providerId), providerId, maskedId: "***660", robux,
    supplierK, supplierPrice: Math.round(robux*supplierK/10)/100,
    quoteId: hashKey(quoteUrl), quoteUrl, seenAt: new Date().toISOString() };
}
async function create(database: PGlite, selected: ReturnType<typeof offer>, expected: number, token = randomUUID()) {
  const result = await database.query<{ result: { created: boolean; order: { id: string; total: number } } }>(
    "select public.create_robux_account_order_with_policy($1,$2,$3,'000201-pix-payload-valido-para-teste',$4::jsonb,$5,(select version from public.robux_account_policy where id=1),true) result",
    [ids.user,token,`COSMIC-${randomUUID()}`,JSON.stringify(selected),expected],
  );
  return result.rows[0].result;
}

test("contas e produtos coincidem na tabela aprovada, inclusive abaixo de 1K", () => {
  for (const [q, price] of [[350,15],[400,16],[450,17],[500,18.55],[750,26.27],[1000,34],[1990,67.66]]) {
    assert.equal(robuxPrice(q,34),price);
    assert.deepEqual(calculateCosmicPrice(q,29,5,34),{ cosmicK:34,price });
  }
  for (const k of [29,34,34.5,35,40,10000]) {
    for (const q of [1,349,350,351,399,400,449,450,451,500,999,1000,1001,1000000])
      assert.equal(calculateCosmicPrice(q,k,0,0).price,robuxPrice(q,k));
  }
  assert.equal(salePriceForGamepass(500,34),17,"Quick Buy conserva sua regra própria");
  assert.equal(salePriceForGamepass(1429,34),48.59);
  assert.throws(() => robuxPrice(1000001,34),/inválida/);
  assert.throws(() => robuxPrice(500,10001),/inválida/);
});

test("SQL e TypeScript coincidem sem arredondamento intermediário em todos os saldos até 1K", async () => {
  const { rows } = await db.query<{ q: number; k: string; price: string }>(
    "select q,k,public.robux_account_table_price(q,k) price from generate_series(1,1001) q cross join (values(0.01::numeric),(29.01),(34),(34.5),(35),(40),(20000)) rates(k)",
  );
  for (const row of rows) assert.equal(Number(row.price),priceFromRobuxTable(row.q,Number(row.k)),`${row.q}/${row.k}`);
  for (const q of [1000000,10000000]) {
    const { rows: [row] } = await db.query<{ price: string }>("select public.robux_account_table_price($1,20000) price",[q]);
    assert.equal(Number(row.price),priceFromRobuxTable(q,20000));
  }
  // Arredondar primeiro a referência K34 causaria discrepância em alguns valores.
  assert.equal(calculateCosmicPrice(451,35,0,0).price,17.53);
});

test("checkout recusa preço proporcional antigo e salva valor, regra e K base na mesma transação", async () => {
  const selected=offer(), token=randomUUID();
  await assert.rejects(create(db,selected,17,token),/preço mudou/);
  assert.equal((await db.query("select * from public.orders")).rows.length,0);
  const created=await create(db,selected,18.55,token);
  const snapshot=(await db.query<Record<string,unknown>>("select * from public.robux_account_orders where order_id=$1",[created.order.id])).rows[0];
  assert.equal(Number(created.order.total),18.55);
  assert.equal(snapshot.pricing_rule,"product_table_v1");
  assert.equal(Number(snapshot.cosmic_k),34);
  assert.equal(Number(snapshot.sale_price),18.55);
  const item=(await db.query<{ unit_price: string }>("select unit_price from public.order_items where order_id=$1",[created.order.id])).rows[0];
  assert.equal(Number(item.unit_price),18.55);
  await assert.rejects(db.query("update public.robux_account_orders set pricing_rule='proportional_v1' where order_id=$1",[created.order.id]),/snapshot original/);
  await db.exec("update public.robux_account_settings set min_cosmic_k=40");
  await assert.rejects(create(db,offer(),18.55),/preço mudou/);
  assert.equal(Number((await create(db,offer(),robuxPrice(500,40))).order.total),robuxPrice(500,40));
  const retry=await create(db,selected,18.55,token);
  assert.equal(retry.created,false);
  assert.equal(Number(retry.order.total),18.55);
});

test("upgrade identifica regra antiga e preserva pedidos, configurações, políticas, entrega e Quick Buy", async () => {
  const previous=await createDatabase("202610100001_robux_account_minimum_k.sql");
  try {
    const selected=offer(), token=randomUUID();
    const old=await create(previous,selected,17,token);
    await previous.exec("update public.robux_account_settings set min_cosmic_k=36,margin_per_thousand=6");
    const tables=["orders","order_items","robux_account_order_details","robux_account_policy_acceptances","robux_account_settings"];
    const beforeRows=await Promise.all(tables.map(async t=>(await previous.query(`select * from public.${t}`)).rows));
    const oldSnapshot=(await previous.query<Record<string,unknown>>("select * from public.robux_account_orders")).rows[0];
    const functions="select proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('create_robux_store_order','transition_store_order','create_robux_account_order_with_policy','save_robux_account_delivery','guard_robux_account_credentials') order by proname";
    const beforeFunctions=(await previous.query(functions)).rows;
    await previous.exec(await readFile(`supabase/migrations/${migration}`,"utf8"));
    for (let i=0;i<tables.length;i++) assert.deepEqual((await previous.query(`select * from public.${tables[i]}`)).rows,beforeRows[i]);
    const snapshot=(await previous.query<Record<string,unknown>>("select * from public.robux_account_orders")).rows[0];
    assert.equal(snapshot.pricing_rule,"proportional_v1");
    delete snapshot.pricing_rule;
    assert.deepEqual(snapshot,oldSnapshot);
    assert.deepEqual((await previous.query(functions)).rows,beforeFunctions);
    const retry=await create(previous,selected,17,token);
    assert.equal(retry.order.id,old.order.id);
    assert.equal(Number(retry.order.total),17);
    assert.equal(Number((await create(previous,offer(),robuxPrice(500,36))).order.total),robuxPrice(500,36));
  } finally { await previous.close(); }
});

test("melhor valor por 1K usa preço efetivo e não apenas K base; DTO permanece público", () => {
  const choices=[publicOffer(offer(350),5,34),publicOffer(offer(1000,30),5,34),publicOffer(offer(1000,29),5,34)];
  assert.deepEqual(choices.sort(compareAccountUnitPrice).map(o=>[o.robux,o.price]),[[1000,34],[1000,35],[350,15]]);
  for (const o of choices) assert.deepEqual(Object.keys(o).sort(),["cosmicK","id","price","robux"]);
  assert.equal(compareAccountUnitPrice({robux:2000,price:68},{robux:1000,price:34}),0);
});

test("verificação SQL confirma preços, privacidade e execução restrita", async () => {
  const results=await db.exec(await readFile("supabase/verificacoes/202610100002_check.sql","utf8"));
  assert(results[0].rows.every(r=>r.confere));
  assert(Object.values(results[2].rows[0]).every(Boolean));
  assert(results[4].rows.every(r=>!r.anon_can_execute&&!r.customer_can_execute&&r.server_can_execute===(r.proname==="create_robux_account_order_with_policy")));
  assert.equal(results[5].rows[0].rls_enabled,true);
  assert.equal(results[5].rows[0].anon_can_read,false);
  await create(db,offer(),18.55);
  // A fixture mínima não aplica os grants padrão do Supabase às tabelas antigas.
  await db.exec(`grant select on public.orders to authenticated;set role authenticated;select set_config('request.jwt.claim.sub','${ids.user}',false);`);
  assert.equal((await db.query("select * from public.robux_account_orders")).rows.length,0);
  const safe=(await db.query<Record<string,unknown>>("select * from public.robux_account_order_details")).rows[0];
  assert.deepEqual(Object.keys(safe).sort(),["cosmic_k","fulfillment_status","order_id","robux","sale_price"]);
  assert.equal(Number(safe.sale_price),18.55);
});
