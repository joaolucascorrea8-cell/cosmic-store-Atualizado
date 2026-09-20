"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export default function NotificationList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  async function read(item: Notification) {
    if (item.read_at) return;
    const now = new Date().toISOString();
    await createClient().from("notifications").update({ read_at: now }).eq("id", item.id);
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: now } : entry));
  }
  return (
    <div role="feed" aria-live="polite" className="mt-8 space-y-3">
      {items.length ? items.map((item) => {
        const content = <article aria-label={`${item.read_at ? "Notificação lida" : "Nova notificação"}: ${item.title}`} className={`rounded-2xl border p-5 ${item.read_at ? "border-white/10 bg-white/[.02]" : "border-violet-500/30 bg-violet-500/5"}`}><div className="flex justify-between gap-4"><strong>{item.title}</strong>{!item.read_at && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-violet-400" />}</div><p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p><time className="mt-3 block text-xs text-zinc-400">{new Date(item.created_at).toLocaleString("pt-BR")}</time></article>;
        return item.link ? <Link key={item.id} href={item.link} onClick={() => void read(item)}>{content}</Link> : <button key={item.id} type="button" onClick={() => void read(item)} className="block w-full text-left">{content}</button>;
      }) : <p className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-zinc-400">Nenhuma notificação ainda.</p>}
    </div>
  );
}
