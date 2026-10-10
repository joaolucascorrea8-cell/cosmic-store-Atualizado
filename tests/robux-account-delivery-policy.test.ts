import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import {
  encryptCredentials,
  decryptCredentials,
} from "../lib/robux-accounts/credentials-crypto";
import { groupAccountOptions } from "../lib/robux-accounts/presentation";

const testKey = "a".repeat(64),
  otherUser = "10000000-0000-4000-8000-000000000009";
const credentials = {
  username: "Conta_teste",
  password: " Senha-com-espaços! ",
  instructions: "Confira o saldo.",
};
let db: PGlite;
before(async () => {
  db = await createDatabase();
  await db.query(
    "insert into auth.users(id,email) values($1,'outro@example.invalid')",
    [otherUser],
  );
});
after(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);truncate public.orders cascade;",
  );
});
async function policy() {
  return (
    await db.query<{ version: string; body: string }>(
      "select version,body from public.robux_account_policy",
    )
  ).rows[0];
}
async function create(accepted = true, version?: string) {
  const p = await policy();
  const offer = {
    id: "a".repeat(64),
    providerId: "account_new",
    maskedId: "***321",
    robux: 1990,
    quoteId: "b".repeat(64),
    quoteUrl: "https://www.byrobux.net/accounts/MTMz?catalog=alternate",
    supplierK: 26.93,
    supplierPrice: 53.59,
    seenAt: new Date().toISOString(),
  };
  return (
    await db.query<{ result: { order: { id: string } } }>(
      "select public.create_robux_account_order_with_policy($1,$2,$3,$4,$5::jsonb,67.66,$6,$7) result",
      [
        ids.user,
        randomUUID(),
        `COSMIC-${randomUUID()}`,
        "000201-test-pix-payload-1234567",
        JSON.stringify(offer),
        version ?? p.version,
        accepted,
      ],
    )
  ).rows[0].result.order.id;
}
async function paid(id: string) {
  await db.query(
    "update public.orders set status='proof_submitted' where id=$1",
    [id],
  );
  await db.query(
    "select public.transition_store_order($1,$2,'paid','proof_submitted','')",
    [id, ids.admin],
  );
}
async function acquired(id: string) {
  await paid(id);
  await db.query("select public.mark_robux_account_acquired($1,$2)", [
    id,
    ids.admin,
  ]);
}
async function save(
  id: string,
  actor = ids.admin,
  updatedAt: string | null = null,
) {
  return db.query("select public.save_robux_account_delivery($1,$2,$3,$4)", [
    id,
    actor,
    encryptCredentials(id, credentials, testKey),
    updatedAt,
  ]);
}
test("criptografia preserva senha exata, usa nonce aleatório e rejeita adulteração, outra chave e outro pedido", () => {
  const id = randomUUID(),
    encrypted = encryptCredentials(id, credentials, testKey);
  assert.deepEqual(decryptCredentials(id, encrypted, testKey), credentials);
  assert.notEqual(encrypted, encryptCredentials(id, credentials, testKey));
  assert(!encrypted.includes(credentials.username));
  assert(!encrypted.includes(credentials.password));
  assert.throws(() => decryptCredentials(randomUUID(), encrypted, testKey));
  assert.throws(() => decryptCredentials(id, encrypted, "b".repeat(64)));
  const parts = encrypted.split(":");
  parts[3] = "AAAA" + parts[3].slice(4);
  assert.throws(() => decryptCredentials(id, parts.join(":"), testKey));
  assert.throws(() => encryptCredentials(id, credentials, ""), /Configure/);
  assert.throws(
    () => encryptCredentials(id, { ...credentials, password: "" }, testKey),
    /senha/,
  );
});
test("catálogo agrupa apenas saldo/preço/K idênticos e escolhe uma oferta disponível", () => {
  const base = { robux: 1990, price: 71.5, cosmicK: 35.93, available: true };
  const result = groupAccountOptions([
    { ...base, id: "a", available: false, publicCount: 5 },
    { ...base, id: "b", publicCount: 2 },
    { ...base, id: "c" },
    { ...base, id: "d", price: 73.49, cosmicK: 36.93 },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "b");
  assert.equal(result[0].options, 3);
  assert.equal(result[0].available, true);
  assert.deepEqual(Object.keys(result[0]).sort(), [
    "available",
    "cosmicK",
    "id",
    "options",
    "price",
    "robux",
  ]);
});
test("aceite é obrigatório e versão antiga falha sem criar pedidos ou reservas", async () => {
  await assert.rejects(create(false), /confirme a política/);
  await assert.rejects(create(true, randomUUID()), /política foi atualizada/);
  assert.equal((await db.query("select * from public.orders")).rows.length, 0);
  assert.equal(
    (await db.query("select * from public.robux_account_orders")).rows.length,
    0,
  );
});
test("pedido guarda versão e texto imutáveis mesmo após mudança da política", async () => {
  const original = await policy(),
    id = await create();
  await db.query("select public.save_robux_account_policy($1,$2,$3)", [
    ids.admin,
    original.body + "\n\nComplemento de teste.",
    original.version,
  ]);
  const saved = (
    await db.query<{
      policy_body: string;
      policy_version: string;
      user_id: string;
    }>(
      "select * from public.robux_account_policy_acceptances where order_id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(saved.policy_body, original.body);
  assert.equal(saved.policy_version, original.version);
  assert.equal(saved.user_id, ids.user);
  assert.notEqual((await policy()).version, original.version);
  await assert.rejects(
    db.exec(
      "update public.robux_account_policy_acceptances set policy_body='alterado'",
    ),
    /imutável/,
  );
  await assert.rejects(
    db.query("select public.save_robux_account_policy($1,$2,$3)", [
      ids.admin,
      original.body,
      original.version,
    ]),
    /outro administrador/,
  );
});
test("dados exigem admin, pagamento e aquisição; entrega funciona com credenciais sem imagem", async () => {
  const id = await create();
  await assert.rejects(save(id, ids.user), /administrativo/);
  await assert.rejects(save(id), /pagamento/);
  await paid(id);
  await assert.rejects(save(id), /aquisição/);
  await db.query("select public.mark_robux_account_acquired($1,$2)", [
    id,
    ids.admin,
  ]);
  await db.query(
    "select public.transition_store_order($1,$2,'preparing_delivery','paid','')",
    [id, ids.admin],
  );
  await assert.rejects(
    db.query(
      "select public.transition_store_order($1,$2,'delivered','preparing_delivery','')",
      [id, ids.admin],
    ),
    /usuário e a senha/,
  );
  await save(id);
  await db.query(
    "select public.transition_store_order($1,$2,'delivered','preparing_delivery','')",
    [id, ids.admin],
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.orders where id=$1",
        [id],
      )
    ).rows[0].status,
    "delivered",
  );
  assert.equal(
    (await db.query("select * from public.order_messages")).rows.length,
    0,
  );
  const row = (
    await db.query<{ encrypted_credentials: string }>(
      "select encrypted_credentials from public.robux_account_deliveries",
    )
  ).rows[0];
  assert.deepEqual(
    decryptCredentials(id, row.encrypted_credentials, testKey),
    credentials,
  );
  const events = JSON.stringify(
    (await db.query("select * from public.order_admin_events")).rows,
  );
  assert(!events.includes(credentials.password));
  assert(!events.includes(credentials.username));
});
test("dois administradores não sobrescrevem silenciosamente os dados salvos", async () => {
  const id = await create();
  await acquired(id);
  await save(id);
  await assert.rejects(save(id), /outro administrador/);
  const row = (
    await db.query<{ updated_at: Date }>(
      "select updated_at from public.robux_account_deliveries",
    )
  ).rows[0];
  await save(id, ids.admin, row.updated_at.toISOString());
});
test("RLS e grants escondem credenciais e aceites de outros clientes e fecham bypass da versão antiga", async () => {
  const id = await create();
  await acquired(id);
  await save(id);
  try {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${ids.user}',false)`,
    );
    assert.equal(
      (
        await db.query(
          "select policy_body from public.robux_account_policy_acceptances",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      db.exec("select * from public.robux_account_deliveries"),
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${otherUser}',false)`,
    );
    assert.equal(
      (await db.query("select * from public.robux_account_policy_acceptances"))
        .rows.length,
      0,
    );
    await db.exec("reset role;set role anon");
    assert.equal(
      (await db.query("select body,version from public.robux_account_policy"))
        .rows.length,
      1,
    );
    await assert.rejects(
      db.exec("select updated_by from public.robux_account_policy"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select * from public.robux_account_policy_acceptances"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select * from public.robux_account_deliveries"),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
  const rows = (
    await db.query<{ role: string; allowed: boolean }>(
      "select r as role,has_function_privilege(r,'public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric)','execute') allowed from unnest(array['anon','authenticated','service_role']) r",
    )
  ).rows;
  assert(rows.every((r) => !r.allowed));
  await assert.rejects(
    db.query("select public.save_robux_account_policy($1,$2,$3)", [
      ids.user,
      (await policy()).body,
      (await policy()).version,
    ]),
    /administrativo/,
  );
});
test("SQL de verificação adicional não mostra senhas e confirma permissões", async () => {
  const results = await db.exec(
    await readFile("supabase/verificacoes/202610090002_check.sql", "utf8"),
  );
  assert.equal(results[0].rows.length, 3);
  assert(results[0].rows.every((r) => r.exists && r.rls_enabled));
  assert(
    results[1].rows.every(
      (r) =>
        !r.anon_can_execute && !r.customer_can_execute && r.server_can_execute,
    ),
  );
});
