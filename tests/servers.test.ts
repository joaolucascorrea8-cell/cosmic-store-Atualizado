import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import { serverJoinUrl, serverRequestFields } from "../lib/game-servers";
import { livePageConfig } from "../lib/live-pages";
let db: PGlite;
before(async () => {
  db = await createDatabase();
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "reset role;truncate public.support_tickets,public.game_servers cascade;select set_config('request.jwt.claim.sub','',false)",
  );
});

test("links de servidor preservam convites e recusam protocolos ou credenciais inválidos", () => {
  const url = "https://www.roblox.com/share?code=AbC123&type=Server";
  assert.equal(serverJoinUrl(url), url);
  for (const input of [
    "javascript:alert(1)",
    "http://roblox.com/share",
    "https://owner:password@roblox.com/share",
    "https://roblox.com/\nshare",
    "https://localhost",
    "/servidor",
  ])
    assert.equal(serverJoinUrl(input), null);
  assert.equal(
    serverRequestFields(
      "  Jogo fora do catálogo  ",
      "Quero um servidor para jogar com amigos.",
    ).gameName,
    "Jogo fora do catálogo",
  );
  assert.ok(serverRequestFields("a", "Mensagem válida").error);
  assert.ok(serverRequestFields("Jogo", "oi").error);
});

test("pedido de servidor aceita jogo fora do catálogo, é atômico e não duplica mensagens", async () => {
  const token = randomUUID();
  const query = "select public.create_store_server_request($1,$2,$3,$4) result";
  const args = [
    ids.user,
    token,
    "Um jogo que ainda não vendemos",
    "Quero um servidor para jogar com amigos.",
  ];
  const first = (
    await db.query<{
      result: {
        created: boolean;
        ticket: { id: string; category: string; requested_game: string };
      };
    }>(query, args)
  ).rows[0].result;
  const second = (
    await db.query<{ result: { created: boolean; ticket: { id: string } } }>(
      query,
      args,
    )
  ).rows[0].result;
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.ticket.id, second.ticket.id);
  assert.equal(first.ticket.category, "server_request");
  assert.equal(first.ticket.requested_game, args[2]);
  assert.equal(
    (await db.query("select * from public.support_messages")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.games where name=$1", [args[2]])).rows
      .length,
    0,
  );
  await assert.rejects(db.query(query, [ids.user, randomUUID(), "Jogo", "oi"]));
  assert.equal(
    (await db.query("select * from public.support_tickets")).rows.length,
    1,
  );
});

test("solicitações de servidor usam o suporte existente e filtro não esconde atendimentos comuns", async () => {
  await db.query(
    "select public.create_store_server_request($1,$2,'Jogo novo','Quero um servidor para farm.')",
    [ids.user, randomUUID()],
  );
  await db.query(
    "select public.create_store_support_ticket($1,$2,'Dúvida sobre Pix','payment','Preciso de ajuda com meu pagamento.')",
    [ids.user, randomUUID()],
  );
  const query =
    "select public.list_store_support_filtered($1,'','priority',1,$2) result";
  const filtered = (
    await db.query<{ result: { total: number; rows: { category: string }[] } }>(
      query,
      ["novo", "server_request"],
    )
  ).rows[0].result;
  assert.equal(filtered.total, 1);
  assert.equal(filtered.rows[0].category, "server_request");
  assert.equal(
    (await db.query<{ result: { total: number } }>(query, ["", ""])).rows[0]
      .result.total,
    2,
  );
});

test("servidores ocultos e sinais administrativos permanecem protegidos por RLS", async () => {
  await db.exec(
    "insert into public.game_servers(game_name,name,join_url,is_active) values('Blox Fruits','Publicado','https://www.roblox.com/share?code=publico',true),('Outro jogo','Oculto','https://www.roblox.com/share?code=privado',false)",
  );
  await db.exec("set role anon");
  try {
    assert.equal(
      (await db.query("select * from public.game_servers")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.store_live_updates where scope='admin'",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        "insert into public.game_servers(game_name,name,join_url) values('Jogo','Teste','https://example.com/server')",
      ),
    );
  } finally {
    await db.exec("reset role");
  }
  await db.exec(
    `select set_config('request.jwt.claim.sub','${ids.user}',false);set role authenticated`,
  );
  try {
    assert.equal(
      (await db.query("select * from public.game_servers")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.store_live_updates where scope='admin'",
        )
      ).rows.length,
      0,
    );
    const names = [
      "create_store_server_request",
      "list_store_support_filtered",
      "signal_store_live_update",
      "touch_game_server",
    ];
    assert.equal(
      (
        await db.query(
          "select proname from pg_proc where proname=any($1) and has_function_privilege('authenticated',oid,'EXECUTE')",
          [names],
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.exec("reset role");
  }
  await db.exec(
    `select set_config('request.jwt.claim.sub','${ids.admin}',false);set role authenticated`,
  );
  try {
    assert.equal(
      (await db.query("select * from public.game_servers")).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.store_live_updates where scope='admin'",
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.exec("reset role");
  }
});

test("ocultar e excluir servidores gera sinal público, e SQL pode ser reaplicado sem perder dados", async () => {
  const version = async () =>
    (
      await db.query<{ version: number }>(
        "select version from public.store_live_updates where scope='servers'",
      )
    ).rows[0].version;
  const before = await version();
  const { rows } = await db.query<{ id: string }>(
    "insert into public.game_servers(game_name,name,join_url) values('Jogo livre','Servidor 1','https://example.com/server') returning id",
  );
  assert.ok((await version()) > before);
  const inserted = await version();
  await db.query("update public.game_servers set is_active=false where id=$1", [
    rows[0].id,
  ]);
  assert.ok((await version()) > inserted);
  await db.exec(
    await readFile(
      "supabase/migrations/202610040001_servers_live_pages.sql",
      "utf8",
    ),
  );
  assert.equal(
    (await db.query("select * from public.game_servers")).rows.length,
    1,
  );
  const hidden = await version();
  await db.query("delete from public.game_servers where id=$1", [rows[0].id]);
  assert.ok((await version()) > hidden);
  const published = (
    await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname='supabase_realtime'",
    )
  ).rows.map((row) => row.tablename);
  for (const table of [
    "orders",
    "notifications",
    "support_tickets",
    "store_live_updates",
  ])
    assert.ok(published.includes(table));
});

test("atualizações automáticas cobrem catálogos e listas sem entrar no login ou checkout", () => {
  for (const route of [
    "/",
    "/produtos",
    "/jogos",
    "/blox-fruits/permanentes",
    "/servidores",
    "/admin",
    "/admin/servidores",
    "/admin/pedidos",
    "/admin/robux/contas",
    "/admin/suporte",
    "/pedidos",
    "/suporte",
  ])
    assert.ok(livePageConfig(route), route);
  for (const route of [
    "/login",
    "/checkout",
    "/carrinho",
    "/servidores/pedir",
    "/admin/produtos/abc/editar",
    "/pedidos/abc",
    "/notificacoes",
  ])
    assert.equal(livePageConfig(route), null, route);
});
