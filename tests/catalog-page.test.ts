import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalogPage } from "../lib/catalog-page";
test("paginação lê só a página solicitada e mantém total", async () => {
 const calls:number[][]=[]; const q={range:async(a:number,b:number)=>{calls.push([a,b]);return {data:[25,26],error:null,count:26}}};
 const r=await loadCatalogPage(q,2);assert.deepEqual(calls,[[24,47]]);assert.equal(r.page,2);assert.equal(r.count,26);assert.deepEqual(r.data,[25,26]);
});
test("HTTP 416 real do PostgREST descobre o total e conserva a última página", async () => {
 const calls:number[][]=[];
 const q={range:async(a:number,b:number)=>{calls.push([a,b]);return a>24?{data:null,error:{message:'range',code:'PGRST103'},count:null}:{data:a===0?[1]:[25],error:null,count:25}}};
 const r=await loadCatalogPage(q,99);assert.equal(r.error,null);assert.equal(r.page,2);assert.deepEqual(r.data,[25]);assert.deepEqual(calls,[[2352,2375],[0,23],[24,47]]);
});
test("416 com catálogo vazio não quebra e uma falha de permissão continua explícita", async () => {
 let reads=0;
 const empty={range:async()=>++reads===1?{data:null,error:{message:'range',code:'PGRST103'},count:null}:{data:[],error:null,count:0}};
 const r=await loadCatalogPage(empty,99);assert.equal(r.page,1);assert.equal(r.count,0);assert.deepEqual(r.data,[]);assert.equal(reads,2);
 const forbidden={message:'permission denied',code:'42501'};reads=0;
 const failed={range:async()=>{reads++;return{data:null,error:forbidden,count:null}}};
 assert.equal((await loadCatalogPage(failed,99)).error,forbidden);assert.equal(reads,1);
});
test("página além do fim volta para a última; erro não vira catálogo vazio", async () => {
 const calls:number[][]=[];const q={range:async(a:number,b:number)=>{calls.push([a,b]);return {data:a===24?[25]:[],error:null,count:25}}};
 const r=await loadCatalogPage(q,99);assert.equal(r.page,2);assert.deepEqual(r.data,[25]);assert.deepEqual(calls,[[2352,2375],[24,47]]);
 const error={message:'offline'};assert.equal((await loadCatalogPage({range:async()=>({data:null,error,count:null})},1)).error,error);
});
