"use client";

import { useCart } from "@/app/context/CartContext";

export default function AddComboToCartButton({combo}:{combo:{id:string;name:string;price:number;image_url?:string|null;max_quantity:number}}) {
  const {addToCart,items}=useCart();
  const existing=items.find(item=>item.id===combo.id&&item.kind==="combo");
  const soldOut=combo.max_quantity<1;
  const atLimit=(existing?.quantity??0)>=combo.max_quantity;
  return <button type="button" disabled={soldOut||atLimit} onClick={()=>addToCart({id:combo.id,name:combo.name,price:Number(combo.price),image_url:combo.image_url??null,max_quantity:combo.max_quantity,kind:"combo"})} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{soldOut?"Combo indisponível":atLimit?"Limite no carrinho":"Adicionar combo ao carrinho"}</button>;
}
