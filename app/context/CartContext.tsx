"use client";
import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
export type CartProduct = { id: string; name: string; price: number; image_url: string | null; max_quantity?: number; kind?: "product" | "combo" };
export type CartItem = CartProduct & { quantity: number };
type CartContextType = {items: CartItem[]; cartLoaded: boolean; addToCart: (product: CartProduct) => void; removeFromCart: (id: string) => void; updateQuantity: (id: string, quantity: number) => void; clearCart: () => void; totalItems: number };
const CartContext = createContext<CartContextType | null>(null);
const limit = (product: CartProduct) => Math.max(1,Math.min(99,Number.isInteger(product.max_quantity) ? Number(product.max_quantity) : 99));
export function CartProvider({children}: {children: ReactNode}) {
  const [items,setItems] = useState<CartItem[]>([]);const [cartLoaded,setCartLoaded] = useState(false);
  useEffect(() => {let cancelled=false;queueMicrotask(() => {if(cancelled)return;try {const parsed:unknown = JSON.parse(localStorage.getItem("cosmic-cart") ?? "[]");if(Array.isArray(parsed)){const seen=new Set<string>();const cleaned:CartItem[]=[];for(const item of parsed.slice(0,40)){if(!item || typeof item !== "object")continue;const row=item as Partial<CartItem>;if(typeof row.id!=="string" || typeof row.name!=="string" || typeof row.price!=="number" || !Number.isFinite(row.price) || row.price<0 || seen.has(row.id))continue;seen.add(row.id);const product:CartProduct={id:row.id,name:row.name.slice(0,100),price:row.price,image_url:typeof row.image_url==="string"?row.image_url:null,max_quantity:typeof row.max_quantity==="number"?row.max_quantity:undefined,kind:row.kind==="combo"?"combo":"product"};cleaned.push({...product,quantity:Math.max(1,Math.min(limit(product),Number.isInteger(row.quantity)?Number(row.quantity):1))});}setItems(cleaned);}}catch{localStorage.removeItem("cosmic-cart");}setCartLoaded(true);});return()=>{cancelled=true;};},[]);
  useEffect(() => {if(cartLoaded)localStorage.setItem("cosmic-cart",JSON.stringify(items));},[cartLoaded,items]);
  function addToCart(product:CartProduct) {setItems(current=>{const existing=current.find(item=>item.id===product.id);if(existing)return current.map(item=>item.id===product.id?{...item,price:product.price,name:product.name,image_url:product.image_url,max_quantity:product.max_quantity,quantity:Math.min(limit(product),item.quantity+1)}:item);if(current.length>=40)return current;return [...current,{...product,quantity:1}];});}
  function removeFromCart(id:string) {setItems(current=>current.filter(item=>item.id!==id));}
  function updateQuantity(id:string,quantity:number) {if(quantity<=0){removeFromCart(id);return;}setItems(current=>current.map(item=>item.id===id?{...item,quantity:Math.min(Math.max(1,Math.floor(quantity)),limit(item))}:item));}
  function clearCart() {setItems([]);}
  return <CartContext.Provider value={{items,cartLoaded,addToCart,removeFromCart,updateQuantity,clearCart,totalItems:items.reduce((sum,item)=>sum+item.quantity,0)}}>{children}</CartContext.Provider>;
}
export function useCart() {const value=useContext(CartContext);if(!value)throw new Error("useCart precisa estar dentro de CartProvider");return value;}
