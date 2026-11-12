import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalogPage } from "../lib/catalog-page";
test("paginação lê só a página solicitada e mantém total", async () => {
 const calls:number[][]=[]; const q={range:async(a:number,b:number)=>{calls.push([a,b]);return {data:[25,26],error:null,count:26}}};
 const r=await loadCatalogPage(q,2);assert.deepEqual(calls,[[24,47]]);assert.equal(r.page,2);assert.equal(r.count,26);assert.deepEqual(r.data,[25,26]);
});
test("página além do fim volta para a última; erro não vira catálogo vazio", async () => {
 const calls:number[][]=[];const q={range:async(a:number,b:number)=>{calls.push([a,b]);return {data:a===24?[25]:[],error:null,count:25}}};
 const r=await loadCatalogPage(q,99);assert.equal(r.page,2);assert.deepEqual(r.data,[25]);assert.deepEqual(calls,[[2352,2375],[24,47]]);
 const error={message:'offline'};assert.equal((await loadCatalogPage({range:async()=>({data:null,error,count:null})},1)).error,error);
});
