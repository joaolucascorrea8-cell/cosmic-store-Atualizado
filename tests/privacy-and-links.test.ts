import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { createDatabase, ids } from "./fixture";
import { gamePassLink } from "../lib/gamepass-link";

let db: PGlite;
before(async () => { db = await createDatabase(); });
after(async () => { await db.close(); });
test("Game Pass aceita apenas Roblox HTTPS, um alvo e ID consistente", () => {
  assert.deepEqual(gamePassLink("https://www.roblox.com/pt-br/game-pass/123456/Exemplo?x=1"), { id: "123456", url: "https://www.roblox.com/game-pass/123456" });
  for (const link of ["http://www.roblox.com/game-pass/123", "https://roblox.com.evil.invalid/game-pass/123", "https://user:password@roblox.com/game-pass/123", "https://roblox.com:8443/game-pass/123", "https://roblox.com/catalog/123", "https://roblox.com/game-pass/123\nhttps://roblox.com/game-pass/456", "https://127.0.0.1/game-pass/123"]) assert.equal(gamePassLink(link), null);
});
test("nickname/avatar continuam disponíveis sem expor nem permitir forjar vínculo Discord", async () => {
  await db.exec(`grant usage on schema public,auth to authenticated; set role authenticated; select set_config('request.jwt.claim.sub','${ids.user}',false);`);
  assert.equal((await db.query("select id,nickname,avatar_url from public.profiles")).rows.length, 2);
  await assert.rejects(db.query("select discord_id from public.profiles"), /permission denied/);
  await assert.rejects(db.query("select auth_provider from public.profiles"), /permission denied/);
  await assert.rejects(db.query("update public.profiles set discord_id='123' where id=$1", [ids.user]), /permission denied/);
  await db.query("update public.profiles set nickname='ClienteTeste' where id=$1", [ids.user]);
  const result = await db.query("update public.profiles set nickname='OutroNome' where id=$1 returning id", [ids.admin]);
  assert.equal(result.rows.length, 0);
  await db.exec("reset role");
});
test("comprovante só entra em pedido próprio aberto e não pode ser substituído depois", async () => {
  await db.exec(`insert into public.orders(order_code,user_id,game_nickname,total,pix_payload,checkout_token) values('PROOF-TEST','${ids.user}','Cliente',20,'000201-ficticio',gen_random_uuid());
    alter table storage.objects enable row level security;
    grant usage on schema storage,public,auth to authenticated;
    grant select,insert,update on storage.objects to authenticated;
    grant select on public.orders to authenticated;
    set role authenticated; select set_config('request.jwt.claim.sub','${ids.user}',false);`);
  const id = (await db.query<{ id: string }>("select id from public.orders where order_code='PROOF-TEST'")).rows[0].id;
  const file = `${ids.user}/${id}/comprovante.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('payment-proofs',$1)", [file]);
  const updated = await db.query("update storage.objects set name=name where name=$1 returning id", [file]);
  assert.equal(updated.rows.length, 0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('payment-proofs',$1)", [`${ids.user}/${ids.admin}/comprovante.png`]), /row-level security/);
  await db.exec("reset role; update public.orders set status='proof_submitted' where order_code='PROOF-TEST'; set role authenticated;");
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('payment-proofs',$1)", [`${ids.user}/${id}/comprovante-novo.png`]), /row-level security/);
  await db.exec("reset role");
});
