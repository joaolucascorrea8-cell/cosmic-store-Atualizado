import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { catalogImageResponse } from "../lib/catalog-image-response";
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
