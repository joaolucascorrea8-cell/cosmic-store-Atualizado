"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProductPreferences } from "@/app/context/ProductPreferences";
import Icon from "./Icon";
export default function ProductPreferenceButton({
  id,
  kind = "favorite",
  compact = false,
}: {
  id: string;
  kind?: "favorite" | "restock";
  compact?: boolean;
}) {
  const { userId, loaded, values, change } = useProductPreferences();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const enabled = values[id]?.[kind] ?? false;
  const label =
    kind === "favorite"
      ? enabled
        ? "Remover dos favoritos"
        : "Salvar nos favoritos"
      : enabled
        ? "Cancelar aviso de reposição"
        : "Avise quando voltar";
  return (
    <div className={compact ? "relative" : "mt-3"}>
      <button
        type="button"
        disabled={!loaded || pending}
        aria-label={label}
        aria-pressed={enabled}
        title={label}
        className={
          compact
            ? `grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-[#17121f]/95 ${enabled ? "text-violet-300" : "text-zinc-400"}`
            : "btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-50"
        }
        onClick={async () => {
          if (!userId) {
            router.push(
              `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
            );
            return;
          }
          setPending(true);
          setError("");
          try {
            const message = await change(id, kind, !enabled);
            if (message) setError(message);
            else if (window.location.pathname === "/conta/favoritos")
              router.refresh();
          } catch {
            setError("Não foi possível salvar. Confira sua conexão.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Icon
          name={kind === "favorite" ? "heart" : "bell"}
          className={`h-4 w-4 ${enabled ? "fill-violet-400/20" : ""}`}
        />
        {!compact && (pending ? "Salvando…" : label)}
      </button>
      {error && (
        <p
          role="alert"
          className={
            compact
              ? "absolute right-0 top-11 z-10 w-44 rounded-lg bg-[#251628] p-3 text-xs text-red-200 shadow-xl"
              : "mt-2 text-xs text-red-300"
          }
        >
          {error}
        </p>
      )}
      {!compact && kind === "restock" && (
        <p className="mt-2 text-xs text-zinc-500">
          Aviso nas notificações da sua conta. Não reserva o item.
        </p>
      )}
    </div>
  );
}
