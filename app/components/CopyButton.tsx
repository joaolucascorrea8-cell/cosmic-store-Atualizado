"use client";
import { useState } from "react";
import Icon from "./Icon";
export default function CopyButton({
  value,
  label = "Copiar",
  className = "admin-small-button",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setStatus("Copiado!");
        } catch {
          setStatus("Não foi possível copiar. Selecione o texto.");
        }
      }}
    >
      <Icon name="copy" className="mr-2 h-4 w-4" />
      <span aria-live="polite">{status || label}</span>
    </button>
  );
}
