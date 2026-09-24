"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationItem = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

function scopeFromLink(link: string | null) {
  if (link?.startsWith("/suporte")) return "support";
  if (link?.startsWith("/pedidos")) return "orders";
  return "other";
}

export default function NotificationList({ initial, userId }: { initial: NotificationItem[]; userId: string }) {
  const [items, setItems] = useState(initial);
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`notification-list-${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (event) => {
      const next = event.new as NotificationItem;
      setItems((current) => current.some((item) => item.id === next.id) ? current : [next, ...current]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  async function read(item: NotificationItem) {
    if (item.read_at) return;
    const now = new Date().toISOString();
    const { error } = await createClient().from("notifications").update({ read_at: now }).eq("id", item.id);
    if (!error) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: now } : entry));
      window.dispatchEvent(new CustomEvent("cosmic-notifications-read", { detail: { amount: 1, scope: scopeFromLink(item.link) } }));
    }
  }

  async function readAll() {
    const now = new Date().toISOString();
    const { error } = await createClient().from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    if (!error) {
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
      window.dispatchEvent(new CustomEvent("cosmic-notifications-read", { detail: { all: true } }));
    }
  }

  return <>
    {unread > 0 && <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><p className="text-sm text-zinc-300"><strong className="text-white">{unread}</strong> {unread === 1 ? "notificação não lida" : "notificações não lidas"}</p><button type="button" onClick={() => void readAll()} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-bold hover:bg-violet-500">Marcar todas como lidas</button></div>}
    <div role="feed" aria-live="polite" className="mt-6 space-y-3">
      {items.length ? items.map((item) => {
        const content = <article aria-label={`${item.read_at ? "Notificação lida" : "Nova notificação"}: ${item.title}`} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${item.read_at ? "border-white/10 bg-white/[.02]" : "border-violet-500/30 bg-violet-500/5"}`}><div className="flex justify-between gap-4"><strong>{item.title}</strong>{!item.read_at && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400" />}</div><p className="mt-2 text-sm leading-6 text-zinc-300">{item.body}</p><time className="mt-3 block text-xs text-zinc-400">{new Date(item.created_at).toLocaleString("pt-BR")}</time></article>;
        return item.link ? <Link key={item.id} href={item.link} onClick={() => void read(item)}>{content}</Link> : <button key={item.id} type="button" onClick={() => void read(item)} className="block w-full text-left">{content}</button>;
      }) : <p className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-zinc-400">Nenhuma notificação ainda.</p>}
    </div>
  </>;
}
