"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; user_id: string; message: string; created_at: string; profiles?: { nickname: string } | null };

export default function SupportChat({ ticketId, userId, initialMessages, canSend }: { ticketId: string; userId: string; initialMessages: Message[]; canSend: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const keepAtBottom = useRef(true);
  const subscribedRef = useRef(false);

  const refresh = useCallback(async () => {
    const { data } = await createClient().from("support_messages").select("id,user_id,message,created_at,profiles(nickname)").eq("ticket_id", ticketId).order("created_at");
    if (data) {
      const next = data as unknown as Message[];
      setMessages((current) => current.length === next.length && current.every((item, index) => item.id === next[index]?.id && item.message === next[index]?.message) ? current : next);
    }
  }, [ticketId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`support-${ticketId}`).on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` }, () => void refresh()).subscribe((status) => { subscribedRef.current = status === "SUBSCRIBED"; });
    const interval = window.setInterval(() => {
      if (!subscribedRef.current && document.visibilityState === "visible") void refresh();
    }, 15000);
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
    if (keepAtBottom.current && listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;
    keepAtBottom.current = true;
    setMessage("");
    setError("");
    const temp = `temp-${Date.now()}`;
    setMessages((current) => [...current, { id: temp, user_id: userId, message: clean, created_at: new Date().toISOString() }]);
    const response = await fetch(`/api/support/${ticketId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean }) });
    const data = await response.json();
    if (!response.ok) {
      setMessages((current) => current.filter((item) => item.id !== temp));
      setMessage(clean);
      setError(data.error ?? "Não foi possível enviar.");
      return;
    }
    await refresh();
  }

  return (
    <section className="surface overflow-hidden rounded-3xl">
      <div role="log" aria-live="polite" aria-relevant="additions" ref={listRef} onScroll={(event) => { const element = event.currentTarget; keepAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="h-[52dvh] min-h-[380px] space-y-3 overflow-y-auto p-5">
        {messages.map((item) => <div key={item.id} className={`flex ${item.user_id === userId ? "justify-end" : "justify-start"} ${item.id.startsWith("temp-") ? "opacity-70" : ""}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${item.user_id === userId ? "bg-violet-600" : "bg-white/[.06]"}`}><p className="text-xs font-bold opacity-70">{item.profiles?.nickname ?? (item.user_id === userId ? "Você" : "Equipe Cosmic")}</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.message}</p><time className="mt-2 block text-xs opacity-70">{item.id.startsWith("temp-") ? "enviando..." : new Date(item.created_at).toLocaleString("pt-BR")}</time></div></div>)}
      </div>
      {canSend ? <form onSubmit={send} className="flex gap-2 border-t border-white/[.07] p-4"><label htmlFor="support-message" className="sr-only">Mensagem para o suporte</label><input id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1500} placeholder="Escreva sua mensagem..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-violet-500" /><button className="min-h-11 rounded-xl bg-violet-600 px-5 font-bold">Enviar</button></form> : <div className="border-t border-white/[.07] p-4 text-center text-sm text-zinc-400">Atendimento encerrado. A equipe pode reabri-lo se necessário.</div>}
      {error && <p role="alert" className="px-4 pb-4 text-xs text-red-300">{error}</p>}
    </section>
  );
}
