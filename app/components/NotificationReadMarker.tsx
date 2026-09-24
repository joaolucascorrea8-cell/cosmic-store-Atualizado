"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type NotificationScope = "support" | "orders";

export default function NotificationReadMarker({
  userId,
  scope,
  link,
}: {
  userId: string;
  scope: NotificationScope;
  link?: string;
}) {
  useEffect(() => {
    let active = true;
    const mark = async () => {
      const client = createClient();
      let query = client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      query = link
        ? query.eq("link", link)
        : query.like("link", scope === "support" ? "/suporte%" : "/pedidos%");
      const { data, error } = await query.select("id");
      if (!active || error || !data?.length) return;
      window.dispatchEvent(new CustomEvent("cosmic-notifications-read", {
        detail: { scope, amount: data.length },
      }));
    };
    void mark();
    return () => { active = false; };
  }, [link, scope, userId]);

  return null;
}
