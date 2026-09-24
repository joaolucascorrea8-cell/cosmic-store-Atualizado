"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type NotificationScope = "support" | "orders";

export default function NotificationReadMarker({ userId, scope }: { userId: string; scope: NotificationScope }) {
  useEffect(() => {
    let active = true;
    const prefix = scope === "support" ? "/suporte%" : "/pedidos%";
    const mark = async () => {
      const { error } = await createClient()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null)
        .like("link", prefix);
      if (!active || error) return;
      window.dispatchEvent(new CustomEvent("cosmic-notifications-read", { detail: { scope } }));
    };
    void mark();
    return () => { active = false; };
  }, [scope, userId]);

  return null;
}
