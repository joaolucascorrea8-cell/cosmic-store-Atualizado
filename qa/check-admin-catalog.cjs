// Homologação isolada: node --import tsx qa/check-admin-catalog.cjs
// Apenas dados sintéticos; Supabase HTTP local sobre PostgreSQL/PGlite em memória.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createDatabase, ids } = require('../tests/fixture.ts');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3120';
const api = 'http://127.0.0.1:54328';
const results = [], adapterErrors = [], browserErrors = [], externalRequests = [];
let db, server, app, browser;
const now = new Date().toISOString();
const gameKL = '30000000-0000-4000-8000-000000000002';
const catKL = '40000000-0000-4000-8000-000000000002';
const user = { id: ids.admin, aud: 'authenticated', role: 'authenticated', email: 'admin@example.invalid', created_at: now, app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] };
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: ids.admin, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+7200 })}.local-test`;
const session = { access_token: token, refresh_token: 'local-test', expires_in: 7200, expires_at: Math.floor(Date.now()/1000)+7200, token_type: 'bearer', user };
const cookieValue = 'base64-' + enc(session);
// Explicit whitelist: never inherit application credentials or real Supabase URL.
const testEnv = require('./isolated-env.cjs')(api,base);
const qid = v => '"' + v.replace(/"/g,'""') + '"';
async function row(sql, params=[]) { return (await db.query(sql,params)).rows[0]; }
async function adapter(req, res) {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin',base);
  res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers']??'authorization,apikey,x-client-info,content-type,prefer,range');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
  if(req.method==='OPTIONS') return res.end();
  const u = new URL(req.url,api);
  const send = data => res.end(JSON.stringify(data));
  if(u.pathname.startsWith('/realtime/')) { res.statusCode=503; return send({message:'Realtime não simulado; polling disponível'}); }
  if(u.pathname==='/auth/v1/user') return send(user);
  if(u.pathname==='/auth/v1/token') return send(session);
  let raw='';for await(const chunk of req) raw+=chunk;
  const body=raw?JSON.parse(raw):null;
  try {
    const result = await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.headers',$2,true)",[ids.admin,JSON.stringify({'x-cosmic-actor':ids.admin})]);
      if(u.pathname.startsWith('/rest/v1/rpc/')) {
        const fn=u.pathname.split('/').at(-1);
        const allowed=['ops_import_products','set_product_preference','ops_record_issue'];
        if(!allowed.includes(fn)) throw new Error('RPC fora do escopo: '+fn);
        const keys=Object.keys(body);const params=keys.map(k=>['p_rows','p_items'].includes(k)?JSON.stringify(body[k]):body[k]);
        const call=keys.map((k,i)=>`${qid(k)} => $${i+1}${['p_rows','p_items'].includes(k)?'::jsonb':''}`).join(',');
        const r=await tx.query(`select public.${qid(fn)}(${call}) as result`,params);
        return {rpc:true,data:r.rows[0].result};
      }
      const table=u.pathname.split('/').at(-1);
      if(!/^[a-z_]+$/.test(table)) throw new Error('Tabela inválida');
      const cols=(await tx.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table])).rows.map(r=>r.column_name);
      if(!cols.length) throw new Error('Tabela não encontrada no fixture: '+table);
      let params=[], clauses=[];
      for(const [k,v]of u.searchParams){if(!cols.includes(k)) continue;const dot=v.indexOf('.'), op=v.slice(0,dot),value=v.slice(dot+1);
        if(op==='is'&&value==='null'){clauses.push(`${qid(k)} is null`);continue;}
        if(op==='in'){const a=value.replace(/^\(|\)$/g,'').split(',');const ph=a.map(x=>{params.push(x);return '$'+params.length});clauses.push(`${qid(k)} in (${ph.join(',')})`);continue;}
        if(['eq','neq','gt','lt','gte','lte','ilike'].includes(op)){params.push(value);clauses.push(`${qid(k)} ${{eq:'=',neq:'<>',gt:'>',lt:'<',gte:'>=',lte:'<=',ilike:'ilike'}[op]} $${params.length}`)}
      }
      const where=clauses.length?' where '+clauses.join(' and '):'';
      let sql;
      if(req.method==='POST'){
        const records=Array.isArray(body)?body:[body];const keys=Object.keys(records[0]).filter(k=>cols.includes(k));params=[];
        const values=records.map(record=>'('+keys.map(k=>{params.push(record[k]);return '$'+params.length}).join(',')+')');
        sql=`insert into public.${qid(table)} (${keys.map(qid).join(',')}) values ${values.join(',')} returning *`;
      }else if(req.method==='PATCH'){
        const sets=Object.keys(body).filter(k=>cols.includes(k)).map(k=>{params.push(body[k]);return `${qid(k)}=$${params.length}`});
        sql=`update public.${qid(table)} set ${sets.join(',')}${where} returning *`;
      }else{
        sql=`select * from public.${qid(table)}${where}`;
        const order=(u.searchParams.get('order')??'').split(',').map(x=>x.split('.')).filter(x=>cols.includes(x[0]));
        if(order.length) sql+=' order by '+order.map(([k,dir])=>qid(k)+(dir==='desc'?' desc':' asc')).join(',');
        const limit=Number(u.searchParams.get('limit')??500),offset=Number(u.searchParams.get('offset')??0);
        sql+=` limit ${Math.min(500,Math.max(0,limit))} offset ${Math.max(0,offset)}`;
      }
      const count = ['GET','HEAD'].includes(req.method) ? Number((await tx.query(`select count(*) from public.${qid(table)}${where}`,params)).rows[0].count) : null;
      const r=await tx.query(sql,params);let rows=r.rows;
      // Read-only relationship materialization, equivalent to selected PostgREST joins.
      if(table==='products'&&(u.searchParams.get('select')??'').includes('categories'))for(const p of rows){p.categories=(await tx.query('select c.*,row_to_json(g) as games from categories c join games g on g.id=c.game_id where c.id=$1',[p.category_id])).rows[0]}
      if(table==='orders')for(const o of rows){o.robux_orders=null;o.order_items=(await tx.query('select * from order_items where order_id=$1',[o.id])).rows}
      return {data:rows,count};
    });
    if(result.count!==null&&result.count!==undefined){res.setHeader('Content-Range',`0-${Math.max(0,result.data.length-1)}/${result.count}`);res.setHeader('Access-Control-Expose-Headers','Content-Range');}
    if(req.method==='HEAD')return res.end();
    if(result.rpc)return send(result.data);
    const object=String(req.headers.accept).includes('vnd.pgrst.object');
    return send(object?(result.data[0]??null):result.data);
  }catch(e){
    const expected=['23505','P0001'].includes(e.code);
    if(!expected)adapterErrors.push({path:u.pathname,method:req.method,message:e.message});
    res.statusCode=400;return send({code:e.code??'TEST_ADAPTER',message:e.message,details:e.detail});
  }
}
async function runChild(args,logName){const log=fs.openSync('/tmp/'+logName,'w');const child=spawn(process.execPath,args,{cwd:root,env:testEnv,stdio:['ignore',log,log]});fs.closeSync(log);const [code]=await once(child,'exit');assert.equal(code,0,`Falha: /tmp/${logName}`)}
async function context(){const ctx=await browser.newContext();await ctx.addCookies([{name:'sb-127-auth-token',value:cookieValue,url:base}]);await ctx.route('**/*',route=>{const h=new URL(route.request().url()).hostname;if(!['127.0.0.1','localhost'].includes(h)){externalRequests.push(h);return route.abort()}return route.continue()});ctx.on('page',p=>{p.on('pageerror',e=>browserErrors.push(e.message));p.on('dialog',d=>d.accept())});return ctx}
async function check(name,fn){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS',name,detail??'')}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}}
async function fillNew(page,game,cat,name='Dragon'){
 await page.goto(base+'/admin/produtos?novo=1');await page.waitForTimeout(300);await page.locator('#editor-name').waitFor();
 await page.locator('#editor-game').selectOption(game);await page.locator('#editor-category').selectOption(cat);
 await page.locator('#editor-name').fill(name);await page.locator('#editor-price').fill('20,00');await page.locator('#editor-stock').fill('10');await page.locator('#editor-active').selectOption('true');
}
async function save(page){await page.locator('button[name=save_action][value=stay]').click();await page.getByRole('status').filter({hasText:/Produto cadastrado|Produto atualizado/}).waitFor();await page.waitForFunction(()=>!!document.querySelector('form:has(#editor-name) input[name=product_id]')?.value);return page.locator('form:has(#editor-name) input[name=product_id]').inputValue()}
(async()=>{try{
 db=await createDatabase();
 await db.query("insert into games(id,name,slug) values($1,'King Legacy','king-legacy')",[gameKL]);
 await db.query("insert into categories(id,game_id,name,slug) values($1,$2,'Frutas','frutas')",[catKL,gameKL]);
 const oldBefore=await row('select id,slug from products where id=$1',[ids.a]);
 await db.query("select create_store_order($1,$2,'TesteRoblox',$3,'000201-pix-payload-ficticio-local',$4::jsonb,20)",[ids.admin,randomUUID(),'COSMIC-HOMOLOGACAO',JSON.stringify([{id:ids.a,kind:'product',quantity:1,unit_price:20}])]);
 server=http.createServer((req,res)=>adapter(req,res).catch(e=>{adapterErrors.push({message:e.message});res.statusCode=500;res.end('{}')}));await new Promise(r=>server.listen(54328,'127.0.0.1',r));
 await runChild([path.join(root,'node_modules/next/dist/bin/next'),'build'],'cosmic-admin-catalog-build.log');
 const log=fs.openSync('/tmp/cosmic-admin-catalog-server.log','w');app=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3120'],{cwd:root,env:testEnv,stdio:['ignore',log,log]});fs.closeSync(log);
 for(let n=0;n<80;n++){try{await fetch(base+'/robots.txt');break}catch{}await new Promise(r=>setTimeout(r,150))}
 browser=await require('./chromium.cjs')();
 const ctx=await context(),p=await ctx.newPage();p.setDefaultTimeout(15000);
 let kl,blox,kl2;
 await check('1 Dragon no King Legacy',async()=>{await fillNew(p,gameKL,catKL);kl=await save(p);const r=await row('select * from products where id=$1',[kl]);assert.equal(r.slug,'king-legacy-dragon');assert.equal(r.category_id,catKL);assert.equal(await p.locator('input[name=slug]').inputValue(),r.slug);return r.slug});
 await check('2 Dragon no Blox Fruits',async()=>{await fillNew(p,ids.game,ids.category);blox=await save(p);const r=await row('select * from products where id=$1',[blox]);assert.equal(r.slug,'blox-fruits-dragon');assert.equal(r.category_id,ids.category);return r.slug});
 await check('3 segundo Dragon no King Legacy e salvar novamente',async()=>{await fillNew(p,gameKL,catKL);kl2=await save(p);const r=await row('select * from products where id=$1',[kl2]);assert.match(r.slug,/^king-legacy-dragon-[a-f0-9]{12}$/);assert.equal(await p.locator('input[name=slug]').inputValue(),r.slug);await p.locator('#editor-price').fill('21,00');await p.getByRole('status').filter({hasText:'Produto cadastrado.'}).evaluate(e=>e.textContent='');await save(p);assert.equal((await row('select slug from products where id=$1',[kl2])).slug,r.slug);return r.slug});
 await check('4 editar produto antigo preserva slug e UUID',async()=>{await p.goto(base+`/admin/produtos/${ids.a}/editar`);await p.waitForFunction(()=>document.querySelectorAll('#editor-name').length===1);await p.locator('#editor-name').fill('Dragon antigo revisado');await save(p);const after=await row('select id,slug from products where id=$1',[ids.a]);assert.deepEqual(after,oldBefore);return 'UUID e /produto/dragon preservados'});
 await check('5 CSV com nomes repetidos entre jogos',async()=>{await p.goto(base+'/admin/produtos/importar');const csv='nome;jogo;categoria;preco;estoque\nDragon;King Legacy;Frutas;12;3\nDragon;Blox Fruits;Permanentes;13;4';await p.locator('input[type=file]:visible').setInputFiles({name:'homologacao.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await p.getByRole('button',{name:'Conferir planilha'}).click();await p.getByRole('heading',{name:'Prévia · 2 produtos'}).waitFor();await p.getByRole('button',{name:'Importar produtos conferidos'}).click();await p.getByRole('status').filter({hasText:'2 produtos cadastrados como ocultos'}).waitFor();const r=await db.query("select p.slug,p.is_active,g.slug as game_slug from products p join categories c on c.id=p.category_id join games g on g.id=c.game_id where p.name='Dragon' and not p.is_active");assert.equal(r.rows.length,2);for(const x of r.rows)assert.ok(x.slug.startsWith(x.game_slug+'-'));return '2 produtos novos ocultos; existentes preservados'});
 await check('5b CSV duplicado na mesma categoria é recusado sem gravação',async()=>{await p.goto(base+'/admin/produtos/importar');const before=Number((await row('select count(*) from products')).count);await p.locator('input[type=file]:visible').setInputFiles({name:'duplicado.csv',mimeType:'text/csv',buffer:Buffer.from('nome;jogo;categoria;preco\nDragon;King Legacy;Frutas;12\nDragon;King Legacy;Frutas;13')});await p.getByRole('button',{name:'Conferir planilha'}).click();await p.getByRole('alert').filter({hasText:'produto repetido na planilha'}).waitFor();assert.equal(Number((await row('select count(*) from products')).count),before);return 'regra atual explícita; importação atômica não iniciada'});
 await check('6 duplicar produto antigo',async()=>{await p.goto(base+`/admin/produtos?novo=1&duplicar=${ids.a}`);await p.waitForFunction(()=>document.querySelectorAll('#editor-name').length===1);assert.equal(await p.locator('#editor-name').inputValue(),'Dragon antigo revisado (cópia)');assert.equal(await p.locator('#editor-active').inputValue(),'false');const id=await save(p);assert.notEqual(id,ids.a);const r=await row('select * from products where id=$1',[id]);assert.ok(r.slug.startsWith('blox-fruits-'));assert.equal(r.is_active,false);assert.equal(r.stock,0);return 'novo UUID, cópia oculta, estoque zero'});
 await check('7 duas sessões: editor completo rejeita alteração desatualizada',async()=>{const ctx2=await context(),p2=await ctx2.newPage();try{await Promise.all([p.goto(base+`/admin/produtos/${ids.a}/editar`),p2.goto(base+`/admin/produtos/${ids.a}/editar`)]);await p.locator('#editor-price').fill('23,00');await p2.locator('#editor-price').fill('99,00');await save(p);await p2.locator('button[name=save_action][value=stay]').click();await p2.getByRole('alert').filter({hasText:'O produto mudou desde que você abriu.'}).waitFor();assert.equal(Number((await row('select price from products where id=$1',[ids.a])).price),23);return 'segunda sessão bloqueada sem sobrescrever preço'}finally{await ctx2.close()}});
 await check('7b duas sessões: edição rápida protege preço e estoque',async()=>{const ctx2=await context(),p2=await ctx2.newPage();try{await Promise.all([p.goto(base+'/admin/produtos?catalogo=1'),p2.goto(base+'/admin/produtos?catalogo=1')]);const field='input[aria-label="Preço de Dragon antigo revisado"]:visible';await p.locator(field).fill('24,00');await p2.locator(field).fill('88,00');const block=page=>page.locator('.admin-product-actions').filter({has:page.locator(field)});await block(p).getByRole('button',{name:'Salvar',exact:true}).click();await p.getByRole('status').filter({hasText:'Alterações de Dragon antigo revisado salvas.'}).waitFor();await block(p2).getByRole('button',{name:'Salvar',exact:true}).click();await p2.getByRole('alert').filter({hasText:'O produto mudou desde que você abriu.'}).waitFor();assert.equal(Number((await row('select price from products where id=$1',[ids.a])).price),24);return 'segunda sessão bloqueada no formulário rápido'}finally{await ctx2.close()}});
 await check('8 links antigos, carrinho, favoritos e pedidos',async()=>{await p.goto(base+'/produto/dragon');await p.getByRole('heading',{level:1,name:'Dragon antigo revisado'}).waitFor();await p.getByRole('button',{name:/^Adicionar Dragon antigo revisado(?: · .*?)? ao carrinho$/}).click();await p.locator('button.btn-secondary[aria-label="Salvar nos favoritos"]:visible').click();await p.locator('button.btn-secondary[aria-label="Remover dos favoritos"]:visible').waitFor();const pref=await row('select product_id,favorite from customer_product_preferences where user_id=$1 and product_id=$2',[ids.admin,ids.a]);assert.equal(pref.favorite,true);await p.goto(base+'/carrinho');await p.getByRole('link',{name:/^Ver Dragon antigo revisado(?: · .*?)?$/}).waitFor();const cart=await p.evaluate(()=>JSON.parse(localStorage.getItem('cosmic-cart')));assert.equal(cart[0].id,ids.a);assert.equal(cart[0].slug,'dragon');await p.goto(base+'/pedidos');await p.locator('a[href^="/pedidos/"]:visible').filter({hasText:'COSMIC-HOMOLOGACAO'}).waitFor();const item=await row('select product_id,product_name,unit_price from order_items limit 1');assert.equal(item.product_id,ids.a);assert.equal(item.product_name,'Dragon');assert.equal(Number(item.unit_price),20);return 'URL antiga, UUID, favorito e snapshot histórico preservados'});
 await check('9 identificadores correspondem aos jogos e são únicos',async()=>{const r=await db.query('select p.id,p.slug,p.category_id,g.slug as game_slug from products p join categories c on c.id=p.category_id join games g on g.id=c.game_id');assert.equal(new Set(r.rows.map(x=>x.slug)).size,r.rows.length);for(const x of r.rows.filter(x=>![ids.a,ids.b].includes(x.id)))assert.ok(x.slug.startsWith(x.game_slug+'-'));assert.equal((await row('select slug from products where id=$1',[ids.a])).slug,'dragon');return `${r.rows.length} identificadores verificados`});
 await check('10 validação de preço e categoria + mensagem inline',async()=>{await fillNew(p,gameKL,catKL,'Produto inválido');const count=Number((await row('select count(*) from products')).count);await p.locator('#editor-price').fill('abc');await p.locator('button[name=save_action][value=stay]').click();await p.getByRole('alert').filter({hasText:'Informe um preço válido'}).waitFor();assert.equal(Number((await row('select count(*) from products')).count),count);await p.locator('#editor-price').fill('20');await p.locator('#editor-category').selectOption('');await p.locator('button[name=save_action][value=stay]').click();assert.equal(await p.locator('#editor-category').evaluate(e=>e.validity.valueMissing),true);assert.equal(Number((await row('select count(*) from products')).count),count);return 'preço recusado no servidor; categoria obrigatória no navegador; nenhuma gravação'});
 await check('10b identificador manual inválido é recusado no servidor',async()=>{await fillNew(p,gameKL,catKL,'Produto inválido');await p.getByText('Opções avançadas',{exact:false}).first().click();await p.getByLabel('Definir identificador da página manualmente').check();await p.locator('#editor-slug').fill('INVALIDO!');const before=Number((await row('select count(*) from products')).count);await p.locator('button[name=save_action][value=stay]').click();await p.getByRole('alert').filter({hasText:'Informe um identificador válido.'}).waitFor();assert.equal(Number((await row('select count(*) from products')).count),before);return 'erro inline; nenhuma gravação'});
 await ctx.close();
 console.log(JSON.stringify({results,adapterErrors,browserErrors,externalRequests:[...new Set(externalRequests)]},null,2));
 fs.writeFileSync('/tmp/cosmic-admin-catalog-results.json',JSON.stringify({results,adapterErrors,browserErrors,externalRequests:[...new Set(externalRequests)]},null,2));
 if(results.some(r=>r.status==='FAIL')||adapterErrors.length||browserErrors.length)process.exitCode=1;
}finally{if(browser)await browser.close();if(app&&app.exitCode===null){app.kill();await once(app,'exit')}if(server)await new Promise(r=>server.close(r));if(db)await db.close()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
