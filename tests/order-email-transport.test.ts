import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Script } from "node:vm";
import ts from "typescript";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids, confirmPayment } from "./fixture";

let db: PGlite, sends: string[], failSmtp = false, customerEmail = "teste@example.invalid";
before(async () => { db = await createDatabase(); });
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec("truncate public.orders,public.notification_deliveries cascade; update public.products set stock=10"); sends = []; failSmtp = false; customerEmail = "teste@example.invalid"; });

class Query {
  filters = new Map<string, unknown>();
  inserted?: Record<string, unknown>;
  constructor(readonly table: string) {}
  select() { return this; }
  eq(name: string, value: unknown) { this.filters.set(name, value); return this; }
  limit() { return this; }
  insert(value: Record<string, unknown>) { this.inserted = value; return this; }
  async result() {
    if (this.inserted) {
      const keys = Object.keys(this.inserted);
      await db.query(`insert into public.notification_deliveries(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(this.inserted));
      return { data: null, error: null };
    }
    if (this.table === "orders") {
      const order = (await db.query<Record<string, unknown>>("select * from public.orders where id=$1", [this.filters.get("id")])).rows[0];
      order.order_items = (await db.query("select * from public.order_items where order_id=$1", [order.id])).rows;
      order.profiles = { nickname: "ClienteTeste" };
      return { data: order, error: null };
    }
    const entries = [...this.filters.entries()];
    const data = (await db.query(`select * from public.notification_deliveries where ${entries.map(([k], i) => `${k}=$${i + 1}`).join(" and ")} limit 1`, entries.map(([, value]) => value))).rows;
    return { data: data[0] ?? null, error: null };
  }
  maybeSingle() { return this.result(); }
  then<TResult1 = Awaited<ReturnType<Query["result"]>>, TResult2 = never>(resolve?: ((value: Awaited<ReturnType<Query["result"]>>) => TResult1 | PromiseLike<TResult1>) | null, reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return this.result().then(resolve, reject); }
}
function load() {
  const admin = {
    from: (table: string) => new Query(table),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: customerEmail } }, error: null }) } },
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.ok(["claim_order_email", "finish_order_email"].includes(name));
      try {
        const keys = Object.keys(args);
        const { rows } = await db.query<{ r: unknown }>(`select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(",")}) r`, Object.values(args));
        return { data: rows[0].r, error: null };
      } catch { return { data: null, error: { code: "TEST_ERROR" } }; }
    },
  };
  const dependencies: Record<string, unknown> = {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/chat-attachments": { CHAT_ATTACHMENT_BUCKET: "chat-attachments" },
    "./store-issues": { cleanIssueMessage: () => "Falha simulada", recordStoreIssue: async () => undefined },
    "@/lib/notifications": { sendEmail: async (_to: string, _subject: string, html: string) => {
      sends.push(html); await new Promise(resolve => setTimeout(resolve, 20));
      if (failSmtp) throw new Error("Resposta SMTP perdida após aceitação simulada");
    } },
  };
  const code = ts.transpileModule(readFileSync("lib/order-emails.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  const factory = new Script(`(function(require,module,exports,process,Buffer){${code}\n})`).runInThisContext() as (...args: unknown[]) => void;
  factory((id: string) => { assert.ok(id in dependencies, `Dependência externa não simulada: ${id}`); return dependencies[id]; }, loadedModule, loadedModule.exports, { env: { NEXT_PUBLIC_SITE_URL: "https://example.invalid" } }, Buffer);
  return loadedModule.exports as { sendOrderStatusEmail: (id: string, kind: string, manual?: boolean) => Promise<{ sent: boolean }> };
}
async function order() {
  const { rows } = await db.query<{ r: { order: { id: string } } }>("select public.create_store_order($1,$2,'ClienteTeste',$3,'000201-ficticio-nao-pagar',$4::jsonb,20) r", [ids.user, randomUUID(), `TEST-${randomUUID()}`, JSON.stringify([{ id: ids.a, quantity: 1, unit_price: 20 }])]);
  const id = rows[0].r.order.id;
  await db.query("update public.order_items set product_name='<img src=x onerror=alert(1)>' where order_id=$1", [id]);
  await confirmPayment(db, id, "awaiting_payment");
  return id;
}
test("código real do e-mail com SMTP simulado envia uma vez sob concorrência e escapa snapshot", async () => {
  const id = await order(), api = load();
  const result = await Promise.all([api.sendOrderStatusEmail(id, "payment"), api.sendOrderStatusEmail(id, "payment")]);
  assert.equal(result.filter(r => r.sent).length, 1);
  assert.equal(sends.length, 1);
  assert.ok(sends[0].includes("&lt;img")); assert.ok(!sends[0].includes("<img src=x"));
  assert.ok(sends[0].includes("extrato bancário"));
});
test("SMTP ambíguo mantém pedido pago, bloqueia retry automático e permite recuperação conferida", async () => {
  const id = await order(), api = load(); failSmtp = true;
  await assert.rejects(api.sendOrderStatusEmail(id, "payment"), /SMTP/);
  assert.equal((await api.sendOrderStatusEmail(id, "payment")).sent, false);
  assert.equal(sends.length, 1);
  assert.equal((await db.query<{ status: string }>("select status from public.orders where id=$1", [id])).rows[0].status, "paid");
  failSmtp = false;
  assert.equal((await api.sendOrderStatusEmail(id, "payment", true)).sent, true);
  assert.equal(sends.length, 2);
});
test("falha de preparação não aciona SMTP e fica disponível para recuperação", async () => {
  const id = await order(), api = load(); customerEmail = "";
  await assert.rejects(api.sendOrderStatusEmail(id, "payment"), /e-mail cadastrado/);
  assert.equal(sends.length, 0);
  assert.equal((await db.query<{ status: string }>("select status from public.order_email_jobs where order_id=$1", [id])).rows[0].status, "failed");
  customerEmail = "teste@example.invalid";
  assert.equal((await api.sendOrderStatusEmail(id, "payment", true)).sent, true);
});
