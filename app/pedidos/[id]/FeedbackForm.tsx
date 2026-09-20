"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackForm({ orderId, userId, initial }: { orderId:string; userId:string; initial?:{rating:number;comment:string}|null }) {
  const [rating,setRating]=useState(initial?.rating??5); const [comment,setComment]=useState(initial?.comment??""); const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setMessage("");const {error}=await createClient().from("feedbacks").upsert({order_id:orderId,user_id:userId,rating,comment:comment.trim(),author_nickname:"temporario"},{onConflict:"order_id"});setMessage(error?error.message:"Obrigado! Seu feedback foi publicado.");setLoading(false);}
  return <form onSubmit={submit} className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6"><h2 className="text-xl font-black">Como foi sua experiência?</h2><p className="mt-2 text-sm text-zinc-400">Avalie a confiança, o atendimento e a entrega da Cosmic Store.</p><div className="mt-4 flex gap-1">{[1,2,3,4,5].map(star=><button type="button" key={star} onClick={()=>setRating(star)} className={`text-3xl ${star<=rating?"text-amber-300":"text-zinc-700"}`}>★</button>)}</div><textarea required minLength={3} maxLength={600} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Conte como foi comprar com a gente..." className="mt-4 min-h-28 w-full rounded-xl border border-white/10 bg-[#08070b] p-4 outline-none focus:border-violet-500"/><button disabled={loading} className="mt-3 rounded-xl bg-violet-600 px-5 py-3 font-bold disabled:opacity-50">{loading?"Enviando...":initial?"Atualizar feedback":"Enviar feedback"}</button>{message&&<p className="mt-3 text-sm text-zinc-300">{message}</p>}</form>;
}

