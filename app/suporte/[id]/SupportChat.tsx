"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
  profiles?: { nickname: string } | null;
};

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function SupportChat({
  ticketId,
  userId,
  initialMessages,
  canSend,
}: {
  ticketId: string;
  userId: string;
  initialMessages: Message[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const keepAtBottom = useRef(true);
  const subscribedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/support/${ticketId}/messages`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { messages?: Message[] };
      if (!data.messages) return;
      setMessages((current) => {
        const next = data.messages ?? [];
        if (current.length === next.length && current.every((item, index) => (
          item.id === next[index]?.id
          && item.message === next[index]?.message
          && item.attachment_url === next[index]?.attachment_url
        ))) return current;
        return next;
      });
    } catch {
      // O próximo polling tenta novamente.
    }
  }, [ticketId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`support-${ticketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` }, () => void refresh())
      .subscribe((status) => { subscribedRef.current = status === "SUBSCRIBED"; });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, subscribedRef.current ? 9000 : 4000);
    const sync = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      void supabase.removeChannel(channel);
    };
  }, [ticketId, refresh]);

  useEffect(() => {
    if (keepAtBottom.current && listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  function chooseAttachment(file: File | null) {
    setError("");
    if (!file) { setAttachment(null); return; }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setError("Envie uma imagem JPG, PNG ou WEBP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("A imagem pode ter no máximo 3 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAttachment(file);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = message.trim();
    if ((!clean && !attachment) || sending) return;

    keepAtBottom.current = true;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("message", clean);
      if (attachment) form.append("attachment", attachment);
      const response = await fetch(`/api/support/${ticketId}/messages`, { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível enviar.");
        return;
      }
      setMessage("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return <section className="surface overflow-hidden rounded-3xl">
    <div role="log" aria-live="polite" aria-relevant="additions" ref={listRef} onScroll={(event) => {
      const element = event.currentTarget;
      keepAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    }} className="h-[52dvh] min-h-[380px] space-y-3 overflow-y-auto p-5">
      {messages.length ? messages.map((item) => <div key={item.id} className={`flex ${item.user_id === userId ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[82%] ${item.user_id === userId ? "bg-violet-600" : "bg-white/[.06]"}`}>
          <p className="text-xs font-bold opacity-70">{item.profiles?.nickname ?? (item.user_id === userId ? "Você" : "Equipe Cosmic")}</p>
          {item.message && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.message}</p>}
          {item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/10 bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.attachment_url} alt={item.attachment_name ? `Imagem anexada: ${item.attachment_name}` : "Imagem anexada ao suporte"} className="max-h-80 w-full object-contain" />
          </a>}
          <time className="mt-2 block text-xs opacity-70">{new Date(item.created_at).toLocaleString("pt-BR")}</time>
        </div>
      </div>) : <p className="py-8 text-center text-sm text-zinc-400">Nenhuma mensagem neste atendimento.</p>}
    </div>

    {canSend ? <form onSubmit={send} className="border-t border-white/[.07] p-4">
      {attachment && <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs">
        <span className="min-w-0 truncate">📎 {attachment.name}</span>
        <button type="button" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="shrink-0 font-black text-zinc-300 hover:text-white">Remover</button>
      </div>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="grid min-h-12 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-zinc-300 hover:bg-white/10" title="Enviar imagem">
          📎 <span className="sr-only">Selecionar imagem</span>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseAttachment(event.target.files?.[0] ?? null)} disabled={sending} className="sr-only" />
        </label>
        <label htmlFor="support-message" className="sr-only">Mensagem para o suporte</label>
        <input id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1500} disabled={sending} placeholder="Escreva uma mensagem ou envie uma imagem..." className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-violet-500" />
        <button disabled={sending || (!message.trim() && !attachment)} className="min-h-12 rounded-xl bg-violet-600 px-5 font-bold disabled:opacity-50">{sending ? "Enviando..." : "Enviar"}</button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Imagens JPG, PNG ou WEBP de até 3 MB.</p>
    </form> : <div className="border-t border-white/[.07] p-4 text-center text-sm text-zinc-400">Atendimento encerrado. A equipe pode reabri-lo se necessário.</div>}

    {error && <p role="alert" className="px-4 pb-4 text-xs text-red-300">{error}</p>}
  </section>;
}
