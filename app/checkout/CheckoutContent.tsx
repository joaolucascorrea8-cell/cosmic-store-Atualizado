"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { createClient } from "@/lib/supabase/client";

type CreatedOrder = { id: string; order_code: string; total: number; pix_payload: string };

export default function CheckoutContent() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [gameNickname, setGameNickname] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function createOrder() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameNickname, items: items.map(({ id, quantity }) => ({ id, quantity })) }) });
      const data = await response.json();
      if (response.status === 401) { router.push("/login?next=/checkout"); return; }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar o pedido.");
      setOrder(data.order); setQrCode(data.qrCode);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Erro ao criar pedido."); }
    finally { setLoading(false); }
  }

  async function uploadProof() {
    if (!order || !proof) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(proof.type) || proof.size > 5 * 1024 * 1024) {
      setError("Envie JPG, PNG ou PDF de até 5 MB."); return;
    }
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/checkout"); return; }
      const extension = proof.type === "application/pdf" ? "pdf" : proof.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${order.id}/comprovante.${extension}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, proof, { upsert: true, contentType: proof.type });
      if (uploadError) throw uploadError;
      const response = await fetch(`/api/orders/${order.id}/proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar o comprovante.");
      clearCart(); router.push(`/pedidos/${order.id}?proof=sent`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Erro ao enviar comprovante."); }
    finally { setLoading(false); }
  }

  if (!items.length && !order) return <main className="shell grid min-h-[60vh] place-items-center text-center"><div><h1 className="text-3xl font-black">Seu carrinho está vazio</h1><Link href="/produtos" className="mt-5 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold">Ver produtos</Link></div></main>;

  return <main className="shell py-10 md:py-14"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Pagamento seguro</p><h1 className="mt-2 text-4xl font-black">Finalizar compra</h1>
    {!order ? <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><section className="rounded-2xl border border-white/10 bg-[#121017] p-6"><h2 className="text-xl font-black">Dados da entrega</h2><label className="mt-5 block text-sm font-bold" htmlFor="gameNickname">Nickname no jogo</label><input id="gameNickname" value={gameNickname} onChange={(event)=>setGameNickname(event.target.value)} maxLength={60} placeholder="Digite exatamente como aparece no jogo" className="mt-2 w-full rounded-xl border border-white/10 bg-[#08070b] px-4 py-3 outline-none focus:border-violet-500"/><p className="mt-2 text-xs text-zinc-500">Usaremos esse nickname para realizar a entrega.</p><div className="mt-7 space-y-3">{items.map(item=><div key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.quantity}× {item.name}</span><strong>{money(item.price*item.quantity)}</strong></div>)}</div></section><aside className="h-fit rounded-2xl border border-white/10 bg-[#121017] p-6"><span className="text-zinc-400">Total</span><strong className="mt-2 block text-3xl">{money(total)}</strong><button disabled={loading||gameNickname.trim().length<2} onClick={createOrder} className="mt-6 w-full rounded-xl bg-violet-600 py-3.5 font-black disabled:opacity-50">{loading?"Gerando Pix...":"Gerar Pix"}</button></aside></div>:
    <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]"><section className="rounded-2xl border border-violet-500/25 bg-[#121017] p-6 text-center"><p className="text-sm text-zinc-400">Pedido {order.order_code}</p><img src={qrCode} alt="QR Code Pix" className="mx-auto mt-4 w-full max-w-[300px] rounded-xl bg-white p-2"/><strong className="mt-4 block text-3xl">{money(Number(order.total))}</strong><button onClick={async()=>{await navigator.clipboard.writeText(order.pix_payload);setCopied(true)}} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-3 font-bold">{copied?"Código copiado!":"Copiar código Pix"}</button></section><section className="rounded-2xl border border-white/10 bg-[#121017] p-6"><h2 className="text-2xl font-black">Envie seu comprovante</h2><p className="mt-3 leading-7 text-zinc-400">Depois de pagar, envie o comprovante para analisarmos. O pedido só será marcado como pago depois da conferência no banco.</p><label className="mt-6 block cursor-pointer rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/5 p-8 text-center"><span className="font-bold">{proof?proof.name:"Selecionar comprovante"}</span><span className="mt-2 block text-xs text-zinc-500">JPG, PNG ou PDF de até 5 MB</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event)=>setProof(event.target.files?.[0]??null)} className="sr-only"/></label><button disabled={!proof||loading} onClick={uploadProof} className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 font-black disabled:opacity-50">{loading?"Enviando...":"Enviar comprovante"}</button></section></div>}
    {error&&<p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
  </div></main>;
}

