"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OrderStatusWatcher({ orderId, initialStatus, initialChatClosedAt }: { orderId: string; initialStatus: string; initialChatClosedAt: string | null }) {
  const router = useRouter();
  const lastSnapshot = useRef(JSON.stringify({ status: initialStatus, chat_closed_at: initialChatClosedAt }));

  const checkForUpdates = useCallback(async () => {
    const { data } = await createClient().from("orders").select("status,chat_closed_at").eq("id", orderId).maybeSingle();
    if (!data) return;
    const snapshot = JSON.stringify(data);
    if (snapshot !== lastSnapshot.current) {
      lastSnapshot.current = snapshot;
      router.refresh();
    }
  }, [orderId, router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`order-status-${orderId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => void checkForUpdates()).subscribe();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkForUpdates();
    }, 10_000);
    const sync = () => { if (document.visibilityState === "visible") void checkForUpdates(); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      void supabase.removeChannel(channel);
    };
  }, [checkForUpdates, orderId]);

  return null;
}
