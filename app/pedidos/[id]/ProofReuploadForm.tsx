"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProofReuploadForm({orderId}:{orderId:string}){
  const router=useRouter();
  const [proof,setProof]=useState<File|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function upload(){
    if(!proof)return;
    if(!["image/jpeg","image/png","application/pdf"].includes(proof.type)||proof.size>5*1024*1024){setError("Envie JPG, PNG ou PDF de até 5 MB.");return;}
    setLoading(true);setError("");
    try{
      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){router.push(`/login?next=/pedidos/${orderId}`);return;}
      const extension=proof.type==="application/pdf"?"pdf":proof.type==="image/png"?"png":"jpg";
      const path=`${user.id}/${orderId}/comprovante-${Date.now()}.${extension}`;
      const {error:uploadError}=await supabase.storage.from("payment-proofs").upload(path,proof,{contentType:proof.type});
      if(uploadError)throw uploadError;
      const response=await fetch(`/api/orders/${orderId}/proof`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Não foi possível reenviar o comprovante.");
      router.push(`/pedidos/${orderId}?proof=resent`);router.refresh();
    }catch(caught){setError(caught instanceof Error?caught.message:"Erro ao reenviar comprovante.");}
    finally{setLoading(false);}
  }

  return <section className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-6"><h2 className="text-xl font-black">Enviar novo comprovante</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Confira o motivo informado pela equipe e envie um arquivo corrigido.</p><label className="mt-5 block cursor-pointer rounded-xl border border-dashed border-red-400/30 bg-black/20 p-6 text-center"><strong>{proof?proof.name:"Selecionar novo comprovante"}</strong><span className="mt-2 block text-xs text-zinc-500">JPG, PNG ou PDF de até 5 MB</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>setProof(event.target.files?.[0]??null)} className="sr-only"/></label><button type="button" disabled={!proof||loading} onClick={upload} className="mt-4 w-full rounded-xl bg-violet-600 py-3 font-black disabled:opacity-50">{loading?"Enviando...":"Reenviar comprovante"}</button>{error&&<p className="mt-3 text-sm text-red-300">{error}</p>}</section>;
}
