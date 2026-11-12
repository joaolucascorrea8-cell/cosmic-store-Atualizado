import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { productContext, productLabel } from "../lib/product-context";
import { readOrderDisplayItems } from "../lib/product-context-server";
import { sanitizeCart, cartSignature } from "../lib/cart";
test("produtos de mesmo nome têm rótulos distintos; contextos ausentes não são inferidos de slugs",()=>{
 assert.notEqual(productLabel('Dragon',{game:'King Legacy',category:'Frutas'}),productLabel('Dragon',{game:'Blox Fruits',category:'Frutas'}));
 assert.deepEqual(productContext({categories:[{name:'Frutas',games:[{name:'Blox Fruits'}]}]}),{game:'Blox Fruits',category:'Frutas'});
 assert.equal(productContext({slug:'king-legacy-dragon'}),null);assert.equal(productContext({categories:{name:'',games:{name:'Blox Fruits'}}}),null);
});
test("carrinho legado e assinatura de checkout permanecem inalterados",()=>{
 const raw=[{id:'50000000-0000-4000-8000-000000000001',name:'Dragon',slug:'dragon',price:20,quantity:2,stock:10,unlimited_stock:false,image_url:null}];
 const items=sanitizeCart(raw);assert.deepEqual(items,[{...raw[0],kind:'product'}]);const before=cartSignature(items);
 productLabel(items[0].name,{game:'Blox Fruits',category:'Frutas'});assert.equal(cartSignature(items),before);assert.equal(items[0].slug,'dragon');
});
test("confirmação mantém snapshot histórico e resolve apenas contexto atual por UUID",async()=>{
 const client=createClient('http://127.0.0.1:54321','local-test',{auth:{persistSession:false},global:{fetch:async(input)=>{
 const u=new URL(String(input));if(u.pathname.endsWith('/order_items')){assert.equal(u.searchParams.get('order_id'),'eq.order-1');return Response.json([{product_id:'p1',product_name:'Nome histórico',quantity:2,unit_price:20}]);}
 assert.equal(u.searchParams.get('id'),'in.(p1)');return Response.json([{id:'p1',name:'Nome atual diferente',categories:{name:'Frutas',games:{name:'Blox Fruits'}}}]);
 }}});
 const items=await readOrderDisplayItems(client,'order-1');assert.equal(items[0].product_name,'Nome histórico');assert.equal(items[0].unit_price,20);assert.deepEqual(items[0].context,{game:'Blox Fruits',category:'Frutas'});
});
