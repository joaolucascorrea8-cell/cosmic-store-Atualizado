import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { catalogImageResponse, createCatalogImageResponder } from "../lib/catalog-image-response";
import { catalogImagePath } from "../lib/catalog-image-url";
const root = "https://test.supabase.co";
const request = (query: string) => new Request(`http://localhost/api/catalog-image?${query}`);
test("imagens: sem URL arbitrária, traversal, SVG ou dimensões ilimitadas", async () => {
  assert.equal(catalogImagePath(root+"/storage/v1/object/public/product-images/a.png",root),"a.png");
  assert.equal(catalogImagePath("https://evil.example/a.png",root),null);
  for (const query of ["file=../a.png&w=640","file=a.svg&w=640","file=https://evil.example/a.png&w=640","file=a.png&w=99999"]) {
    const r=await catalogImageResponse(request(query),root,async()=>{throw new Error("não deve buscar")});assert.equal(r.status,400);
  }
});
test("WebP mantém pixels na dimensão original e não amplia; cache público limitado", async () => {
  const source=await sharp({create:{width:64,height:32,channels:4,background:'#8b5cf6'}}).png().toBuffer();
  const r=await catalogImageResponse(request("file=a.png&w=128"),root,async (url,options)=>{
    assert.equal(String(url),root+'/storage/v1/object/public/product-images/a.png');assert.equal(options?.redirect,'error');return new Response(source);
  });
  assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.match(r.headers.get('cache-control')!,/s-maxage=86400/);
  const out=Buffer.from(await r.arrayBuffer());const meta=await sharp(out).metadata();assert.equal(meta.width,64);assert.equal(meta.height,32);
  assert.ok((await sharp(out).ensureAlpha().raw().toBuffer()).equals(await sharp(source).ensureAlpha().raw().toBuffer()));
});
test("erros upstream, corpo excessivo e conteúdo inválido não viram cache de sucesso", async () => {
  for (const [response,status] of [[new Response('',{status:404}),404],[new Response('bad'),415],[new Response('x',{headers:{'content-length':String(6*1024*1024)}}),413]] as const) {
    const r=await catalogImageResponse(request('file=a.png&w=640'),root,async()=>response);assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),null);
  }
});

test("imagens concorrentes compartilham processamento e entregam corpos independentes", async () => {
  const respond = createCatalogImageResponder();
  const source = await sharp({create:{width:64,height:32,channels:4,background:'#8b5cf6'}}).png().toBuffer();
  let reads = 0;
  const fetcher: typeof fetch = async () => { reads++; await new Promise(r => setTimeout(r,10)); return new Response(source); };
  const responses = await Promise.all(Array.from({length:8},()=>respond(request('file=concurrent.png&w=128'),root,fetcher)));
  const bodies = await Promise.all(responses.map(async response => Buffer.from(await response.arrayBuffer())));
  assert.equal(reads,1);
  assert.ok(bodies.every(body=>body.equals(bodies[0])));
  const cached = await respond(request('file=concurrent.png&w=128'),root,fetcher);
  assert.equal(reads,1);assert.ok(Buffer.from(await cached.arrayBuffer()).equals(bodies[0]));
});
test("ETag permite 304 sem reprocessar a imagem e mantém os mesmos pixels", async () => {
  const respond = createCatalogImageResponder();
  const source = await sharp({create:{width:32,height:16,channels:4,background:'#9333ea'}}).png().toBuffer();let reads=0;
  const fetcher: typeof fetch = async()=>{reads++;return new Response(source);};
  const first=await respond(request('file=tag.png&w=64'),root,fetcher);const tag=first.headers.get('etag');assert.ok(tag);
  const conditional=new Request('http://localhost/api/catalog-image?file=tag.png&w=64',{headers:{'If-None-Match':`W/${tag}`}});
  const second=await respond(conditional,root,fetcher);assert.equal(second.status,304);assert.equal((await second.arrayBuffer()).byteLength,0);assert.equal(reads,1);
  assert.ok((await sharp(Buffer.from(await first.arrayBuffer())).ensureAlpha().raw().toBuffer()).equals(await sharp(source).ensureAlpha().raw().toBuffer()));
});
test("cache expira e volta a buscar o conteúdo, preservando os cabeçalhos HTTP", async () => {
  let clock=0,reads=0;const respond=createCatalogImageResponder({now:()=>clock,ttlMs:100});
  const a=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer();
  const b=await sharp({create:{width:8,height:8,channels:3,background:'#654321'}}).png().toBuffer();
  const fetcher: typeof fetch=async()=>new Response(++reads===1?a:b);
  const first=await respond(request('file=ttl.png&w=16'),root,fetcher);clock=101;
  const second=await respond(request('file=ttl.png&w=16'),root,fetcher);assert.equal(reads,2);assert.notEqual(first.headers.get('etag'),second.headers.get('etag'));
  assert.equal(first.headers.get('cache-control'),second.headers.get('cache-control'));
});
test("cache limita entradas e separa origem, arquivo e dimensão", async () => {
  const respond=createCatalogImageResponder({maxEntries:2});let reads=0;
  const source=await sharp({create:{width:32,height:32,channels:3,background:'#123456'}}).png().toBuffer();
  const fetcher: typeof fetch=async()=>{reads++;return new Response(source);};
  await respond(request('file=a.png&w=16'),root,fetcher);
  await respond(request('file=a.png&w=32'),root,fetcher);
  await respond(request('file=a.png&w=16'),'https://other.supabase.co',fetcher);
  assert.equal(reads,3);await respond(request('file=a.png&w=16'),root,fetcher);assert.equal(reads,4);
});
test("imagens acima do orçamento não ficam retidas em memória", async () => {
  const respond=createCatalogImageResponder({maxBytes:1});let reads=0;
  const source=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer();
  const fetcher: typeof fetch=async()=>{reads++;return new Response(source);};
  assert.equal((await respond(request('file=large.png&w=16'),root,fetcher)).status,200);
  assert.equal((await respond(request('file=large.png&w=16'),root,fetcher)).status,200);assert.equal(reads,2);
});
test("erro compartilhado não fica em cache nem impede tentativa posterior válida", async () => {
  const respond=createCatalogImageResponder();let reads=0;
  const source=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer();
  const fetcher: typeof fetch=async()=>++reads===1?new Response('bad'):new Response(source);
  assert.equal((await respond(request('file=retry.png&w=16'),root,fetcher)).status,415);
  assert.equal((await respond(request('file=retry.png&w=16'),root,fetcher)).status,200);assert.equal(reads,2);
});
