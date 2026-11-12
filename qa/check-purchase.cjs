// Reutiliza o adaptador Supabase/PGlite da homologação administrativa.
// Exercita Next compilado e Server Actions; fornecedor e arquivos inteiramente locais.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const file = path.join(__dirname, 'check-admin-catalog.cjs');
let source = fs.readFileSync(file, 'utf8').split('(async()=>{try{')[0];
source = source.replaceAll('3120', '3140').replaceAll('54328', '54326');
// NextURL normaliza loopback para localhost em redirects; cookies precisam da mesma origem.
source = source.replace("const base = 'http://127.0.0.1:3140';", "const base = 'http://localhost:3140';");
source = source.replace("const testEnv = require('./isolated-env.cjs')(api,base);", "const testEnv = require('./isolated-env.cjs')(api,base,{BYROBUX_API_KEY:'local-test',BYROBUX_API_BASE_URL:api+'/provider',CRON_SECRET:'local-cron-test'});\nlet providerStatus='PENDING',schemaReady=true;const executions=new Map();");
source = source.replace("['ops_import_products','set_product_preference','ops_record_issue']", "['ops_import_products','set_product_preference','ops_record_issue','ops_expire_orders','ops_report','ops_interest','store_financial_summary','store_checkout_capabilities','quote_store_checkout','create_store_order_with_coupon','create_robux_store_order','confirm_manual_store_payment','record_manual_store_refund','record_additional_store_payment','transition_store_order','claim_gamepass_execution','finish_gamepass_execution','claim_order_email','finish_order_email']");
source = source.replace("if(u.pathname==='/auth/v1/user') return send(user);", "if(u.pathname==='/auth/v1/user'||u.pathname.startsWith('/auth/v1/admin/users/')) return send(user);");
source = source.replace("const body=raw?JSON.parse(raw):null;", "const body=raw&&(req.headers['content-type']??'').includes('application/json')?JSON.parse(raw):null;");
source = source.replace("  try {\n    const result = await db.transaction", `
  if(u.pathname==='/rest/v1/rpc/store_checkout_capabilities'&&!schemaReady)return send(false);
  if(u.pathname==='/auth/v1/signup')return send({user:{...user,id:ids.user},session:null});
  if(['/auth/v1/recover','/auth/v1/resend','/auth/v1/logout'].includes(u.pathname))return send({});
  if(u.pathname==='/auth/v1/verify'){if(body.token_hash==='expired'){res.statusCode=400;return send({error_code:'otp_expired',message:'Token expirado'});}return send(session);}
  if(req.method==='POST'&&u.pathname.startsWith('/storage/v1/object/payment-proofs/')){
    const name=decodeURIComponent(u.pathname.slice('/storage/v1/object/payment-proofs/'.length));assert.ok(name.startsWith(ids.admin+'/'));
    const id=randomUUID();await db.query("insert into storage.objects(id,bucket_id,name) values($1,'payment-proofs',$2)",[id,name]);return send({Id:id,Key:'payment-proofs/'+name});
  }
  if(u.pathname.startsWith('/provider/')) {
    if(u.pathname.endsWith('/rates'))return send({robuxRateBrlPerThousand:25});
    if(u.pathname.endsWith('/balance'))return send({balanceBrl:10000,balanceBrlCents:1000000});
    if(u.pathname.endsWith('/quick-buy/calculate'))return send({rateBrlPerThousand:25,items:[{id:'123456',link:'https://www.roblox.com/game-pass/123456',robux:1000,username:'ClienteRoblox',priceBrl:25,error:false}]});
    if(u.pathname.endsWith('/quick-buy/execute')){assert.equal(req.headers['idempotency-key'],body.requestId);if(!executions.has(body.requestId))executions.set(body.requestId,'batch-'+body.requestId);return send({batchId:executions.get(body.requestId)});}
    if(u.pathname.endsWith('/orders'))return send({orders:[...executions.values()].map(batchId=>({id:batchId,batchId,status:providerStatus})),pagination:{page:1,totalPages:1}});
    throw new Error('Fornecedor local: rota inesperada');
  }
  if(u.pathname==='/storage/v1/object/list/payment-proofs')return send((await db.query("select id,name from storage.objects where bucket_id='payment-proofs'")).rows.filter(x=>x.name.startsWith(body.prefix+'/')).map(x=>({...x,name:x.name.split('/').at(-1)})));
  if(u.pathname==='/storage/v1/object/sign/local-test.png'){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVv0AAAAASUVORK5CYII=','base64'));}
  if(u.pathname.startsWith('/storage/v1/object/sign/'))return send({signedURL:'/object/sign/local-test.png'});
  try {
    const result = await db.transaction`);
source = source.replace("o.robux_orders=null;", "o.robux_orders=(await tx.query('select * from robux_orders where order_id=$1',[o.id])).rows[0]??null;o.profiles=(await tx.query('select nickname from profiles where id=$1',[o.user_id])).rows[0];");
source += fs.readFileSync(path.join(__dirname, 'purchase-scenarios.cjs.txt'), 'utf8');
const compiled = new Module(__filename, module);
compiled.filename = __filename;
compiled.paths = module.paths;
compiled._compile(source, __filename);
