import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import { couponDate, readCouponForm } from "../lib/coupons";
import {
  readDeliveryHours,
  validSchedule,
  defaultSchedule,
  serviceStatus,
} from "../lib/store-service";
import { checkoutItems } from "../lib/checkout-request";
import { mergeRepurchase, type CartItem } from "../lib/cart";
import { applyDescriptionTemplate } from "../lib/description-templates";
let db: PGlite;
const lines = [{ id: ids.a, kind: "product", quantity: 1, unit_price: 20 }];
before(async () => {
  db = await createDatabase();
  await db.exec(
    "grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','',false);truncate public.orders,public.store_coupons,public.customer_product_preferences,public.notifications,public.game_servers cascade;update public.products set stock=10,is_active=true,unlimited_stock=false,delivery_hours=null;update public.games set is_active=true,delivery_hours=null;update public.store_service_settings set delivery_hours=24;`,
  );
});
async function coupon(extra = "") {
  return (
    (
      await db.query<{ id: string }>(
        `insert into public.store_coupons(code,kind,amount,is_active,per_user_limit) values('COSMIC10','percent',10,true,1) returning id`,
      )
    ).rows[0].id + extra
  );
}
async function quote(code = "COSMIC10", items = lines) {
  return (
    await db.query<{
      result: {
        subtotal: number;
        discount: number;
        total: number;
        code: string | null;
        delivery_hours: number;
      };
    }>("select public.quote_store_checkout($1,$2::jsonb,$3) result", [
      ids.user,
      JSON.stringify(items),
      code,
    ])
  ).rows[0].result;
}
async function order(
  token = randomUUID(),
  total = 18,
  items = lines,
  code = "COSMIC10",
) {
  return (
    await db.query<{
      result: {
        created: boolean;
        order: {
          id: string;
          total: number;
          subtotal: number;
          discount_total: number;
          coupon_code: string;
          delivery_hours: number;
        };
      };
    }>(
      "select public.create_store_order_with_coupon($1,$2,'nickname',$3,'000201-pix-payload-valido-para-teste',$4::jsonb,$5,$6) result",
      [
        ids.user,
        token,
        `COSMIC-${randomUUID()}`,
        JSON.stringify(items),
        total,
        code,
      ],
    )
  ).rows[0].result;
}
async function customer(id: string = ids.user) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function preference(kind: string, enabled = true) {
  return (
    await db.query<{ result: { favorite: boolean; restock: boolean } }>(
      "select public.set_product_preference($1,$2,$3) result",
      [ids.a, kind, enabled],
    )
  ).rows[0].result;
}

test("formulários validam cupons, datas reais e horários de atendimento em Brasília", () => {
  assert.equal(couponDate("2026-02-31T12:00"), "invalid");
  assert.equal(couponDate("2026-10-04T12:00"), "2026-10-04T15:00:00.000Z");
  const form = new FormData();
  for (const [key, value] of Object.entries({
    code: " cosmic10 ",
    kind: "percent",
    amount: "10,50",
    per_user_limit: "1",
    scope: "all",
  }))
    form.set(key, value);
  assert.equal(readCouponForm(form).values?.code, "COSMIC10");
  form.set("amount", "100");
  assert.ok(readCouponForm(form).error);
  assert.equal(readDeliveryHours("0"), "invalid");
  assert.equal(readDeliveryHours("48"), 48);
  assert.equal(readDeliveryHours(""), null);
  assert.ok(validSchedule(defaultSchedule));
  assert.equal(
    validSchedule([...defaultSchedule.slice(0, 6), defaultSchedule[0]]),
    false,
  );
  assert.equal(
    serviceStatus(defaultSchedule, new Date("2026-10-05T13:00:00Z")).open,
    true,
  );
  assert.equal(
    serviceStatus(defaultSchedule, new Date("2026-10-05T22:00:00Z")).text,
    "Atendimento amanhã às 09:00",
  );
  assert.equal(
    serviceStatus(defaultSchedule, new Date("2026-10-04T13:00:00Z")).open,
    false,
  );
});
test("cupom limita desconto aos produtos elegíveis e respeita a opção de combos", async () => {
  const id = await coupon();
  const mixed = [
    ...lines,
    { id: ids.b, kind: "product", quantity: 1, unit_price: 30 },
    { id: ids.combo, kind: "combo", quantity: 1, unit_price: 40 },
  ];
  assert.equal((await quote("cosmic10", mixed)).discount, 5);
  await db.query(
    "update public.store_coupons set include_combos=true where id=$1",
    [id],
  );
  assert.equal((await quote("COSMIC10", mixed)).discount, 9);
  await db.query(
    "update public.store_coupons set include_combos=false,product_id=$2 where id=$1",
    [id, ids.a],
  );
  assert.equal((await quote("COSMIC10", mixed)).discount, 2);
  await assert.rejects(
    quote("COSMIC10", [
      { id: ids.b, kind: "product", quantity: 1, unit_price: 30 },
    ]),
    /não se aplica/,
  );
  await db.query(
    "update public.store_coupons set kind='fixed',amount=100 where id=$1",
    [id],
  );
  assert.equal((await quote()).total, 0.01);
  assert.equal((await quote("COSMIC10", mixed)).discount, 20);
});
test("cupom rejeita validade, mínimo e alterações de preço antes de criar pedido", async () => {
  await coupon();
  await db.exec("update public.store_coupons set min_order=21");
  await assert.rejects(quote(), /mínimo/);
  await db.exec(
    "update public.store_coupons set min_order=0,ends_at=now()-interval '1 minute'",
  );
  await assert.rejects(quote(), /validade/);
  await db.exec(
    "update public.store_coupons set ends_at=null,starts_at=now()+interval '1 day'",
  );
  await assert.rejects(quote(), /validade/);
  await db.exec("update public.store_coupons set starts_at=null");
  await assert.rejects(order(randomUUID(), 17), /valor mudou/);
  await assert.rejects(
    order(randomUUID(), 18, [{ ...lines[0], unit_price: 19 }]),
    /preço mudou/,
  );
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
  assert.equal(
    (await db.query("select * from public.order_items")).rows.length,
    0,
  );
});
test("pedido com cupom reserva um uso e é idempotente; cancelamento libera a reserva", async () => {
  await coupon();
  const token = randomUUID();
  const first = await order(token);
  assert.equal(Number(first.order.total), 18);
  assert.equal(Number(first.order.subtotal), 20);
  assert.equal(Number(first.order.discount_total), 2);
  const repeated = await order(token);
  assert.equal(repeated.created, false);
  assert.equal(repeated.order.id, first.order.id);
  await assert.rejects(order(), /máximo de vezes/);
  await db.query(
    "select public.transition_store_order($1,$2,'cancelled','awaiting_payment','')",
    [first.order.id, ids.admin],
  );
  assert.ok((await order()).created);
  await db.exec("update public.store_coupons set amount=50,is_active=false");
  const frozen = (
    await db.query<{ total: string }>(
      "select total from public.orders where id=$1",
      [first.order.id],
    )
  ).rows[0];
  assert.equal(Number(frozen.total), 18);
});
test("limite global não permite um pedido excedente e pedido inválido não consome cupom", async () => {
  await coupon();
  await db.exec("update public.store_coupons set max_uses=1,per_user_limit=10");
  await assert.rejects(
    order(randomUUID(), 72, [
      { ...lines[0], quantity: 4 },
      { id: ids.combo, kind: "combo", quantity: 99, unit_price: 40 },
    ]),
    /indisponível|estoque/,
  );
  const results = await Promise.allSettled([order(), order()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await db.query("select * from public.orders")).rows.length, 1);
});
test("prazo usa produto, jogo e padrão, fica congelado e define a data após pagamento", async () => {
  await db.query("update public.games set delivery_hours=48 where id=$1", [
    ids.game,
  ]);
  await db.query("update public.products set delivery_hours=2 where id=$1", [
    ids.a,
  ]);
  assert.equal((await quote("", lines)).delivery_hours, 2);
  assert.equal(
    (
      await quote("", [
        { id: ids.combo, kind: "combo", quantity: 1, unit_price: 40 },
      ])
    ).delivery_hours,
    48,
  );
  const created = await order(randomUUID(), 20, lines, "");
  await db.exec("update public.products set delivery_hours=100");
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [created.order.id],
  );
  await db.query(
    "select public.transition_store_order($1,$2,'paid','proof_submitted','')",
    [created.order.id, ids.admin],
  );
  const row = (
    await db.query<{ hours: number; stock: number }>(
      "select extract(epoch from (o.delivery_due_at-o.paid_at))/3600 hours,p.stock from public.orders o cross join public.products p where o.id=$1 and p.id=$2",
      [created.order.id, ids.a],
    )
  ).rows[0];
  assert.equal(Number(row.hours), 2);
  assert.equal(row.stock, 9);
});
test("favoritos são privados e a reposição notifica uma única vez por solicitação", async () => {
  await db.query("update public.products set stock=0 where id=$1", [ids.a]);
  await customer();
  assert.equal((await preference("favorite")).favorite, true);
  assert.equal((await preference("restock")).restock, true);
  await customer(ids.admin);
  assert.equal(
    (await db.query("select * from public.customer_product_preferences")).rows
      .length,
    0,
  );
  await db.exec("reset role");
  await db.query("update public.products set stock=3 where id=$1", [ids.a]);
  await db.query("update public.products set stock=4 where id=$1", [ids.a]);
  const notifications = await db.query<{ user_id: string }>(
    "select user_id from public.notifications where title='Produto de volta ao estoque'",
  );
  assert.deepEqual(
    notifications.rows.map((r) => r.user_id),
    [ids.user],
  );
  await customer();
  await assert.rejects(preference("restock"), /já está disponível/);
  assert.equal((await preference("favorite", false)).restock, false);
});
test("reposição respeita jogo oculto e cancelamento do aviso", async () => {
  await db.query("update public.products set stock=0 where id=$1", [ids.a]);
  await customer();
  await preference("restock");
  await db.exec("reset role;update public.games set is_active=false;");
  await db.query("update public.products set stock=2 where id=$1", [ids.a]);
  assert.equal(
    (await db.query("select * from public.notifications")).rows.length,
    0,
  );
  await db.exec("update public.games set is_active=true");
  assert.equal(
    (await db.query("select * from public.notifications")).rows.length,
    1,
  );
  await db.query("update public.products set stock=0 where id=$1", [ids.a]);
  await customer();
  await preference("restock");
  await preference("restock", false);
  await db.exec("reset role");
  await db.query("update public.products set stock=5 where id=$1", [ids.a]);
  assert.equal(
    (await db.query("select * from public.notifications")).rows.length,
    1,
  );
});
test("relatos de servidor exigem conta, são privados e não duplicam avisos pendentes", async () => {
  const server = randomUUID();
  await db.query(
    "insert into public.game_servers(id,game_name,name,join_url) values($1,'Jogo','Servidor','https://www.roblox.com/share?code=qa')",
    [server],
  );
  await customer();
  const sql =
    "select public.report_game_server($1,'invalid_link','Não abre o link') id";
  const first = (await db.query<{ id: string }>(sql, [server])).rows[0].id;
  assert.equal(
    (await db.query<{ id: string }>(sql, [server])).rows[0].id,
    first,
  );
  await assert.rejects(
    db.query("update public.server_reports set status='resolved' where id=$1", [
      first,
    ]),
    /permission denied/,
  );
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role anon;",
  );
  await assert.rejects(db.query(sql, [server]), /permission denied/);
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select * from public.notifications where title='Problema em servidor'",
      )
    ).rows.length,
    1,
  );
});
test("cupons e operações privilegiadas não são acessíveis aos clientes; migração preserva dados ao reaplicar", async () => {
  await coupon();
  const created = await order();
  await db.exec(
    await readFile(
      "supabase/migrations/202610040002_customer_tools.sql",
      "utf8",
    ),
  );
  assert.equal(
    Number(
      (
        await db.query<{ total: string }>(
          "select total from public.orders where id=$1",
          [created.order.id],
        )
      ).rows[0].total,
    ),
    18,
  );
  for (const role of ["anon", "authenticated"]) {
    for (const fn of [
      "public.quote_store_checkout(uuid,jsonb,text)",
      "public.create_store_order_with_coupon(uuid,uuid,text,text,text,jsonb,numeric,text)",
      "public.list_store_coupons()",
    ])
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'execute') allowed",
            [role, fn],
          )
        ).rows[0].allowed,
        false,
      );
    await db.exec(`set role ${role}`);
    await assert.rejects(
      db.query("select * from public.store_coupons"),
      /permission denied/,
    );
    await db.exec("reset role");
  }
});
test("recompra conserva o carrinho, atualiza preços e limita estoque; modelo preenche os nomes", () => {
  const old: CartItem = {
    id: ids.a,
    name: "Dragon",
    kind: "product",
    price: 10,
    quantity: 2,
    stock: 10,
    unlimited_stock: false,
    image_url: null,
  };
  const incoming = { ...old, quantity: 3, price: 25, stock: 4 };
  const merged = mergeRepurchase([old], [incoming]);
  assert.equal(merged.items[0].quantity, 4);
  assert.equal(merged.items[0].price, 25);
  assert.equal(merged.added, 2);
  assert.equal(
    applyDescriptionTemplate(
      "{{produto}} para {{jogo}}",
      "Dragon",
      "Blox Fruits",
    ),
    "Dragon para Blox Fruits",
  );
  assert.equal(
    checkoutItems([{ id: ids.a, kind: "x", quantity: 1, price: 20 }]),
    null,
  );
  assert.equal(
    checkoutItems([
      { id: ids.a, quantity: 1, price: 20 },
      { id: ids.a, quantity: 1, price: 20 },
    ]),
    null,
  );
});
