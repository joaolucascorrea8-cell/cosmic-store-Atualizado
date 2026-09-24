"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playNotificationTone, unlockNotificationAudio } from "@/lib/client-notification-sound";

const SOUND_KEY = "cosmic-notification-sound";
const hiddenRoutes = ["/checkout", "/chat"];

type NotificationPayload = {
  id: string;
  title?: string;
  body?: string;
  link?: string | null;
  created_at?: string;
};
type NotificationCounts = { total: number; support: number; orders: number; other: number };
type NotificationScope = "support" | "orders" | "other";

function scopeFromLink(link?: string | null): NotificationScope {
  if (link?.startsWith("/suporte") || link?.startsWith("/admin/suporte")) return "support";
  if (link?.startsWith("/pedidos") || link?.startsWith("/admin/pedidos")) return "orders";
  return "other";
}

function countNotifications(items: NotificationPayload[]): NotificationCounts {
  const counts: NotificationCounts = { total: items.length, support: 0, orders: 0, other: 0 };
  items.forEach((item) => { counts[scopeFromLink(item.link)] += 1; });
  return counts;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white" aria-label={`${count} não lida${count === 1 ? "" : "s"}`}>{count > 99 ? "99+" : count}</span>;
}

export default function FloatingChat({
  initialNotifications,
  userId,
  isAdmin = false,
}: {
  initialNotifications: NotificationPayload[];
  userId: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const panelId = useId();
  const originalTitle = useRef("Cosmic Store");
  const seenNotificationIds = useRef(new Set(initialNotifications.map((item) => item.id)));
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(() => countNotifications(initialNotifications));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const hidden = hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const supportHref = isAdmin ? "/admin/suporte" : "/suporte";
  const ordersHref = isAdmin ? "/admin/pedidos" : "/pedidos";

  const announce = useCallback(async (notification: NotificationPayload) => {
    document.title = `🔔 ${notification.title ?? "Nova atualização"} — Cosmic Store`;
    if (localStorage.getItem(SOUND_KEY) === "off") return;
    const unlocked = await unlockNotificationAudio();
    if (unlocked) playNotificationTone(isAdmin ? "admin" : "customer");
  }, [isAdmin]);

  const applyUnread = useCallback((items: NotificationPayload[], announceNew: boolean) => {
    const unseen = items.filter((item) => !seenNotificationIds.current.has(item.id));
    items.forEach((item) => seenNotificationIds.current.add(item.id));
    setCounts(countNotifications(items));
    if (announceNew && unseen.length > 0) void announce(unseen[0]);
  }, [announce]);

  const refreshUnread = useCallback(async (announceNew = true) => {
    const { data, error } = await createClient()
      .from("notifications")
      .select("id,title,body,link,created_at")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) applyUnread(data as NotificationPayload[], announceNew);
  }, [applyUnread, userId]);

  useEffect(() => {
    originalTitle.current = document.title;
    const timer = window.setTimeout(() => setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off"), 0);

    const unlock = () => {
      if (localStorage.getItem(SOUND_KEY) !== "off") void unlockNotificationAudio();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
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
    window.addEventListener("cosmic-sound-setting", syncSound);
    return () => window.removeEventListener("cosmic-sound-setting", syncSound);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`floating-notifications-${userId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (event) => {
        const notification = event.new as NotificationPayload;
        if (!notification.id || seenNotificationIds.current.has(notification.id)) return;
        seenNotificationIds.current.add(notification.id);
        setCounts((current) => {
          const scope = scopeFromLink(notification.link);
          return {
            total: current.total + 1,
            support: current.support + (scope === "support" ? 1 : 0),
            orders: current.orders + (scope === "orders" ? 1 : 0),
            other: current.other + (scope === "other" ? 1 : 0),
          };
        });
        void announce(notification);
      },
    ).subscribe();

    // Fallback deliberado: se o Realtime estiver bloqueado/desativado, a aba aberta
    // ainda busca as notificações e toca o aviso em poucos segundos.
    const interval = window.setInterval(() => { void refreshUnread(true); }, 3500);
    const sync = () => { if (document.visibilityState === "visible") void refreshUnread(true); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      void supabase.removeChannel(channel);
    };
  }, [announce, refreshUnread, userId]);

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
      if (unlocked) playNotificationTone("preview");
    }
    window.dispatchEvent(new CustomEvent("cosmic-sound-setting", { detail: { enabled: next } }));
  }

  async function testSound() {
    const unlocked = await unlockNotificationAudio();
    if (unlocked) playNotificationTone("preview");
  }

  const totalLabel = useMemo(() => counts.total > 9 ? "9+" : String(counts.total), [counts.total]);
  if (hidden) return null;

  return <div className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40">
    <div id={panelId} className={`mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#121017]/95 shadow-2xl backdrop-blur-xl ${open ? "block" : "hidden"}`}>
      <div className="border-b border-white/10 p-4"><strong>Conversas e suporte</strong><p className="mt-1 text-xs text-zinc-400">Acompanhe compras e fale com a equipe.</p></div>
      <div className="space-y-2 p-3">
        <Link href="/chat" className="block rounded-xl bg-white/5 p-4 hover:bg-white/10"><strong>Chat global</strong><p className="mt-1 text-xs text-zinc-400">Converse com a comunidade</p></Link>
        <Link href={supportHref} className="flex items-center justify-between gap-3 rounded-xl bg-violet-500/10 p-4 hover:bg-violet-500/15"><span><strong className="text-violet-200">Suporte</strong><span className="mt-1 block text-xs text-zinc-400">{isAdmin ? "Ver atendimentos dos clientes" : "Abra um atendimento particular"}</span></span><CountBadge count={counts.support} /></Link>
        <Link href={ordersHref} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-4 hover:bg-white/10"><span><strong>{isAdmin ? "Pedidos" : "Meus pedidos"}</strong><span className="mt-1 block text-xs text-zinc-400">{isAdmin ? "Compras e conversas dos clientes" : "Acompanhe suas compras e conversas"}</span></span><CountBadge count={counts.orders} /></Link>
        <div className="rounded-xl border border-white/10 p-3">
          <button type="button" onClick={() => void toggleSound()} className="flex min-h-10 w-full items-center justify-between text-left text-xs font-bold text-zinc-300"><span>{soundEnabled ? "🔔 Avisos sonoros ativados" : "🔕 Avisos sonoros desativados"}</span><span className={soundEnabled ? "text-emerald-400" : "text-zinc-500"}>{soundEnabled ? "ON" : "OFF"}</span></button>
          {soundEnabled && <button type="button" onClick={() => void testSound()} className="mt-1 min-h-9 w-full rounded-lg bg-white/5 px-3 text-xs font-bold text-violet-200 hover:bg-white/10">Testar som</button>}
        </div>
        <Link href="/notificacoes" className="flex min-h-11 items-center justify-between rounded-xl px-2 py-3 text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-violet-300"><span>Ver histórico de notificações →</span><CountBadge count={counts.total} /></Link>
      </div>
    </div>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar conversas e suporte" : "Abrir conversas e suporte"} aria-expanded={open} aria-controls={panelId} className="relative ml-auto grid h-14 w-14 place-items-center rounded-full bg-violet-600 text-2xl shadow-[0_12px_40px_rgba(124,58,237,.45)] transition hover:scale-105 hover:bg-violet-500">
      <span aria-hidden="true">💬</span>
      {counts.total > 0 && <span aria-label={`${counts.total} notificações não lidas`} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1 text-xs font-black">{totalLabel}</span>}
    </button>
  </div>;
}
