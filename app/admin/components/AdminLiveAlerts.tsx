"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Counts = { proofs: number; support: number; reports: number };
export default function AdminLiveAlerts({ initial }: { initial: Counts }) {
  const [counts, setCounts] = useState(initial);
  const [sound, setSound] = useState(false);
  const [newEvent, setNewEvent] = useState("");
  const [error, setError] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const soundEnabled = useRef(false);
  const refresh = useCallback(async () => {
    const client = createClient();
    const [orders, support, reports] = await Promise.all([
      client.from("orders").select("id", { count: "exact", head: true }).in("status", ["proof_submitted", "under_review"]),
      client.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      client.from("message_reports").select("id", { count: "exact", head: true }).is("resolved_at", null),
    ]);
    if (orders.error || support.error || reports.error) {setError(true); return;}
    setCounts({ proofs: orders.count ?? 0, support: support.count ?? 0, reports: reports.count ?? 0 });setError(false);
  }, []);
  useEffect(() => {
    const client = createClient();
    const channel = client.channel("admin-live-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {void refresh(); if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && ["proof_submitted", "under_review"].includes(String((payload.new as { status?: string }).status)))) notify("Novo movimento em pedidos");})
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {void refresh();notify("Suporte atualizado");})
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => notify("Nova mensagem no suporte"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, () => notify("Nova mensagem de pedido"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reports" }, () => {void refresh();notify("Nova denúncia na comunidade");})
      .subscribe();
    const interval = window.setInterval(() => {void refresh();}, 30000);
    function notify(label: string) {
      setNewEvent(label);
      if (soundEnabled.current && audioContext.current) {
        try {const ctx = audioContext.current;const oscillator = ctx.createOscillator();const gain = ctx.createGain();oscillator.type = "sine";oscillator.frequency.value = 780;gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.1,ctx.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.22);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.23);} catch { /* Som é opcional. */ }
      }
    }
    return () => {window.clearInterval(interval);void client.removeChannel(channel);};
  }, [refresh]);
  async function toggleSound() {
    if (soundEnabled.current) {soundEnabled.current=false;setSound(false);return;}
    try { audioContext.current ??= new AudioContext();await audioContext.current.resume();soundEnabled.current=true;setSound(true); } catch {setSound(false);}
  }
  return <section className="admin-alerts" aria-label="Central de alertas"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-violet-300">Central de atenção</p><p className="mt-1 text-xs text-zinc-500">Atualiza automaticamente; confira os itens pendentes.</p></div><div className="flex gap-2"><button type="button" onClick={() => void refresh()} className="admin-small-button" aria-label="Atualizar alertas">↻ Atualizar</button><button type="button" onClick={() => void toggleSound()} aria-pressed={sound} className="admin-small-button">{sound ? "♫ Som ligado" : "♫ Ativar som"}</button></div></div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"><Link href="/admin/pedidos?status=pending" className="admin-alert-tile"><strong className="text-2xl text-amber-300">{counts.proofs}</strong><span>Comprovantes para análise ↗</span></Link><Link href="/admin/suporte" className="admin-alert-tile"><strong className="text-2xl text-sky-300">{counts.support}</strong><span>Atendimentos abertos ↗</span></Link><Link href="/admin/comunidade" className="admin-alert-tile"><strong className="text-2xl text-violet-300">{counts.reports}</strong><span>Denúncias pendentes ↗</span></Link></div>{newEvent && <p role="status" className="mt-3 text-xs text-violet-200">● {newEvent}. <Link href="/admin" className="underline">Ver painel</Link></p>}{error && <p role="alert" className="mt-3 text-xs text-red-300">Não foi possível atualizar os indicadores. Tente novamente.</p>}</section>;
}
