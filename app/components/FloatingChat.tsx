"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const hiddenRoutes = ["/chat", "/suporte", "/checkout"];
const SOUND_KEY = "cosmic-notification-sound";

type NotificationPayload = { title?: string; body?: string; link?: string | null };

function playNotificationTone() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.setValueAtTime(880, context.currentTime + 0.11);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
  window.setTimeout(() => void context.close(), 500);
}

export default function FloatingChat({ unread, userId }: { unread: number; userId: string }) {
  const pathname = usePathname();
  const panelId = useId();
  const originalTitle = useRef("Cosmic Store");
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unread);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const hidden = hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)) || pathname.startsWith("/pedidos/");

  useEffect(() => {
    originalTitle.current = document.title;
    const timer = window.setTimeout(() => setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`floating-notifications-${userId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (event) => {
        const notification = event.new as NotificationPayload;
        setUnreadCount((current) => current + 1);
        document.title = `🔔 ${notification.title ?? "Nova atualização"} — Cosmic Store`;
        if (localStorage.getItem(SOUND_KEY) !== "off") playNotificationTone();
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          const nativeNotification = new Notification(notification.title ?? "Cosmic Store", {
            body: notification.body ?? "Você recebeu uma nova atualização.",
            icon: "/images/branding/cosmic-store-icon-512.png",
          });
          nativeNotification.onclick = () => {
            window.focus();
            if (notification.link) window.location.href = notification.link;
            nativeNotification.close();
          };
        }
      },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    const restoreTitle = () => {
      if (!document.hidden) document.title = originalTitle.current;
    };
    const markRead = (event: Event) => {
      const amount = (event as CustomEvent<{ amount?: number; all?: boolean }>).detail;
      setUnreadCount((current) => amount?.all ? 0 : Math.max(0, current - (amount?.amount ?? 1)));
    };
    document.addEventListener("visibilitychange", restoreTitle);
    window.addEventListener("cosmic-notifications-read", markRead);
    return () => {
      document.removeEventListener("visibilitychange", restoreTitle);
      window.removeEventListener("cosmic-notifications-read", markRead);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function enableAlerts() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) {
      playNotificationTone();
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    }
  }

  async function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unreadCount > 0) {
      const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
      if (!error) {
        setUnreadCount(0);
        window.dispatchEvent(new CustomEvent("cosmic-notifications-read", { detail: { all: true } }));
      }
    }
  }

  if (hidden) return null;

  return <div className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40">
    <div id={panelId} className={`mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#121017]/95 shadow-2xl backdrop-blur-xl ${open ? "block" : "hidden"}`}>
      <div className="border-b border-white/10 p-4"><strong>Conversas e suporte</strong><p className="mt-1 text-xs text-zinc-400">Acompanhe compras e fale com a equipe.</p></div>
      <div className="space-y-2 p-3">
        <Link href="/chat" className="block rounded-xl bg-white/5 p-4 hover:bg-white/10"><strong>Chat global</strong><p className="mt-1 text-xs text-zinc-400">Converse com a comunidade</p></Link>
        <Link href="/suporte" className="block rounded-xl bg-violet-500/10 p-4 hover:bg-violet-500/15"><strong className="text-violet-200">Suporte</strong><p className="mt-1 text-xs text-zinc-400">Abra um atendimento particular</p></Link>
        <Link href="/pedidos" className="block rounded-xl bg-white/5 p-4 hover:bg-white/10"><strong>Meus pedidos</strong><p className="mt-1 text-xs text-zinc-400">Acompanhe suas compras e conversas</p></Link>
        <button type="button" onClick={() => void enableAlerts()} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 px-3 text-left text-xs font-bold text-zinc-300 hover:bg-white/5"><span>{soundEnabled ? "🔔 Avisos sonoros ativados" : "🔕 Avisos sonoros desativados"}</span><span className={soundEnabled ? "text-emerald-400" : "text-zinc-500"}>{soundEnabled ? "ON" : "OFF"}</span></button>
        <Link href="/notificacoes" className="block min-h-11 px-2 py-3 text-center text-xs font-bold text-zinc-400 hover:text-violet-300">Ver histórico de notificações →</Link>
      </div>
    </div>
    <button type="button" onClick={() => void toggle()} aria-label={open ? "Fechar conversas e suporte" : "Abrir conversas e suporte"} aria-expanded={open} aria-controls={panelId} className="relative ml-auto grid h-14 w-14 place-items-center rounded-full bg-violet-600 text-2xl shadow-[0_12px_40px_rgba(124,58,237,.45)] transition hover:scale-105 hover:bg-violet-500">
      <span aria-hidden="true">💬</span>
      {unreadCount > 0 && <span aria-label={`${unreadCount} notificações não lidas`} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1 text-xs font-black">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </button>
  </div>;
}
