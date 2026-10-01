import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
let db: PGlite;
before(async () => {
  db = await createDatabase();
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    `truncate public.orders,public.support_tickets cascade;update public.products set stock=10,unlimited_stock=false,is_active=true,price=case when id='${ids.a}' then 20 else 30 end;delete from public.combo_items;delete from public.combos where id<>'${ids.combo}';update public.combos set price=40,compare_at_price=50,is_active=true where id='${ids.combo}';insert into public.combo_items values('${ids.combo}','${ids.a}',1),('${ids.combo}','${ids.b}',1);`,
  );
});
async function order(
  items = [{ id: ids.combo, kind: "combo", quantity: 1, unit_price: 40 }],
  total = 40,
  token = randomUUID(),
) {
  const { rows } = await db.query<{
    result: { created: boolean; order: { id: string; status: string } };
  }>(
    "select public.create_store_order($1,$2,'nickname',$3,'000201-pix-payload-valido-para-teste',$4::jsonb,$5) as result",
    [ids.user, token, `COSMIC-${randomUUID()}`, JSON.stringify(items), total],
  );
  return rows[0].result;
}
async function transition(
  id: string,
  status: string,
  expected = "proof_submitted",
  admin = ids.admin,
) {
  return db.query<{ result: { changed: boolean } }>(
    "select public.transition_store_order($1,$2,$3,$4,'Motivo de teste') as result",
    [id, admin, status, expected],
  );
}
async function submitted(id: string) {
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [id],
  );
}
async function stock(id: string) {
  return Number(
    (
      await db.query<{ stock: number }>(
        "select stock from public.products where id=$1",
        [id],
      )
    ).rows[0].stock,
  );
}
test("migrações antigas e atualização podem ser aplicadas novamente sem perder buckets privados", async () => {
  assert.equal(
    (
      await db.query<{ public: boolean }>(
        "select public from storage.buckets where id='review-attachments'",
      )
    ).rows[0].public,
    false,
  );
  assert.equal(
    (await db.query("select * from public.store_settings")).rows.length,
    1,
  );
});
test("pedido é idempotente e confirma estoque uma única vez", async () => {
  const token = randomUUID(),
    first = await order(undefined, 40, token),
    second = await order(undefined, 40, token);
  assert.equal(first.order.id, second.order.id);
  assert.equal(second.created, false);
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  await transition(first.order.id, "paid");
  assert.equal(await stock(ids.a), 9);
  assert.equal(await stock(ids.b), 9);
});
test("falta de estoque desfaz toda a confirmação, inclusive baixa parcial e histórico", async () => {
  const first = await order();
  await submitted(first.order.id);
  await db.query("update public.products set stock=0 where id=$1", [ids.b]);
  await assert.rejects(
    transition(first.order.id, "paid"),
    /Estoque insuficiente/,
  );
  assert.equal(await stock(ids.a), 10);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.orders where id=$1",
        [first.order.id],
      )
    ).rows[0].status,
    "proof_submitted",
  );
  assert.equal(
    (await db.query("select * from public.order_admin_events")).rows.length,
    0,
  );
});
test("componentes do pedido permanecem congelados depois de editar combo", async () => {
  const first = await order();
  await db.exec(
    `delete from public.combo_items where product_id='${ids.b}';update public.combo_items set quantity=4;`,
  );
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  assert.equal(await stock(ids.a), 9);
  assert.equal(await stock(ids.b), 9);
});
test("cancelamento restaura exatamente uma vez, inclusive com modo de estoque alterado", async () => {
  const first = await order();
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  await db.exec("update public.products set unlimited_stock=true");
  await transition(first.order.id, "cancelled", "paid");
  await transition(first.order.id, "cancelled", "paid");
  assert.equal(await stock(ids.a), 10);
  assert.equal(await stock(ids.b), 10);
});
test("transições inválidas, não administradores e telas desatualizadas são recusados", async () => {
  const first = await order();
  await assert.rejects(
    transition(first.order.id, "delivered", "awaiting_payment"),
    /Transição/,
  );
  await submitted(first.order.id);
  await assert.rejects(
    transition(first.order.id, "paid", "proof_submitted", ids.user),
    /Acesso/,
  );
  await assert.rejects(
    transition(first.order.id, "paid", "awaiting_payment"),
    /Outro administrador/,
  );
});
test("entrega exige imagem da equipe e produto de pedido aberto não pode ser excluído", async () => {
  const first = await order();
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  await assert.rejects(
    db.query("delete from public.products where id=$1", [ids.a]),
    /pedido em andamento/,
  );
  await transition(first.order.id, "preparing_delivery", "paid");
  await assert.rejects(
    transition(first.order.id, "delivered", "preparing_delivery"),
    /imagem/,
  );
  await db.query(
    "insert into public.order_messages(order_id,user_id,message,attachment_path,attachment_type) values($1,$2,'Entrega','orders/entrega.webp','image/webp')",
    [first.order.id, ids.admin],
  );
  await transition(first.order.id, "delivered", "preparing_delivery");
});
test("preço alterado ou total inválido não cria pedido órfão", async () => {
  await assert.rejects(
    order([{ id: ids.a, kind: "product", quantity: 1, unit_price: 19 }], 19),
    /preço mudou/,
  );
  await assert.rejects(order(undefined, 41), /valor mudou/);
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
});
test("estoque combina necessidades de produtos e combos no mesmo carrinho", async () => {
  await assert.rejects(
    order(
      [
        { id: ids.a, kind: "product", quantity: 9, unit_price: 20 },
        { id: ids.combo, kind: "combo", quantity: 2, unit_price: 40 },
      ],
      260,
    ),
    /Estoque insuficiente/,
  );
});
test("alteração em lote arredonda centavos e falha integralmente com um ID inexistente", async () => {
  await db.query(
    "select public.bulk_update_store_products($1,'price_percent',5)",
    [[ids.a, ids.b]],
  );
  assert.equal(
    Number(
      (
        await db.query<{ price: string }>(
          "select price from public.products where id=$1",
          [ids.a],
        )
      ).rows[0].price,
    ),
    21,
  );
  await assert.rejects(
    db.query("select public.bulk_update_store_products($1,'hide',null)", [
      [ids.a, randomUUID()],
    ]),
    /produto mudou/,
  );
  assert.equal(
    (
      await db.query<{ is_active: boolean }>(
        "select is_active from public.products where id=$1",
        [ids.a],
      )
    ).rows[0].is_active,
    true,
  );
});
test("anon pode ler destaque e não pode executar operações privilegiadas", async () => {
  await db.exec("set role anon");
  try {
    assert.equal(
      (await db.query("select * from public.store_settings")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select public.bulk_update_store_products($1,'hide',null)", [
        [ids.a],
      ]),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
test("suporte cria ticket e primeira mensagem juntos e impede duplicação", async () => {
  const token = randomUUID();
  const query =
    "select public.create_store_support_ticket($1,$2,'Dúvida de teste','order','Minha dúvida') as result";
  const a = (
    await db.query<{ result: { ticket: { id: string } } }>(query, [
      ids.user,
      token,
    ])
  ).rows[0].result;
  const b = (
    await db.query<{ result: { ticket: { id: string } } }>(query, [
      ids.user,
      token,
    ])
  ).rows[0].result;
  assert.equal(a.ticket.id, b.ticket.id);
  assert.equal(
    (await db.query("select * from public.support_messages")).rows.length,
    1,
  );
  await assert.rejects(
    db.query(
      "select public.create_store_support_ticket($1,$2,'Dúvida','invalid','Mensagem')",
      [ids.user, randomUUID()],
    ),
    /Confira/,
  );
});
test("listas pesquisam cliente, paginam no banco e resumo usa pagamentos", async () => {
  const first = await order();
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  const search = (
    await db.query<{ result: { total: number; page: number } }>(
      "select public.list_store_orders('cliente','','priority',999) as result",
    )
  ).rows[0].result;
  assert.equal(search.total, 1);
  assert.equal(search.page, 1);
  const summary = (
    await db.query<{ result: { paidToday: number } }>(
      "select public.store_dashboard_summary() as result",
    )
  ).rows[0].result;
  assert.equal(summary.paidToday, 40);
});
test("combo salva componentes atomicamente e conserva URL ao editar", async () => {
  const sql =
      "select public.save_store_combo($1,$2,'Combo teste','combo-teste','Descrição',35,null,true,null,$3::jsonb) as result",
    items = JSON.stringify([
      { id: ids.a, quantity: 1 },
      { id: ids.b, quantity: 1 },
    ]);
  const row = (
    await db.query<{ result: { id: string; slug: string } }>(sql, [
      ids.admin,
      null,
      items,
    ])
  ).rows[0].result;
  const update = (
    await db.query<{ result: { slug: string } }>(sql, [
      ids.admin,
      row.id,
      items,
    ])
  ).rows[0].result;
  assert.equal(update.slug, row.slug);
  await assert.rejects(
    db.query(sql, [
      ids.admin,
      row.id,
      JSON.stringify([{ id: randomUUID(), quantity: 1 }]),
    ]),
    /Produto não encontrado/,
  );
  assert.equal(
    (
      await db.query("select * from public.combo_items where combo_id=$1", [
        row.id,
      ])
    ).rows.length,
    2,
  );
});
test("estoque ilimitado não é devolvido como estoque finito no cancelamento", async () => {
  await db.exec("update public.products set unlimited_stock=true");
  const first = await order();
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  await db.exec("update public.products set unlimited_stock=false");
  await transition(first.order.id, "cancelled", "paid");
  assert.equal(await stock(ids.a), 10);
  assert.equal(await stock(ids.b), 10);
});
test("pedido anterior à atualização continua confirmando e restaurando estoque", async () => {
  const first = await order(
    [{ id: ids.a, kind: "product", quantity: 2, unit_price: 20 }],
    40,
  );
  await db.query("delete from public.order_stock_items where order_id=$1", [
    first.order.id,
  ]);
  await submitted(first.order.id);
  await transition(first.order.id, "paid");
  assert.equal(await stock(ids.a), 8);
  await transition(first.order.id, "cancelled", "paid");
  assert.equal(await stock(ids.a), 10);
});
test("paginação consulta pedidos além dos primeiros 25 e ajusta última página", async () => {
  for (let i = 0; i < 31; i++) await order();
  const query =
    "select public.list_store_orders('cliente','','recent',$1) as result";
  const first = (
      await db.query<{
        result: { rows: unknown[]; total: number; page: number };
      }>(query, [1])
    ).rows[0].result,
    second = (
      await db.query<{ result: { rows: unknown[]; page: number } }>(
        query,
        [999],
      )
    ).rows[0].result;
  assert.equal(first.total, 31);
  assert.equal(first.rows.length, 25);
  assert.equal(second.rows.length, 6);
  assert.equal(second.page, 2);
});
test("nenhuma função nova privilegiada pode ser executada por anon ou authenticated", async () => {
  const names = [
    "create_store_order",
    "transition_store_order",
    "bulk_update_store_products",
    "create_store_support_ticket",
    "commit_order_stock",
    "restore_order_stock",
    "store_dashboard_summary",
    "list_store_orders",
    "list_store_support",
    "save_store_combo",
  ];
  const result = await db.query<{ proname: string }>(
    "select proname from pg_proc where proname=any($1) and (has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE'))",
    [names],
  );
  assert.equal(result.rows.length, 0);
});
