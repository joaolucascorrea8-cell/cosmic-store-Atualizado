import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import { robuxPrice, readRobuxRate } from "../lib/robux-pricing";
import { parseProductCsv, exportCsv } from "../lib/product-csv";
let db: PGlite;
before(async () => {
  db = await createDatabase();
  await db.exec(
    "grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
});
after(async () => db?.close());
beforeEach(async () => {
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);select set_config('request.jwt.claims','{}',false);select set_config('request.headers','{}',false);truncate public.orders,public.store_coupons,public.customer_product_preferences,public.notifications,public.price_batches,public.product_import_batches,public.catalog_events,public.store_issues cascade;
 delete from public.products where id not in('${ids.a}','${ids.b}');update public.products set price=case when id='${ids.a}' then 20 else 30 end,stock=10,unlimited_stock=false,is_active=true,delivery_instructions='',pricing_rate=null,robux_quantity=null,low_stock_threshold=2;
 update public.products set pricing_reference=null,pricing_locked=false;update public.categories set robux_pricing_enabled=false;update public.games set delivery_instructions='';update public.store_ops_settings set auto_close_enabled=false,auto_close_hours=72,enabled_at=null,enabled_by=null;`);
});
async function scalar<T = unknown>(
  sql: string,
  args: unknown[] = [],
): Promise<T> {
  return (await db.query<{ r: T }>(sql, args)).rows[0].r;
}
async function preview(rate = 40) {
  await db.query("select public.ops_set_categories($1,$2,true)", [
    ids.admin,
    [ids.category],
  ]);
  return scalar<{
    id: string;
    changes: { id: string; before: number; after: number }[];
    skipped: number;
  }>("select public.ops_preview_prices($1,$2,$3,34) r", [
    ids.admin,
    [ids.category],
    rate,
  ]);
}
const apply = (id: string) =>
  scalar<number>("select public.ops_apply_prices($1,$2) r", [ids.admin, id]);
const undo = (id: string) =>
  scalar<number>("select public.ops_revert_prices($1,$2) r", [ids.admin, id]);
const prices = () =>
  db.query<{
    id: string;
    price: string;
    pricing_reference: string;
    pricing_locked: boolean;
  }>(
    "select id,price,pricing_reference,pricing_locked from public.products order by id",
  );
async function order(combo = false) {
  return scalar<{ order: { id: string } }>(
    "select public.create_store_order_with_coupon($1,$2,'Jogador',$3,'000201-pix-payload-valido-para-teste',$4::jsonb,$5,'') r",
    [
      ids.user,
      randomUUID(),
      "CS-" + randomUUID(),
      JSON.stringify([
        {
          kind: combo ? "combo" : "product",
          id: combo ? ids.combo : ids.a,
          quantity: 1,
          unit_price: combo ? 40 : 20,
        },
      ]),
      combo ? 40 : 20,
    ],
  );
}
test("curva do bot mantém faixas e arredonda somente ao final na nova cotação", () => {
  for (const [q, old, next] of [
    [350, 15, 17.65],
    [400, 16, 18.82],
    [450, 17, 20],
    [500, 18.55, 21.82],
    [750, 26.27, 30.91],
    [1000, 34, 40],
    [5000, 170, 200],
  ]) {
    assert.equal(robuxPrice(q), old);
    assert.equal(robuxPrice(q, 40), next);
  }
  assert.equal(robuxPrice(1000, 34), 34);
  assert.equal(readRobuxRate("40,00"), 40);
  assert.equal(readRobuxRate("0"), null);
  assert.throws(() => robuxPrice(3.5));
});
test("prévia exclui categorias manuais e produtos protegidos, sem alterar preços", async () => {
  await assert.rejects(
    () =>
      scalar("select public.ops_preview_prices($1,$2,40,34) r", [
        ids.admin,
        [ids.category],
      ]),
    /Nenhum produto/,
  );
  await db.query("update public.products set pricing_locked=true where id=$1", [
    ids.b,
  ]);
  const p = await preview();
  assert.equal(p.changes.length, 1);
  assert.equal(p.skipped, 1);
  assert.equal(Number(p.changes[0].after), 23.53);
  assert.equal(Number((await prices()).rows[0].price), 20);
});
test("reajuste e retorno à cotação original não acumulam arredondamentos; aplicação é idempotente", async () => {
  const p = await preview();
  assert.equal(await apply(p.id), 2);
  assert.equal(await apply(p.id), 2);
  assert.equal(Number((await prices()).rows[0].price), 23.53);
  const back = await preview(34);
  await apply(back.id);
  assert.equal(Number((await prices()).rows[0].price), 20);
  assert.equal(Number((await prices()).rows[0].pricing_reference), 20);
});
test("prévia desatualizada rejeita o lote inteiro e mantém edição manual protegida", async () => {
  const p = await preview();
  await db.query("update public.products set price=35 where id=$1", [ids.b]);
  await assert.rejects(() => apply(p.id), /mudou/);
  const rows = (await prices()).rows;
  assert.equal(Number(rows[0].price), 20);
  assert.equal(Number(rows[1].price), 35);
  assert.equal(rows[1].pricing_locked, true);
});
test("desfazer restaura metadados e valores, e bloqueia alterações posteriores", async () => {
  const p = await preview();
  await apply(p.id);
  await undo(p.id);
  assert.equal(await undo(p.id), 0);
  assert.equal((await prices()).rows[0].pricing_reference, null);
  const p2 = await preview();
  await apply(p2.id);
  await db.query(
    "update public.products set description='Editado depois' where id=$1",
    [ids.b],
  );
  await assert.rejects(() => undo(p2.id), /mudou depois/);
  assert.equal(Number((await prices()).rows[0].price), 23.53);
});
test("produto calculado em K40 guarda referência correta e edição antiga não sobrescreve lote", async () => {
  const id = randomUUID();
  await db.query(
    "insert into public.products(id,name,slug,category_id,price,pricing_rate) values($1,'Novo','novo',$2,200,40)",
    [id, ids.category],
  );
  const p = await preview(34);
  await apply(p.id);
  assert.equal(
    Number(
      await scalar("select price r from public.products where id=$1", [id]),
    ),
    170,
  );
  const result = await db.query(
    "update public.products set price=1 where id=$1 and ops_version=0 returning id",
    [id],
  );
  assert.equal(result.rows.length, 0);
});
test("CSV aceita acentos e campos com quebra de linha; falha em linhas e colunas incorretas", () => {
  const data = parseProductCsv(
    '\ufeffnome;jogo;categoria;preco;descricao\r\n"Fruta; especial";Blox Fruits;Permanentes;15,00;"Duas\nlinhas"',
  );
  assert.equal(data.length, 1);
  assert.equal(data[0].descricao, "Duas\nlinhas");
  assert.equal(data[0].nome, "Fruta; especial");
  assert.throws(() => parseProductCsv("nome;jogo;categoria;preco\na;b;c"));
  assert.throws(() => parseProductCsv('nome;jogo;categoria;preco\n"a;b;c;10'));
  assert.match(exportCsv([["=CMD()", "normal"]]), /'=CMD/);
});
test("importação é atômica, oculta e idempotente; mantém referência da calculadora", async () => {
  const token = randomUUID(),
    row = {
      name: "Importado",
      slug: "importado",
      category_id: ids.category,
      price: 200,
      pricing_rate: 40,
      stock: 0,
      unlimited_stock: true,
      robux_quantity: 5000,
    };
  const run = (rows: unknown[], key = token) =>
    scalar<number>("select public.ops_import_products($1,$2,$3::jsonb) r", [
      ids.admin,
      key,
      JSON.stringify(rows),
    ]);
  assert.equal(await run([row]), 1);
  assert.equal(await run([row]), 1);
  const p = (
    await db.query<{ is_active: boolean; pricing_reference: string }>(
      "select is_active,pricing_reference from public.products where slug=$1",
      ["importado"],
    )
  ).rows[0];
  assert.equal(p.is_active, false);
  assert.equal(Number(p.pricing_reference), 170);
  await assert.rejects(
    () =>
      run(
        [
          { ...row, slug: "rollback" },
          { ...row, category_id: randomUUID() },
        ],
        randomUUID(),
      ),
    /categoria/,
  );
  assert.equal(
    Number(
      await scalar(
        "select count(*) r from public.products where slug='rollback'",
      ),
    ),
    0,
  );
});
test("instruções usam produto antes do jogo e ficam congeladas no pedido e no combo", async () => {
  await db.query(
    "update public.games set delivery_instructions='Entre no servidor' where id=$1",
    [ids.game],
  );
  await db.query(
    "update public.products set delivery_instructions='Confirme seu nickname' where id=$1",
    [ids.a],
  );
  const o = await order(true);
  await db.exec(
    "update public.products set delivery_instructions='Mudou';update public.games set delivery_instructions='Mudou';",
  );
  const result = await scalar<{ name: string; text: string }[]>(
    "select delivery_instructions r from public.order_items where order_id=$1",
    [o.order.id],
  );
  assert.deepEqual(result.map((x) => x.text).sort(), [
    "Confirme seu nickname",
    "Entre no servidor",
  ]);
});
test("notas e responsável são privados, recusam cliente e detectam disputa entre telas", async () => {
  const o = await order();
  const work = await scalar<string>(
    "select public.ops_work_update($1,'order',$2,$1,'Aguardando cliente',null) r",
    [ids.admin, o.order.id],
  );
  await assert.rejects(
    () =>
      scalar(
        "select public.ops_work_update($1,'order',$2,$1,'Outra nota',null) r",
        [ids.admin, o.order.id],
      ),
    /mudou/,
  );
  await assert.rejects(
    () =>
      scalar(
        "select public.ops_work_update($1,'order',$2,$1,'Sou cliente',null) r",
        [ids.user, o.order.id],
      ),
    /negado/,
  );
  assert.equal(
    Number(
      await scalar(
        "select count(*) r from public.admin_work_notes where work_id=$1",
        [work],
      ),
    ),
    1,
  );
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${ids.user}',false);`,
  );
  await assert.rejects(
    () => db.query("select * from public.admin_work_notes"),
    /permission denied/,
  );
  assert.equal(
    (await db.query("select * from public.admin_quick_replies")).rows.length,
    0,
  );
});
test("encerramento automático começa desligado e respeita nova carência", async () => {
  const o = await order();
  await db.query(
    "update public.orders set created_at=now()-interval '10 days',updated_at=now()-interval '10 days' where id=$1",
    [o.order.id],
  );
  assert.equal(await scalar("select public.ops_expire_orders() r"), 0);
  await db.query(
    "select public.ops_save_settings($1,true,24,(select updated_at from public.store_ops_settings))",
    [ids.admin],
  );
  assert.equal(await scalar("select public.ops_expire_orders() r"), 0);
});
test("automação fecha apenas pedido sem comprovante e sem atividade, uma única vez", async () => {
  const orders = await Promise.all([order(), order(), order(), order()]);
  const [unpaid, proof, paid, recent] = orders.map((x) => x.order.id);
  await db.exec(
    "update public.store_ops_settings set auto_close_enabled=true,auto_close_hours=24,enabled_at=now()-interval '10 days',enabled_by='" +
      ids.admin +
      "';",
  );
  await db.exec(
    "alter table public.orders disable trigger user;update public.orders set created_at=now()-interval '10 days',updated_at=now()-interval '10 days';alter table public.orders enable trigger user;",
  );
  await db.query(
    "update public.orders set proof_path='proof.png' where id=$1",
    [proof],
  );
  await db.query(
    "update public.orders set paid_at=now()-interval '9 days' where id=$1",
    [paid],
  );
  await db.query("update public.orders set updated_at=now() where id=$1", [
    recent,
  ]);
  await db.query("alter table public.orders disable trigger user");
  await db.query(
    "update public.orders set updated_at=now()-interval '10 days' where id<>$1",
    [recent],
  );
  await db.query("alter table public.orders enable trigger user");
  assert.equal(await scalar("select public.ops_expire_orders() r"), 1);
  assert.equal(await scalar("select public.ops_expire_orders() r"), 0);
  assert.equal(
    await scalar("select status r from public.orders where id=$1", [unpaid]),
    "cancelled",
  );
  assert.equal(
    Number(
      await scalar(
        "select count(*) r from public.order_admin_events where action='auto:unpaid_closed'",
      ),
    ),
    1,
  );
  assert.equal(
    Number(
      await scalar("select stock r from public.products where id=$1", [ids.a]),
    ),
    10,
  );
});
test("relatórios usam pagamentos e desconto rateado; interesse é agregado sem expor clientes", async () => {
  const o = await order();
  await db.query(
    "update public.orders set total=18,subtotal=20,discount_total=2,coupon_code='TESTE',paid_at=now(),status='paid' where id=$1",
    [o.order.id],
  );
  const r = await scalar<{
    revenue: number;
    products: { revenue: number }[];
    coupons: { discount: number }[];
  }>(
    "select public.ops_report(now()-interval '1 day',now()+interval '1 day') r",
  );
  assert.equal(Number(r.revenue), 18);
  assert.equal(Number(r.products[0].revenue), 18);
  assert.equal(Number(r.coupons[0].discount), 2);
  await db.query(
    "insert into public.customer_product_preferences(user_id,product_id,favorite,restock) values($1,$2,true,true)",
    [ids.user, ids.a],
  );
  const interest = await scalar<
    { favorite: number; restock: number; user_id?: string }[]
  >("select public.ops_interest() r");
  assert.equal(interest[0].favorite, 1);
  assert.equal(interest[0].restock, 1);
  assert.equal(interest[0].user_id, undefined);
});
test("auditoria atribui o administrador, diagnóstico agrupa e não repete aviso aberto", async () => {
  const p = await preview();
  await apply(p.id);
  assert.equal(
    Number(
      await scalar(
        "select count(*) r from public.catalog_events where actor_id=$1 and batch_id=$2",
        [ids.admin, p.id],
      ),
    ),
    2,
  );
  await db.query(
    "select public.ops_record_issue('x','servidor','/admin','Falha controlada')",
  );
  await db.query(
    "select public.ops_record_issue('x','servidor','/admin','Falha controlada')",
  );
  assert.equal(
    await scalar(
      "select occurrences r from public.store_issues where fingerprint='x'",
    ),
    2,
  );
  assert.equal(
    Number(
      await scalar(
        "select count(*) r from public.notifications where link='/admin/diagnostico'",
      ),
    ),
    1,
  );
});
test("operações privilegiadas negadas aos clientes, limite de estoque e SQL reaplicável", async () => {
  const grants = await db.query<{ name: string }>(
    "select p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ops_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))",
  );
  assert.deepEqual(grants.rows, []);
  await db.query(
    "update public.products set stock=4,low_stock_threshold=5 where id=$1",
    [ids.a],
  );
  assert.equal(
    (
      await scalar<{ lowStock: number }>(
        "select public.store_dashboard_summary() r",
      )
    ).lowStock,
    1,
  );
  const p = await preview();
  await apply(p.id);
  await db.exec(
    await readFile(
      "supabase/migrations/202610040003_store_operations.sql",
      "utf8",
    ),
  );
  assert.equal(Number((await prices()).rows[0].price), 23.53);
  assert.equal(
    await scalar("select auto_close_enabled r from public.store_ops_settings"),
    false,
  );
});

test("verificador de instalação identifica todos os recursos sem acessar dados privados", async () => {
  const result = await db.query<{ verificacao: string; ok: boolean }>(
    await readFile("supabase/verificacoes/202610040003_check.sql", "utf8"),
  );
  assert(result.rows.length >= 19);
  assert.deepEqual(
    result.rows.filter((r) => !r.ok),
    [],
  );
});
