"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; user_id: string; message: string; created_at: string; profiles?: { nickname: string; avatar_url: string | null } | null };

export default function GlobalChat({ userId, nickname, isAdmin, initialMessages }: { userId: string; nickname: string; isAdmin: boolean; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const keepAtBottom = useRef(true);
  const subscribedRef = useRef(false);

  const refresh = useCallback(async () => {
    const { data } = await createClient().from("global_messages").select("id,user_id,message,created_at,profiles(nickname,avatar_url)").order("created_at", { ascending: false }).limit(100);
    if (data) {
      const next = (data as unknown as Message[]).reverse();
      setMessages((current) => current.length === next.length && current.every((item, index) => item.id === next[index]?.id && item.message === next[index]?.message) ? current : next);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("global-chat").on("postgres_changes", { event: "*", schema: "public", table: "global_messages" }, () => void refresh()).subscribe((status) => {
      const active = status === "SUBSCRIBED";
      subscribedRef.current = active;
      setConnected(active);
    });
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
  }, [refresh]);

  useEffect(() => {
    if (keepAtBottom.current && listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;
    keepAtBottom.current = true;
    setError("");
    setMessage("");
    const temporaryId = `temp-${Date.now()}`;
    setMessages((current) => [...current, { id: temporaryId, user_id: userId, message: clean, created_at: new Date().toISOString(), profiles: { nickname, avatar_url: null } }]);
    const { error: sendError } = await createClient().from("global_messages").insert({ user_id: userId, message: clean });
    if (sendError) {
      setMessages((current) => current.filter((item) => item.id !== temporaryId));
      setMessage(clean);
      setError(sendError.message);
      return;
    }
    await refresh();
  }

  async function remove(id: string) {
    setMessages((current) => current.filter((item) => item.id !== id));
    await createClient().from("global_messages").delete().eq("id", id);
    void refresh();
  }

  async function report(id: string) {
    const reason = window.prompt("Por que você está denunciando esta mensagem?");
    if (reason?.trim()) await createClient().from("message_reports").insert({ message_id: id, reporter_id: userId, reason: reason.trim() });
  }

  return (
    <section className="surface overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-white/[.07] p-5"><div><strong>Chat da comunidade</strong><p className="text-xs text-zinc-400">Mensagens em tempo real</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{connected ? "● Online" : "● Sincronizando"}</span></div>
      <div role="log" aria-live="polite" aria-relevant="additions" ref={listRef} onScroll={(event) => { const element = event.currentTarget; keepAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="h-[58dvh] min-h-[360px] space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && <div className="grid h-full place-items-center text-center"><div><span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-violet-500/10 text-2xl">✦</span><h2 className="mt-5 font-black">Comece a conversa</h2><p className="mt-2 text-sm text-zinc-400">Ainda não há mensagens por aqui.</p></div></div>}
        {messages.map((item) => <div key={item.id} className={`group flex gap-3 ${item.id.startsWith("temp-") ? "opacity-70" : ""}`}><div aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600 text-sm font-black">{item.profiles?.nickname?.charAt(0).toUpperCase() ?? "U"}</div><div className="min-w-0 flex-1 rounded-2xl border border-white/[.04] bg-white/[.035] px-4 py-3"><div className="flex items-center gap-2"><strong className="text-sm">{item.profiles?.nickname ?? "Usuário"}</strong><time className="text-xs text-zinc-400">{item.id.startsWith("temp-") ? "enviando..." : new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-1 break-words text-sm text-zinc-200">{item.message}</p><div className="mt-2 flex gap-3 text-xs text-zinc-400 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">{!item.id.startsWith("temp-") && (item.user_id === userId || isAdmin) && <button type="button" onClick={() => void remove(item.id)} className="hover:text-red-300">Apagar</button>}{!item.id.startsWith("temp-") && item.user_id !== userId && <button type="button" onClick={() => void report(item.id)} className="hover:text-amber-300">Denunciar</button>}</div></div></div>)}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-white/[.07] bg-black/10 p-4"><label htmlFor="global-message" className="sr-only">Mensagem para o chat global</label><input id="global-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder={`Mensagem como ${nickname}...`} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#08070b] px-4 py-3 outline-none focus:border-violet-500" /><button className="min-h-11 rounded-xl bg-violet-600 px-6 font-bold hover:bg-violet-500">Enviar</button></form>
      {error && <p role="alert" className="px-4 pb-4 text-xs text-red-300">{error}</p>}
    </section>
  );
}
