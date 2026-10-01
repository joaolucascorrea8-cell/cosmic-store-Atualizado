"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  playNotificationTone,
  unlockNotificationAudio,
} from "@/lib/client-notification-sound";

import { readStorage, writeStorage } from "@/lib/client-storage";
const SOUND_KEY = "cosmic-notification-sound";
type Counts = { proofs: number; support: number; reports: number };

export default function AdminLiveAlerts({ initial }: { initial: Counts }) {
  const [counts, setCounts] = useState(initial);
  const [sound, setSound] = useState(true);
  const [newEvent, setNewEvent] = useState("");
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const client = createClient();
    const [orders, support, reports] = await Promise.all([
      client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["proof_submitted", "under_review"]),
      client
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      client
        .from("message_reports")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null),
    ]);
    if (orders.error || support.error || reports.error) {
      setError(true);
      return;
    }
    setCounts({
      proofs: orders.count ?? 0,
      support: support.count ?? 0,
      reports: reports.count ?? 0,
    });
    setError(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSound(readStorage(SOUND_KEY) !== "off"),
      0,
    );
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") setSound(detail.enabled);
    };
    window.addEventListener("cosmic-sound-setting", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("cosmic-sound-setting", sync);
    };
  }, []);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel("admin-live-center")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          void refresh();
          if (
            payload.eventType === "INSERT" ||
            (payload.eventType === "UPDATE" &&
              ["proof_submitted", "under_review"].includes(
                String((payload.new as { status?: string }).status),
              ))
          )
            setNewEvent("Novo movimento em pedidos");
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          void refresh();
          setNewEvent("Suporte atualizado");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => setNewEvent("Nova mensagem no suporte"),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages" },
        () => setNewEvent("Nova mensagem de pedido"),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reports" },
        () => {
          void refresh();
          setNewEvent("Nova denúncia na comunidade");
        },
      )
      .subscribe();
    const interval = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => {
      window.clearInterval(interval);
      void client.removeChannel(channel);
    };
  }, [refresh]);

  async function toggleSound() {
    const next = !sound;
    setSound(next);
    writeStorage(SOUND_KEY, next ? "on" : "off");
    if (next) {
      const unlocked = await unlockNotificationAudio();
      if (unlocked) playNotificationTone("preview");
    }
    window.dispatchEvent(
      new CustomEvent("cosmic-sound-setting", { detail: { enabled: next } }),
    );
  }

  return (
    <section className="admin-alerts" aria-label="Central de alertas">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/pedidos?status=pending" className="alert-pill">
          <strong>{counts.proofs}</strong> Comprovantes
        </Link>
        <Link href="/admin/suporte" className="alert-pill">
          <strong>{counts.support}</strong> Suportes abertos
        </Link>
        <Link href="/admin/comunidade" className="alert-pill">
          <strong>{counts.reports}</strong> Denúncias
        </Link>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="admin-small-button"
            aria-label="Atualizar alertas"
          >
            ↻
          </button>
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => void toggleSound()}
            className="admin-small-button"
          >
            {sound ? "Som ligado" : "Ativar som"}
          </button>
        </div>
      </div>
      {newEvent && (
        <p role="status" className="mt-3 text-xs text-violet-200">
          ● {newEvent}.{" "}
          <Link href="/admin" className="underline">
            Ver painel
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          Não foi possível atualizar os indicadores. Tente novamente.
        </p>
      )}
    </section>
  );
}
