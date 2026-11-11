import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { automaticProductSlug, persistWithUniqueSlug } from "../lib/product-slug";
import { updateProductAtRevision } from "../lib/product-update";

test("nomes iguais entre jogos têm URLs distintas; normalização e limites são válidos", () => {
  assert.equal(automaticProductSlug("king-legacy", "Dragón"), "king-legacy-dragon");
  assert.equal(automaticProductSlug("blox-fruits", "Dragon"), "blox-fruits-dragon");
  for (const max of [90, 100]) {
    const slug = automaticProductSlug("j".repeat(100), "p".repeat(100), max);
    assert.ok(slug.length <= max);
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("cadastros concorrentes e colisões com produtos antigos preservam UUIDs e geram URLs únicas", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table products(id uuid primary key default gen_random_uuid(), slug text unique); insert into products(slug) values('king-legacy-dragon')");
    const before = await db.query("select id,slug from products");
    const create = () => persistWithUniqueSlug("king-legacy-dragon", async (slug) => {
      try { const r = await db.query("insert into products(slug) values($1) returning id,slug", [slug]); return { data: r.rows[0], error: null }; }
      catch (e) { const error = e as { code: string; message: string; detail: string }; return { data: null, error: { ...error, details: error.detail, code: error.code, message: error.message } }; }
    });
    const results = await Promise.all(Array.from({ length: 6 }, create));
    assert.ok(results.every(r => !r.result.error && r.result.data));
    assert.equal(new Set(results.map(r => r.slug)).size, 6);
    const after = await db.query("select id,slug from products where slug='king-legacy-dragon'");
    assert.deepEqual(after.rows, before.rows);
  } finally { await db.close(); }
});

test("falhas de rede, constraints de UUID e slugs manuais não provocam novas gravações", async () => {
  for (const [error, automatic] of [
    [{ code: "23505", details: "Key (id)=(x) already exists." }, true],
    [{ code: "network" }, true],
    [{ code: "23505", details: "Key (slug)=(x) already exists." }, false],
  ] as const) {
    let calls = 0;
    const r = await persistWithUniqueSlug("dragon", async () => { calls++; return { error }; }, automatic);
    assert.equal(calls, 1); assert.equal(r.result.error, error);
  }
});

test("edição rápida envia revisão original: só uma das duas edições simultâneas pode gravar", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table products(id text primary key, ops_version integer, stock integer); insert into products values('produto',0,10)");
    const client = createClient("http://127.0.0.1:54321", "local-test", { auth: { persistSession: false }, global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        const rev = Number(url.searchParams.get("ops_version")?.replace(/^eq\./, ""));
        const values = JSON.parse(String(init?.body));
        const r = await db.query("update products set stock=$1,ops_version=ops_version+1 where id=$2 and ops_version=$3 returning id,ops_version", [values.stock,id,rev]);
        return new Response(JSON.stringify(r.rows[0] ?? null), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    } });
    const results = await Promise.all([updateProductAtRevision(client,"produto",0,{stock:7}), updateProductAtRevision(client,"produto",0,{stock:2})]);
    assert.equal(results.filter(r => r.data).length, 1);
    const r = await db.query<{stock:number;ops_version:number}>("select stock,ops_version from products");
    assert.equal(r.rows[0].ops_version,1);
    assert.ok([7,2].includes(r.rows[0].stock));
    assert.throws(() => updateProductAtRevision(client,"produto",NaN,{stock:0}));
  } finally { await db.close(); }
});
