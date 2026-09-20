"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const hiddenRoutes = ["/chat", "/suporte", "/checkout"];

export default function FloatingChat({ unread, userId }: { unread: number; userId: string }) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unread);
  const hidden = hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)) || pathname.startsWith("/pedidos/");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`floating-notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => setUnreadCount((current) => current + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unreadCount > 0) {
      const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
      if (!error) setUnreadCount(0);
    }
  }

  if (hidden) return null;

  return (
    <div className="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40">
      <div id={panelId} className={`mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#121017] shadow-2xl ${open ? "block" : "hidden"}`}>
        <div className="border-b border-white/10 p-4"><strong>Conversas e suporte</strong><p className="mt-1 text-xs text-zinc-400">Escolha onde deseja conversar.</p></div>
        <div className="space-y-2 p-3">
          <Link href="/chat" className="block rounded-xl bg-white/5 p-4 hover:bg-white/10"><strong>Chat global</strong><p className="mt-1 text-xs text-zinc-400">Converse com a comunidade</p></Link>
          <Link href="/suporte" className="block rounded-xl bg-violet-500/10 p-4 hover:bg-violet-500/15"><strong className="text-violet-200">Suporte</strong><p className="mt-1 text-xs text-zinc-400">Abra um atendimento particular</p></Link>
          <Link href="/pedidos" className="block rounded-xl bg-white/5 p-4 hover:bg-white/10"><strong>Meus pedidos</strong><p className="mt-1 text-xs text-zinc-400">Conversas relacionadas às compras</p></Link>
          <Link href="/notificacoes" className="block px-2 py-2 text-center text-xs font-bold text-zinc-400 hover:text-violet-300">Ver histórico de notificações →</Link>
        </div>
      </div>
      <button type="button" onClick={() => void toggle()} aria-label={open ? "Fechar conversas e suporte" : "Abrir conversas e suporte"} aria-expanded={open} aria-controls={panelId} className="relative ml-auto grid h-14 w-14 place-items-center rounded-full bg-violet-600 text-2xl shadow-[0_12px_40px_rgba(124,58,237,.45)]">
        <span aria-hidden="true">💬</span>
        {unreadCount > 0 && <span aria-label={`${unreadCount} notificações não lidas`} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1 text-xs font-black">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
    </div>
  );
}
