// Regressão HTTP da aplicação compilada. Usa apenas Supabase simulado em localhost.
// Executar: node qa/check-admin-order-actions.cjs (inclui um build com dados fictícios).
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3110';
const nextBin = path.join(root, 'node_modules/next/dist/bin/next');
const now = new Date().toISOString();
const adminId = '20000000-0000-4000-8000-000000000002';
const orderId = '30000000-0000-4000-8000-000000000001';
const orderPath = `/admin/pedidos/${orderId}`;
const logPath = path.join(os.tmpdir(), 'cosmic-admin-order-actions.log');
const user = { id: adminId, aud: 'authenticated', role: 'authenticated', email: 'admin@example.invalid', created_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [] };
const order = {
  id: orderId, user_id: adminId, order_code: 'COSMIC-TESTE-LOCAL',
  order_type: 'product', status: 'preparing_delivery', game_nickname: 'Teste',
  total: 34, subtotal: 34, discount_total: 0, coupon_code: null,
  created_at: now, proof_path: null, chat_closed_at: null,
  payment_email_sent_at: now, delivery_email_sent_at: now,
  profiles: { nickname: 'Cliente de teste' }, robux_orders: null,
  order_items: [{ product_name: 'Produto de teste', quantity: 1, unit_price: 34 }],
};
const account = {
  order_id: orderId, robux: 1000, cosmic_k: 34, sale_price: 34,
  supplier_k: 29, supplier_cost: 29, margin_per_thousand: 5, min_cosmic_k: 34,
  masked_id: '*****660', quote_id: 'quote-test', provider_id: 'offer-test',
  quote_url: 'https://www.byrobux.net/accounts/test?catalog=alternate',
  acquired_at: now, snapshot_at: now, last_validated_at: now,
  reservation_until: now, availability: 'available', last_validation_error: null,
};
const testEnv = {
  ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-test-placeholder',
  SUPABASE_SERVICE_ROLE_KEY: 'local-test-placeholder',
  NEXT_PUBLIC_SITE_URL: 'https://www.cosmicstore.com.br',
  ROBUX_ACCOUNT_DELIVERY_KEY: '', BYROBUX_API_KEY: '',
  DISCORD_BOT_TOKEN: '', DISCORD_ADMIN_WEBHOOK_URL: '',
  GMAIL_CLIENT_ID: '', GMAIL_CLIENT_SECRET: '', GMAIL_REFRESH_TOKEN: '',
};
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: adminId, aud: 'authenticated', role: 'authenticated', exp })}.local-test-signature`;
const cookie = `sb-127-auth-token=base64-${enc({ access_token: token, refresh_token: 'local-test-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user })}`;
let next;
let delivery = null;
let databaseError = null;
let hasImage = false;
let transitions = 0;
let notifications = 0;
let encryptedSaves = 0;
let catalogSyncAttempts = 0;
const checks = [];
const priceOffers = [350,400,450,500,750,1000,1990].map(robux => {
  const providerId = `price-test-${robux}`, quoteUrl = 'https://www.byrobux.net/accounts/test?catalog=alternate';
  const hash = value => createHash('sha256').update(value).digest('hex');
  return { id: hash(quoteUrl+providerId), providerId, maskedId: '***660', robux,
    supplierK: 29, supplierPrice: robux*29/1000, quoteId: hash(quoteUrl), quoteUrl, seenAt: now };
});

const mock = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const url = new URL(req.url, 'http://localhost');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  const send = data => res.end(JSON.stringify(data));
  const fail = (message, code = 'P0001') => { res.statusCode = 400; send({ code, message }); };
  if (url.pathname === '/auth/v1/user') return send(user);
  if (req.method === 'HEAD') { res.setHeader('Content-Range', '*/0'); return res.end(); }
  if (url.pathname === '/rest/v1/rpc/robux_account_claim_sync') {
    catalogSyncAttempts++;
    // Simula o intervalo/cache compartilhado: não consulta fornecedor neste teste.
    return send(false);
  }
  if (url.pathname === '/rest/v1/rpc/transition_store_order') {
    assert.equal(body.p_admin_id, adminId);
    assert.equal(body.p_order_id, orderId);
    if (databaseError) return fail(databaseError.message, databaseError.code);
    if (body.p_expected_status !== order.status) return fail('Outro administrador alterou este pedido. Atualize a página.');
    if (body.p_status === 'delivered' && order.order_type === 'robux_account' && !delivery)
      return fail('Salve o usuário e a senha da conta antes de concluir a entrega.');
    if (body.p_status === 'delivered' && order.order_type === 'product' && !hasImage)
      return fail('Envie a imagem da entrega no chat antes de concluir.');
    if (body.p_status === 'proof_rejected' && body.p_reason.trim().length < 5)
      return fail('Informe o motivo da recusa.');
    if (body.p_status === order.status) return send({ changed: false });
    transitions++;
    order.status = body.p_status;
    return send({ changed: true, order });
  }
  if (url.pathname === '/rest/v1/rpc/save_robux_account_delivery') {
    assert.equal(body.p_order_id, orderId);
    assert.equal(body.p_admin_id, adminId);
    assert(!JSON.stringify(body).includes('senha-ficticia-de-teste'));
    assert(!JSON.stringify(body).includes('UsuarioTesteRoblox'));
    delivery = { encrypted_credentials: body.p_encrypted, updated_at: now };
    encryptedSaves++;
    return send(null);
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return send(null);
  const table = url.pathname.split('/').at(-1);
  if (table === 'notifications' && req.method === 'POST') notifications++;
  if (['POST', 'PATCH'].includes(req.method)) return send(null);
  const values = {
    admins: [{ user_id: adminId, role: 'owner' }],
    profiles: [{ id: adminId, nickname: 'Teste Admin', avatar_url: null }],
    orders: [order], robux_account_orders: [account],
    robux_account_deliveries: delivery ? [delivery] : [],
    robux_account_settings: [{ enabled: true, min_cosmic_k: 34, margin_per_thousand: 5 }],
    robux_account_policy: [{ version: '40000000-0000-4000-8000-000000000001', body: 'Política de teste local.', updated_at: now }],
    robux_account_catalog: [{ quotes: [], offers: priceOffers, diagnostics: [], last_success_at: now, last_complete_at: now, last_attempt_at: now, last_error: null, next_attempt_at: now, lease_until: null }],
  };
  const rows = values[table] ?? [];
  return send(String(req.headers.accept).includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows);
});

async function stopNext() {
  if (next && next.exitCode === null) {
    const stopped = once(next, 'exit');
    next.kill();
    await stopped;
  }
  next = undefined;
}
async function startNext(key = '') {
  const log = fs.openSync(logPath, 'a');
  next = spawn(process.execPath, [nextBin, 'start', '-p', '3110', '-H', '127.0.0.1'], {
    cwd: root, env: { ...testEnv, ROBUX_ACCOUNT_DELIVERY_KEY: key }, stdio: ['ignore', log, log],
  });
  fs.closeSync(log);
  for (let i = 0; i < 60; i++) {
    if (next.exitCode !== null) throw new Error(`Next não iniciou. Consulte ${logPath}`);
    try {
      const r = await fetch(base + orderPath, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(2000) });
      const html = await r.text();
      if (r.ok && html.includes(order.order_code)) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Next não respondeu. Consulte ${logPath}`);
}
async function page() {
  const r = await fetch(base + orderPath, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200);
  return r.text();
}
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
function formData(html, field, value) {
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)]
    .map(m => m[0]).find(f => [...f.matchAll(/<input\b[^>]*>/g)].some(m => m[0].includes(`name="${field}"`) && (value === undefined || m[0].includes(`value="${value}"`))));
  assert(form, `Formulário ${field}=${value} não encontrado`);
  const data = new FormData();
  for (const [input] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = input.match(/name="([^"]*)"/)?.[1];
    if (name) data.append(decode(name), decode(input.match(/value="([^"]*)"/)?.[1] ?? ''));
  }
  assert([...data.keys()].some(key => key.startsWith('$ACTION_')));
  return data;
}
async function submit(data) {
  const r = await fetch(base + orderPath, { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: data, signal: AbortSignal.timeout(20000) });
  const html = await r.text();
  assert.equal(r.status, 200, `HTTP ${r.status}`);
  assert(html.includes(order.order_code), 'O pedido deve continuar visível');
  assert(!html.includes('Minified React error #441'));
  return html;
}
function inlineError(html, message) {
  assert([...html.matchAll(/<p\b[^>]*role="alert"[^>]*>([\s\S]*?)<\/p>/g)]
    .some(m => decode(m[1]).includes(message)), `Aviso inline ausente: ${message}`);
  assert.equal(transitions, 0, 'Recusa não pode alterar o pedido');
  assert.equal(notifications, 0, 'Recusa não pode notificar entrega');
  checks.push(message);
}

(async () => {
  if (!process.argv.includes('--skip-build')) {
    const log = fs.openSync(logPath, 'w');
    const build = spawnSync(process.execPath, [nextBin, 'build'], { cwd: root, env: testEnv, stdio: ['ignore', log, log] });
    fs.closeSync(log);
    assert.equal(build.status, 0, `Build falhou. Consulte ${logPath}`);
  }
  await new Promise(resolve => mock.listen(54329, '127.0.0.1', resolve));
  await startNext();

  const catalogResponse = await fetch(base + '/api/robux/accounts/catalog?sort=value');
  assert.equal(catalogResponse.status,200);
  const catalog = await catalogResponse.json();
  assert.deepEqual(catalog.offers.map(o=>o.robux),[1000,1990,750,500,450,400,350]);
  const expectedPrices = {350:15,400:16,450:17,500:18.55,750:26.27,1000:34,1990:67.66};
  for (const o of catalog.offers) {
    assert.equal(o.cosmicK,34);
    assert.equal(o.price,expectedPrices[o.robux]);
    assert.deepEqual(Object.keys(o).sort(),['available','cosmicK','id','options','price','robux']);
  }
  assert(!/supplier|margin|maskedId|quoteUrl|byrobux|pricing_rule/.test(JSON.stringify(catalog)));
  checks.push('API pública usa preços por faixa, preserva K base e ordena pelo preço efetivo por Robux');

  const attemptsBeforeAdmin = catalogSyncAttempts;
  const adminCatalog = await fetch(base + '/admin/robux/contas', { headers: { Cookie: cookie } });
  assert.equal(adminCatalog.status, 200);
  const adminHtml = await adminCatalog.text();
  assert(adminHtml.includes('Não é necessário apertar o botão.'));
  assert(adminHtml.includes('K base Cosmic'));
  for (let i = 0; i < 30 && catalogSyncAttempts === attemptsBeforeAdmin; i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert(catalogSyncAttempts > attemptsBeforeAdmin, 'O simples acesso do Admin deve iniciar a sincronização');
  const previousAttempts = catalogSyncAttempts;
  const nextView = await fetch(base + '/admin/robux/contas', { headers: { Cookie: cookie } });
  await nextView.text();
  for (let i = 0; i < 30 && catalogSyncAttempts === previousAttempts; i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert(catalogSyncAttempts > previousAttempts, 'A atualização do painel deve consultar novamente o controle de sincronização');
  checks.push('Abrir/atualizar o Admin inicia a sincronização após a resposta sem clicar em Consultar');

  let html = await submit(formData(await page(), 'status', 'delivered'));
  inlineError(html, 'Envie a imagem da entrega no chat antes de concluir.');
  assert.equal(order.status, 'preparing_delivery');

  order.order_type = 'robux_account';
  html = await page();
  assert(html.includes('Como configurar na Vercel'));
  assert(!html.includes('name="password"'));
  html = await submit(formData(html, 'status', 'delivered'));
  inlineError(html, 'Salve o usuário e a senha da conta antes de concluir a entrega.');

  order.order_type = 'product';
  const stale = formData(await page(), 'status', 'delivered');
  order.status = 'cancelled';
  html = await submit(stale);
  // Sem ações disponíveis após cancelamento, o estado atual ainda deve aparecer na página.
  assert(html.includes('Cancelado'));
  assert.equal(transitions, 0);
  assert.equal(notifications, 0);
  checks.push('Pedido alterado por outro Admin não é sobrescrito');

  order.status = 'preparing_delivery';
  databaseError = { code: '42883', message: 'internal SQL details must stay private' };
  html = await submit(formData(await page(), 'status', 'delivered'));
  inlineError(html, 'Não foi possível atualizar o pedido. Confira a atualização SQL.');
  assert(!html.includes(databaseError.message));
  databaseError = null;

  order.status = 'proof_submitted';
  html = await submit(formData(await page(), 'status', 'proof_rejected'));
  inlineError(html, 'Informe o motivo da recusa.');

  order.status = 'preparing_delivery';
  order.order_type = 'robux_account';
  await stopNext();
  await startNext(randomBytes(32).toString('hex'));
  html = await page();
  assert(html.includes('name="username"') && html.includes('name="password"'));
  assert(!html.includes('Como configurar na Vercel'));
  let data = formData(html, 'username');
  html = await submit(data);
  assert([...html.matchAll(/role="alert"[^>]*>([\s\S]*?)<\/p>/g)].some(m => m[1].includes('usuário')));
  assert.equal(encryptedSaves, 0);
  data = formData(html, 'username');
  data.set('username', 'UsuarioTesteRoblox');
  data.set('password', 'senha-ficticia-de-teste');
  html = await submit(data);
  assert.equal(encryptedSaves, 1);
  assert(html.includes('Dados salvos.'));
  checks.push('Chave válida libera o formulário; gravação vazia recusada; dados completos cifrados');
  html = await submit(formData(html, 'status', 'delivered'));
  assert.equal(order.status, 'delivered');
  assert.equal(transitions, 1);
  assert.equal(notifications, 1);
  assert.equal(hasImage, false);
  checks.push('Conta com credenciais conclui sem imagem após corrigir os dados');
  console.log(JSON.stringify({ ok: true, checks, scope: 'HTTP/Server Actions reais; Supabase simulado; sem serviços externos, navegador ou banco de produção' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await stopNext();
  mock.closeAllConnections();
  mock.close();
});
