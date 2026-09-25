"use client";

import { useState } from "react";

type Progress = { scanned: number; eligible: number; withImage: number; imported: number; skipped: number; images: number };
const empty: Progress = { scanned: 0, eligible: 0, withImage: 0, imported: 0, skipped: 0, images: 0 };

async function callBatch(mode: "scan" | "import", before: string | null) {
  const response = await fetch("/api/admin/reviews/discord", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, before }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Falha ao acessar o Discord.");
  return data as { scanned:number; eligible:number; withImage?:number; imported?:number; skipped?:number; images?:number; errors?:string[]; nextBefore:string|null; hasMore:boolean };
}

export default function DiscordReviewImporter({ enabled, channelId }: { enabled: boolean; channelId: string | null }) {
  const [busy, setBusy] = useState<"scan" | "import" | null>(null);
  const [progress, setProgress] = useState(empty);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [scanReady, setScanReady] = useState(false);

  async function run(mode: "scan" | "import") {
    setBusy(mode); setMessage(""); setErrors([]); setProgress(empty);
    let before: string | null = null;
    let totals = { ...empty };
    try {
      do {
        const result = await callBatch(mode, before);
        totals = {
          scanned: totals.scanned + result.scanned,
          eligible: totals.eligible + result.eligible,
          withImage: totals.withImage + (result.withImage ?? 0),
          imported: totals.imported + (result.imported ?? 0),
          skipped: totals.skipped + (result.skipped ?? 0),
          images: totals.images + (result.images ?? 0),
        };
        setProgress({ ...totals });
        if (result.errors?.length) setErrors(prev => [...prev, ...result.errors!].slice(0, 12));
        before = result.hasMore ? result.nextBefore : null;
        if (!result.hasMore) break;
      } while (before);
      if (mode === "scan") {
        setScanReady(true);
        setMessage(`Análise concluída: ${totals.eligible} avaliações encontradas.`);
      } else {
        setScanReady(false);
        setMessage(`Importação concluída: ${totals.imported} novas avaliações, ${totals.skipped} já existentes/ignoradas.`);
        window.setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    } finally { setBusy(null); }
  }

  if (!enabled) return <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100"><strong>Importador bloqueado.</strong><p className="mt-1 text-amber-100/70">Para usar, defina <code>DISCORD_REVIEWS_IMPORT_ENABLED=true</code> e faça um novo deploy. Depois da migração, volte para <code>false</code>.</p></div>;

  return <div className="space-y-4">
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><span className="text-zinc-500">Canal configurado</span><strong className="mt-1 block">{channelId || "Não configurado"}</strong></div>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => run("scan")} className="admin-small-button">{busy === "scan" ? "Analisando..." : "Analisar canal"}</button><button type="button" disabled={Boolean(busy) || !scanReady} onClick={() => run("import")} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40">{busy === "import" ? "Importando..." : "Importar avaliações"}</button></div>
    {(busy || progress.scanned > 0) && <div className="grid gap-2 text-xs sm:grid-cols-3"><div className="rounded-lg bg-white/[.04] p-3"><span className="text-zinc-500">Mensagens lidas</span><strong className="mt-1 block text-base">{progress.scanned}</strong></div><div className="rounded-lg bg-white/[.04] p-3"><span className="text-zinc-500">Avaliações</span><strong className="mt-1 block text-base">{progress.eligible}</strong></div><div className="rounded-lg bg-white/[.04] p-3"><span className="text-zinc-500">Imagens salvas</span><strong className="mt-1 block text-base">{progress.images || progress.withImage}</strong></div></div>}
    {message && <p className="rounded-lg border border-white/10 bg-white/[.03] p-3 text-sm text-zinc-300">{message}</p>}
    {errors.length > 0 && <details className="rounded-xl border border-amber-500/20 p-4 text-xs text-amber-100"><summary className="cursor-pointer font-bold">Ver avisos da importação ({errors.length})</summary><ul className="mt-3 space-y-1">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></details>}
  </div>;
}
