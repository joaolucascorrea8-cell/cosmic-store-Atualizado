"use client";

import {useActionState,useEffect,useMemo,useState} from "react";
import {sendCampaign} from "./actions";
import CampaignBannerUpload from "./CampaignBannerUpload";

type SourceProduct={name:string;image_url:string|null;quantity:number};
export type CampaignSource={key:string;type:"combo"|"product";name:string;price:number;compare_at_price:number|null;image_url:string|null;products:SourceProduct[]};
const initialState={error:null as string|null,success:null as string|null};
const money=(value:number)=>Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function suggestedBody(source:CampaignSource){
  const itemLines=source.products.map(item=>`• ${item.quantity}× ${item.name}`).join("\n");
  const priceLine=source.compare_at_price&&source.compare_at_price>source.price?`\nDe ${money(source.compare_at_price)} por ${money(source.price)}`:`\nPor ${money(source.price)}`;
  return `Uma nova oferta acabou de chegar na Cosmic Store! 🔥\n\n${itemLines}${priceLine}\n\n⏳ Aproveite enquanto estiver disponível.\n\n💬 Precisou de ajuda? Fale com nossa equipe pelo suporte da loja.`;
}

export default function CampaignComposer({sources,initialSource}:{sources:CampaignSource[];initialSource?:string}){
  const defaultSource=sources.find(source=>source.key===initialSource)??sources[0];
  const [sourceKey,setSourceKey]=useState(defaultSource?.key??"");
  const selected=useMemo(()=>sources.find(source=>source.key===sourceKey)??sources[0],[sourceKey,sources]);
  const [title,setTitle]=useState(selected?selected.type==="combo"?`${selected.name} — Oferta especial`: `${selected.name} em destaque`:"");
  const [body,setBody]=useState(selected?suggestedBody(selected):"");
  const [requestToken,setRequestToken]=useState("");
  const [state,action,pending]=useActionState(sendCampaign,initialState);
  useEffect(()=>{setRequestToken(crypto.randomUUID())},[]);
  function changeSource(key:string){setSourceKey(key);const next=sources.find(source=>source.key===key);if(next){setTitle(next.type==="combo"?`${next.name} — Oferta especial`:`${next.name} em destaque`);setBody(suggestedBody(next));}}
  if(!selected)return <div className="admin-empty">Crie pelo menos um produto ou combo antes de montar uma campanha.</div>;
  const visible=selected.products.slice(0,4);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="request_token" value={requestToken}/>
    <div><label className="admin-label" htmlFor="campaign-source">O que você quer divulgar?</label><select id="campaign-source" name="source" className="admin-input" value={sourceKey} onChange={event=>changeSource(event.target.value)}>{sources.map(source=><option key={source.key} value={source.key}>{source.type==="combo"?"Combo":"Produto"} · {source.name}</option>)}</select></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><label className="admin-label" htmlFor="campaign-title">Título</label><input id="campaign-title" name="title" className="admin-input" value={title} onChange={e=>setTitle(e.target.value)} minLength={2} maxLength={140} required/></div><div><label className="admin-label">Canais de envio</label><div className="grid min-h-12 grid-cols-2 gap-2"><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 text-sm font-bold"><input type="checkbox" name="send_email" defaultChecked className="accent-violet-500"/>E-mail</label><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 text-sm font-bold"><input type="checkbox" name="send_discord" defaultChecked className="accent-violet-500"/>Discord</label></div></div></div>
    <div><label className="admin-label" htmlFor="campaign-body">Texto da campanha</label><textarea id="campaign-body" name="body" className="admin-input min-h-52" value={body} onChange={e=>setBody(e.target.value)} minLength={2} maxLength={3000} required/><p className="mt-1 text-xs text-zinc-500">O botão/link da oferta é incluído automaticamente no e-mail e no Discord.</p></div>
    <div><label className="admin-label">Banner (opcional)</label><CampaignBannerUpload/></div>
    <section className="rounded-2xl border border-violet-500/20 bg-[#0e0b13] p-5"><p className="eyebrow">PRÉVIA</p><h3 className="mt-2 text-2xl font-black">{title||selected.name}</h3><p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-400">{body}</p><div className={`mt-5 grid gap-2 ${visible.length<=1?"grid-cols-1":visible.length===2?"grid-cols-2":visible.length===3?"grid-cols-3":"grid-cols-2"}`}>{visible.map((product,index)=><div key={`${product.name}-${index}`} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[.03] p-3"><div className="relative mx-auto aspect-square max-w-32">{product.image_url?<img src={product.image_url} alt="" className="h-full w-full object-contain"/>:<div className="grid h-full place-items-center text-3xl text-violet-300">✦</div>}</div><strong className="mt-2 block text-center text-xs">{product.quantity}× {product.name}</strong>{index===3&&selected.products.length>4&&<span className="absolute right-2 top-2 rounded-full bg-black/75 px-2 py-1 text-xs font-black">+{selected.products.length-4}</span>}</div>)}</div><div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4"><div>{selected.compare_at_price&&selected.compare_at_price>selected.price&&<span className="block text-xs text-zinc-500 line-through">{money(selected.compare_at_price)}</span>}<strong className="text-2xl">{money(selected.price)}</strong></div><span className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black">Ver oferta na Cosmic Store ↗</span></div></section>
    {state.error&&<p role="alert" className="admin-error">{state.error}</p>}{state.success&&<p role="status" className="admin-notice">{state.success}</p>}
    <button type="submit" disabled={pending||!requestToken} className="btn-primary w-full sm:w-auto disabled:opacity-50">{pending?"Enviando campanha…":"Enviar campanha"}</button>
  </form>;
}
