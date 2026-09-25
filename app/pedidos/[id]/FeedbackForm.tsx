"use client";

import { FormEvent, useState } from "react";

export default function FeedbackForm({ orderId, initial }: { orderId:string; userId:string; initial?:{rating:number;comment:string;attachment_url?:string|null}|null }) {
  const [rating,setRating]=useState(initial?.rating??5);
  const [comment,setComment]=useState(initial?.comment??"");
  const [file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event:FormEvent){
    event.preventDefault();setLoading(true);setMessage("");
    try{
      const form=new FormData();form.set("order_id",orderId);form.set("rating",String(rating));form.set("comment",comment.trim());if(file)form.set("attachment",file);
      const response=await fetch("/api/feedbacks",{method:"POST",body:form});const body=await response.json();
      setMessage(response.ok?(body.message??"Obrigado! Sua avaliação foi publicada."):(body.error??"Não foi possível enviar sua avaliação."));
      if(response.ok){setFile(null);}
    }catch{setMessage("Não foi possível enviar sua avaliação agora.");}finally{setLoading(false);}
  }

  return <form onSubmit={submit} className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6"><h2 className="text-xl font-black">Como foi sua experiência?</h2><p className="mt-2 text-sm text-zinc-400">Sua avaliação ajuda outras pessoas a conhecerem a Cosmic Store.</p><div className="mt-4 flex gap-1" aria-label="Nota da avaliação">{[1,2,3,4,5].map(star=><button type="button" aria-label={`${star} estrela${star>1?"s":""}`} key={star} onClick={()=>setRating(star)} className={`text-3xl ${star<=rating?"text-amber-300":"text-zinc-700"}`}>★</button>)}</div><textarea required minLength={3} maxLength={600} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Conte como foi comprar com a gente..." className="mt-4 min-h-28 w-full rounded-xl border border-white/10 bg-[#08070b] p-4 outline-none focus:border-violet-500"/>
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4"><strong className="text-sm">📷 Quer deixar sua avaliação ainda mais completa?</strong><p className="mt-1 text-xs leading-5 text-zinc-400">Se quiser, envie uma print mostrando sua entrega. Isso ajuda outros clientes a conhecerem melhor a experiência da Cosmic Store. <strong className="text-zinc-300">A imagem é opcional.</strong></p><label className="mt-3 inline-flex cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:border-violet-400/40"><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>setFile(e.target.files?.[0]??null)}/>{file?`✓ ${file.name}`:initial?.attachment_url?"Trocar imagem da avaliação":"Adicionar print da entrega"}</label>{initial?.attachment_url&&!file&&<a href={initial.attachment_url} target="_blank" rel="noreferrer" className="ml-3 text-xs font-bold text-violet-300">Ver imagem atual ↗</a>}</div>
    <button disabled={loading} className="mt-4 rounded-xl bg-violet-600 px-5 py-3 font-bold disabled:opacity-50">{loading?"Enviando...":initial?"Atualizar avaliação":"Enviar avaliação"}</button>{message&&<p className="mt-3 text-sm text-zinc-300">{message}</p>}</form>;
}
