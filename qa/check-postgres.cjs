// PostgreSQL real com duas conexões, em container efêmero sem rede ou portas publicadas.
// node --import tsx qa/check-postgres.cjs (imagem postgres:17-alpine deve existir)
const { execFileSync, spawn } = require('node:child_process');
const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { bootstrapSql, fixtureSeedSql, ids } = require('../tests/fixture.ts');
const env = { ...process.env };
for (const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key];
const name = 'cosmic-final-' + randomUUID().slice(0, 8);
const docker = ['--host=unix:///var/run/docker.sock'];
const results = [];
const run = args => execFileSync('docker', [...docker, ...args], { env, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const args = ['exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'];
const sql = input => execFileSync('docker', [...docker, ...args], { env, input, encoding: 'utf8', maxBuffer: 8e6, stdio: ['pipe','pipe','pipe'] }).trim();
const concurrent = input => new Promise(resolve => {
  const p = spawn('docker', [...docker, ...args], { env, stdio: ['pipe','pipe','pipe'] });
  let stdout = '', stderr = '';
  p.stdout.on('data', c => stdout += c); p.stderr.on('data', c => stderr += c);
  p.on('close', code => resolve({ code, stdout: stdout.trim(), stderr }));
  p.stdin.end(`begin; ${input}; select pg_sleep(0.3); commit;`);
});
const create = (token = randomUUID(), buyer = ids.user) => `select public.create_store_order_with_coupon('${buyer}','${token}','ClienteTeste','TEST-${randomUUID()}','000201-ficticio-nao-pagar','[{"id":"${ids.a}","quantity":1,"unit_price":20}]',20,'')`;
const confirm = (id, reference) => `select public.confirm_manual_store_payment('${id}','${ids.admin}','awaiting_payment',20,'${reference}',true,'Conferência fictícia no extrato')`;
const reset = () => sql('truncate public.orders cascade; update public.products set stock=1,unlimited_stock=false;');
async function check(scenario, fn) { await fn(); results.push({ scenario, status: 'PASS' }); console.log('PASS ' + scenario); }

(async () => {
  let started = false;
  try {
    run(['run','-d','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']); started = true;
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try { run(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']); ready = true; break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ready, 'PostgreSQL não iniciou');
    sql(bootstrapSql);
    const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
    for (const f of files.filter(f => f < '202611120001')) sql(readFileSync('supabase/migrations/' + f, 'utf8'));
    sql(fixtureSeedSql);
    const old = JSON.parse(sql(create()));
    sql(`select public.transition_store_order('${old.order.id}','${ids.admin}','paid','awaiting_payment','');`);
    const snapshotQuery = `select jsonb_build_object('orders',(select jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'code',order_code,'status',status,'paid_at',paid_at,'total',total,'pix_payload',pix_payload)) from public.orders),'items',(select jsonb_agg(to_jsonb(i)) from public.order_items i),'products',(select jsonb_agg(to_jsonb(p)) from public.products p))`;
    const before = JSON.parse(sql(snapshotQuery));
    for (const f of files.filter(f => f >= '202611120001')) sql(readFileSync('supabase/migrations/' + f, 'utf8'));
    await check('upgrade preserva pedidos, itens e estoque históricos sem notificações ou conciliação inventadas', async () => {
      assert.deepEqual(JSON.parse(sql(snapshotQuery)), before);
      assert.equal(sql('select count(*) from public.order_email_jobs'), '0');
      assert.equal(sql('select count(*) from public.order_payment_confirmations'), '0');
    });
    await check('upsert do próprio perfil funciona com RLS sem liberar campos privados', async () => {
      sql(`grant usage on schema public,auth to authenticated; set role authenticated;
        select set_config('request.jwt.claim.sub','${ids.user}',false);
        insert into public.profiles(id,nickname,avatar_url,onboarding_completed) values('${ids.user}','ClienteTeste',null,true)
        on conflict(id) do update set id=excluded.id,nickname=excluded.nickname,avatar_url=excluded.avatar_url,onboarding_completed=excluded.onboarding_completed;`);
      assert.throws(() => sql(`set role authenticated;select discord_id from public.profiles`));
      assert.equal(sql('select public.store_checkout_ready()'), 't');
    });
    await check('duas conexões disputam a última unidade: somente uma cria pedido', async () => {
      reset(); const r = await Promise.all([concurrent(create()), concurrent(create(randomUUID(), ids.admin))]);
      assert.equal(r.filter(x => x.code === 0).length, 1);
      assert.equal(sql(`select stock from public.products where id='${ids.a}'`), '0');
      assert.equal(sql('select count(*) from public.orders'), '1');
    });
    await check('retry simultâneo do mesmo token retorna o mesmo pedido e uma reserva', async () => {
      reset(); const token = randomUUID(), r = await Promise.all([concurrent(create(token)), concurrent(create(token))]);
      assert.ok(r.every(x => x.code === 0), r.map(x => x.stderr).join('\n'));
      const data = r.map(x => JSON.parse(x.stdout));
      assert.equal(data[0].order.id, data[1].order.id);
      assert.equal(data.filter(x => x.created).length, 1);
    });
    await check('duas confirmações não reutilizam a mesma transação bancária', async () => {
      reset(); sql('update public.products set stock=2');
      const a = JSON.parse(sql(create())).order.id, b = JSON.parse(sql(create())).order.id;
      const r = await Promise.all([concurrent(confirm(a, 'BANK-TEST-UNIQUE')), concurrent(confirm(b, 'BANK-TEST-UNIQUE'))]);
      assert.equal(r.filter(x => x.code === 0).length, 1);
      assert.equal(sql("select count(*) from public.orders where status='paid'"), '1');
    });
    await check('último uso do cupom é serializado com reserva e total descontado', async () => {
      reset(); sql("update public.products set stock=2; insert into public.store_coupons(code,kind,amount,is_active,max_uses,per_user_limit) values('FINAL10','fixed',2,true,1,100)");
      const discounted = () => create().replace(",20,'')", ",18,'FINAL10')");
      const r = await Promise.all([concurrent(discounted()), concurrent(discounted())]);
      assert.equal(r.filter(x => x.code === 0).length, 1);
      assert.equal(sql('select total from public.orders'), '18.00');
      assert.equal(sql(`select stock from public.products where id='${ids.a}'`), '1');
    });
    await check('devoluções concorrentes não ultrapassam total pago; fila tem um único executor', async () => {
      reset(); const id = JSON.parse(sql(create())).order.id; sql(confirm(id, 'BANK-REFUND-TEST'));
      const refund = () => `select public.record_manual_store_refund('${id}','${ids.admin}','${randomUUID()}',15,'REFUND-${randomUUID()}','Devolução fictícia de teste',true)`;
      const r = await Promise.all([concurrent(refund()), concurrent(refund())]);
      assert.equal(r.filter(x => x.code === 0).length, 1);
      const claim = `select jsonb_build_object('token',public.claim_order_email('${id}','payment',false))`;
      const claims = await Promise.all([concurrent(claim), concurrent(claim)]);
      assert.ok(claims.every(x => x.code === 0));
      assert.equal(claims.map(x => JSON.parse(x.stdout)).filter(x => x.token).length, 1);
    });
    await check('Game Pass concorrente mantém uma tentativa e bloqueia cancelamento durante envio', async () => {
      reset();
      const o = JSON.parse(sql(`select public.create_robux_store_order('${ids.user}','${randomUUID()}','TEST-${randomUUID()}','000201-ficticio-nao-pagar',20,'tax_not_paid',500,500,350,'https://www.roblox.com/game-pass/123456','123456','ClienteRoblox',25,40,12.5)`));
      sql(confirm(o.order.id, 'BANK-GAMEPASS-TEST'));
      const q = `select public.claim_gamepass_execution('${o.order.id}','${ids.admin}','${o.robux.supplier_request_id}')`;
      const r = await Promise.all([concurrent(q), concurrent(q)]);
      assert.equal(r.filter(x => x.code === 0).length, 1);
      assert.throws(() => sql(`select public.transition_store_order('${o.order.id}','${ids.admin}','cancelled','paid','')`));
    });
    await check('referência bancária não é reutilizada entre confirmação e recebimento excepcional concorrentes', async () => {
      reset(); sql('update public.products set stock=2');
      const a = JSON.parse(sql(create())).order.id, b = JSON.parse(sql(create())).order.id;
      const extra = `select public.record_additional_store_payment('${b}','${ids.admin}','${randomUUID()}',20,'BANK-CROSS-TEST','Recebimento excepcional fictício',true)`;
      const r = await Promise.all([concurrent(confirm(a, 'BANK-CROSS-TEST')), concurrent(extra)]);
      assert.equal(r.filter(x => x.code === 0).length, 1);
      assert.equal(sql('select (select count(*) from public.order_payment_confirmations)+(select count(*) from public.order_additional_payments)'), '1');
    });
    await check('dump e restauração isolada preservam pedidos, conciliação, créditos, devoluções e fila', async () => {
      reset(); const id = JSON.parse(sql(create())).order.id; sql(confirm(id, 'BANK-DUMP-TEST'));
      sql(`select public.record_additional_store_payment('${id}','${ids.admin}','${randomUUID()}',5,'CREDIT-DUMP-TEST','Recebimento fictício',true);
        select public.record_manual_store_refund('${id}','${ids.admin}','${randomUUID()}',10,'REFUND-DUMP-TEST','Devolução fictícia',true);`);
      const query = "select jsonb_build_object('orders',(select jsonb_agg(to_jsonb(o)) from public.orders o),'items',(select jsonb_agg(to_jsonb(i)) from public.order_items i),'payments',(select jsonb_agg(to_jsonb(p)) from public.order_payment_confirmations p),'credits',(select jsonb_agg(to_jsonb(a)) from public.order_additional_payments a),'refunds',(select jsonb_agg(to_jsonb(r)) from public.order_refunds r),'emails',(select jsonb_agg(to_jsonb(j)) from public.order_email_jobs j))";
      const before = JSON.parse(sql(query));
      run(['exec',name,'createdb','-U','postgres','restore_final']);
      const dump = execFileSync('docker', [...docker,'exec',name,'pg_dump','-U','postgres','-Fc'], { env, maxBuffer: 16e6, stdio: ['pipe','pipe','pipe'] });
      execFileSync('docker', [...docker,'exec','-i',name,'pg_restore','-U','postgres','-d','restore_final','--clean','--if-exists','--no-owner','--exit-on-error'], { env, input: dump, stdio: ['pipe','pipe','pipe'] });
      const after = execFileSync('docker', [...docker,...args,'-d','restore_final'], { env, input: query, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
      assert.deepEqual(JSON.parse(after), before);
    });
    const report = { database: sql('select version()'), isolation: 'Container efêmero --network none, sem portas; dados fictícios; conexões psql independentes', results };
    writeFileSync('qa/results/final-postgres.json', JSON.stringify(report, null, 2) + '\n');
  } finally { if (started) run(['stop','-t','1',name]); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
