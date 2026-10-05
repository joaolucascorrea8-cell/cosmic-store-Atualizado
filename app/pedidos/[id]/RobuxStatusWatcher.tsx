"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function RobuxStatusWatcher({
  orderId,
  initialSupplierStatus,
}: {
  orderId: string;
  initialSupplierStatus: string;
}) {
  const router = useRouter();
  const status = useRef(initialSupplierStatus);

  const sync = useCallback(async () => {
    if (status.current !== "PENDING") return;
    try {
      const response = await fetch(`/api/robux/orders/${orderId}/status`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        status?: string;
        changed?: boolean;
      };
      if (data.status) status.current = data.status;
      if (data.changed || data.status === "COMPLETED" || data.status === "CANCELLED")
        router.refresh();
    } catch {}
  }, [orderId, router]);

  useEffect(() => {
    if (status.current !== "PENDING") return;
    void sync();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 10_000);
    const visible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [sync]);

  return null;
}
