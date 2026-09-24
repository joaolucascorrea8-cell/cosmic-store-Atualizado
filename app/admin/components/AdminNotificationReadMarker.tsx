"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminNotificationReadMarker({ userId }: { userId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const orderDetail = pathname.match(/^\/admin\/pedidos\/[^/]+$/);
    const supportDetail = pathname.match(/^\/admin\/suporte\/[^/]+$/);
    const scope: "orders" | "support" | null = orderDetail ? "orders" : supportDetail ? "support" : null;
    if (!scope) return;

    let active = true;
    void createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("link", pathname)
      .is("read_at", null)
      .select("id")
      .then(({ data, error }) => {
        if (!active || error || !data?.length) return;
        window.dispatchEvent(new CustomEvent("cosmic-notifications-read", {
          detail: { scope, amount: data.length },
        }));
      });

    return () => { active = false; };
  }, [pathname, userId]);

  return null;
}
