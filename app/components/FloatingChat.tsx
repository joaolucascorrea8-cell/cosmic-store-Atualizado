"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NOTIFICATION_VOLUME,
  getStoredNotificationVolume,
  playNotificationTone,
  setStoredNotificationVolume,
  unlockNotificationAudio,
} from "@/lib/client-notification-sound";

const hiddenRoutes = ["/chat", "/suporte", "/checkout"];
const SOUND_KEY = "cosmic-notification-sound";

type NotificationPayload = { title?: string; body?: string; link?: string | null };
type NotificationCounts = { total: number; support: number; orders: number; other: number };
type NotificationScope = "support" | "orders" | "other";

function scopeFromLink(link?: string | null): NotificationScope {
  if (link?.startsWith("/suporte")) return "support";
  if (link?.startsWith("/pedidos")) return "orders";
  return "other";
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white" aria-label={`${count} não lida${count === 1 ? "" : "s"}`}>{count > 99 ? "99+" : count}</span>;
}

export default function FloatingChat({ initialCounts, userId, isAdmin = false }: { initialCounts: NotificationCounts; userId: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const panelId = useId();
  const originalTitle = useRef("Cosmic Store");
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(initialCounts);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_NOTIFICATION_VOLUME);
  const hidden = hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)) || pathname.startsWith("/pedidos/");

  useEffect(() => {
    originalTitle.current = document.title;
    const timer = window.setTimeout(() => {
      setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off");
      setVolume(Math.max(0.35, getStoredNotificationVolume()));
    }, 0);

    const unlock = () => {
      if (localStorage.getItem(SOUND_KEY) !== "off") void unlockNotificationAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const syncSound = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") setSoundEnabled(detail.enabled);
    };
    const syncVolume = (event: Event) => {
      const detail = (event as CustomEvent<{ volume?: number }>).detail;
      if (typeof detail?.volume === "number") setVolume(Math.max(0.35, Math.min(1, detail.volume)));
    };
    window.addEventListener("cosmic-sound-setting", syncSound);
    window.addEventListener("cosmic-sound-volume", syncVolume);
    return () => {
      window.removeEventListener("cosmic-sound-setting", syncSound);
      window.removeEventListener("cosmic-sound-volume", syncVolume);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`floating-notifications-${userId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (event) => {
        const notification = event.new as NotificationPayload;
        const scope = scopeFromLink(notification.link);
        setCounts((current) => ({
          total: current.total + 1,
          support: current.support + (scope === "support" ? 1 : 0),
          orders: current.orders + (scope === "orders" ? 1 : 0),
          other: current.other + (scope === "other" ? 1 : 0),
        }));
        document.title = `🔔 ${notification.title ?? "Nova atualização"} — Cosmic Store`;
        if (localStorage.getItem(SOUND_KEY) !== "off") {
          void unlockNotificationAudio().then(() => playNotificationTone("customer"));
        }
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
    if (!isAdmin) return;
    const supabase = createClient();

    const notifyAdmin = (title: string, body: string, link: string) => {
      document.title = `🔔 ${title} — Cosmic Store`;
      if (localStorage.getItem(SOUND_KEY) !== "off") {
        void unlockNotificationAudio().then(() => playNotificationTone("admin"));
      }
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          icon: "/images/branding/cosmic-store-icon-512.png",
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = link;
          notification.close();
        };
      }
    };

    const channel = supabase.channel(`admin-global-alerts-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (event) => {
        const order = event.new as { id?: string; order_code?: string };
        notifyAdmin("Novo pedido recebido", order.order_code ? `Pedido ${order.order_code} acabou de ser criado.` : "Um cliente acabou de criar um pedido.", order.id ? `/admin/pedidos/${order.id}` : "/admin/pedidos");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (event) => {
        const order = event.new as { id?: string; order_code?: string; status?: string };
        if (order.status !== "proof_submitted") return;
        notifyAdmin("Novo comprovante recebido", order.order_code ? `O pedido ${order.order_code} enviou um comprovante.` : "Um cliente enviou um comprovante.", order.id ? `/admin/pedidos/${order.id}` : "/admin/pedidos?status=pending");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (event) => {
        const message = event.new as { ticket_id?: string; user_id?: string };
        if (message.user_id === userId) return;
        notifyAdmin("Nova mensagem no suporte", "Um cliente enviou uma mensagem para a equipe.", message.ticket_id ? `/admin/suporte/${message.ticket_id}` : "/admin/suporte");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, (event) => {
        const message = event.new as { order_id?: string; user_id?: string };
        if (message.user_id === userId) return;
        notifyAdmin("Nova mensagem de pedido", "Um cliente enviou uma mensagem em um pedido.", message.order_id ? `/admin/pedidos/${message.order_id}` : "/admin/pedidos");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reports" }, (event) => {
        const report = event.new as { reporter_id?: string };
        if (report.reporter_id === userId) return;
        notifyAdmin("Nova denúncia na comunidade", "Há uma nova denúncia aguardando análise.", "/admin/comunidade");
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, userId]);

  useEffect(() => {
    const restoreTitle = () => {
      if (!document.hidden) document.title = originalTitle.current;
    };
    const markRead = (event: Event) => {
      const detail = (event as CustomEvent<{ amount?: number; all?: boolean; scope?: NotificationScope }>).detail;
      setCounts((current) => {
        if (detail?.all) return { total: 0, support: 0, orders: 0, other: 0 };
        if (detail?.scope) {
          const available = current[detail.scope];
          const removed = detail.amount == null ? available : Math.min(available, detail.amount);
          return { ...current, total: Math.max(0, current.total - removed), [detail.scope]: Math.max(0, available - removed) };
        }
        const amount = detail?.amount ?? 1;
        return { ...current, total: Math.max(0, current.total - amount), other: Math.max(0, current.other - amount) };
      });
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

  async function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) {
      const unlocked = await unlockNotificationAudio();
      if (unlocked) playNotificationTone("preview", volume);
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    }
    window.dispatchEvent(new CustomEvent("cosmic-sound-setting", { detail: { enabled: next } }));
  }

  async function updateVolume(next: number) {
    setVolume(next);
    setStoredNotificationVolume(next);
    if (soundEnabled) {
      const unlocked = await unlockNotificationAudio();
      if (unlocked) playNotificationTone("preview", next);
    }
    window.dispatchEvent(new CustomEvent("cosmic-sound-volume", { detail: { volume: next } }));
  }

  async function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next && soundEnabled) {
      await unlockNotificationAudio();
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    }
  }

  if (hidden) return null;

  return <div className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40">
    <div id={panelId} className={`mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#121017]/95 shadow-2xl backdrop-blur-xl ${open ? "block" : "hidden"}`}>
      <div className="border-b border-white/10 p-4"><strong>Conversas e suporte</strong><p className="mt-1 text-xs text-zinc-400">Acompanhe compras e fale com a equipe.</p></div>
      <div className="space-y-2 p-3">
        <Link href="/chat" className="block rounded-xl bg-white/5 p-4 hover:bg-white/10"><strong>Chat global</strong><p className="mt-1 text-xs text-zinc-400">Converse com a comunidade</p></Link>
        <Link href="/suporte" className="flex items-center justify-between gap-3 rounded-xl bg-violet-500/10 p-4 hover:bg-violet-500/15"><span><strong className="text-violet-200">Suporte</strong><span className="mt-1 block text-xs text-zinc-400">Abra um atendimento particular</span></span><CountBadge count={counts.support} /></Link>
        <Link href="/pedidos" className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-4 hover:bg-white/10"><span><strong>Meus pedidos</strong><span className="mt-1 block text-xs text-zinc-400">Acompanhe suas compras e conversas</span></span><CountBadge count={counts.orders} /></Link>
        <div className="rounded-xl border border-white/10 p-3">
          <button type="button" onClick={() => void toggleSound()} className="flex min-h-10 w-full items-center justify-between text-left text-xs font-bold text-zinc-300"><span>{soundEnabled ? "🔔 Avisos sonoros ativados" : "🔕 Avisos sonoros desativados"}</span><span className={soundEnabled ? "text-emerald-400" : "text-zinc-500"}>{soundEnabled ? "ON" : "OFF"}</span></button>
          <label className="mt-2 block text-[11px] font-semibold text-zinc-500" htmlFor="cosmic-notification-volume">Volume dos avisos: {Math.round(volume * 100)}%</label>
          <input id="cosmic-notification-volume" type="range" min="0.35" max="1" step="0.05" value={volume} onChange={(event) => void updateVolume(Number(event.target.value))} disabled={!soundEnabled} className="mt-2 w-full accent-violet-500 disabled:opacity-40" />
        </div>
        <Link href="/notificacoes" className="flex min-h-11 items-center justify-between rounded-xl px-2 py-3 text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-violet-300"><span>Ver histórico de notificações →</span><CountBadge count={counts.total} /></Link>
      </div>
    </div>
    <button type="button" onClick={() => void togglePanel()} aria-label={open ? "Fechar conversas e suporte" : "Abrir conversas e suporte"} aria-expanded={open} aria-controls={panelId} className="relative ml-auto grid h-14 w-14 place-items-center rounded-full bg-violet-600 text-2xl shadow-[0_12px_40px_rgba(124,58,237,.45)] transition hover:scale-105 hover:bg-violet-500">
      <span aria-hidden="true">💬</span>
      {counts.total > 0 && <span aria-label={`${counts.total} notificações não lidas`} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1 text-xs font-black">{counts.total > 9 ? "9+" : counts.total}</span>}
    </button>
  </div>;
}
