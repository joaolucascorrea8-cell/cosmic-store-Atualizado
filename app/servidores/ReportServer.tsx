"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function ReportServer({ serverId }: { serverId: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <details className="mt-3 text-xs text-zinc-400">
      <summary className="cursor-pointer text-center hover:text-white">
        Reportar problema
      </summary>
      {sent ? (
        <p role="status" className="mt-3 text-emerald-300">
          Aviso recebido. A equipe vai conferir este servidor.
        </p>
      ) : (
        <form
          ref={form}
          data-live-busy={busy}
          className="mt-3 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            const values = new FormData(event.currentTarget);
            const client = createClient();
            try {
              const {
                data: { user },
              } = await client.auth.getUser();
              if (!user) {
                router.push("/login?next=/servidores");
                return;
              }
              const { error: failure } = await client.rpc(
                "report_game_server",
                {
                  p_server_id: serverId,
                  p_reason: values.get("reason"),
                  p_details: String(values.get("details") ?? "").trim(),
                },
              );
              if (failure)
                setError(
                  failure.code === "P0001"
                    ? failure.message
                    : "Não foi possível enviar. Tente novamente.",
                );
              else {
                setSent(true);
                form.current?.reset();
              }
            } catch {
              setError("Confira sua conexão e tente novamente.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            O que aconteceu?
            <select name="reason" className="admin-input mt-1">
              <option value="invalid_link">Link inválido</option>
              <option value="cannot_join">Não consigo entrar</option>
              <option value="other">Outro problema</option>
            </select>
          </label>
          <label className="block">
            Detalhes (opcional)
            <textarea
              name="details"
              rows={2}
              maxLength={600}
              className="admin-input mt-1"
            />
          </label>
          <button disabled={busy} className="btn-secondary w-full">
            {busy ? "Enviando…" : "Avisar equipe"}
          </button>
          {error && (
            <p role="alert" className="text-red-300">
              {error}
            </p>
          )}
        </form>
      )}
    </details>
  );
}
