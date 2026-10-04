"use client";
import { useState } from "react";
export default function ShareProduct({
  name,
  path,
}: {
  name: string;
  path: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        type="button"
        className="text-xs font-bold text-zinc-400 hover:text-violet-300"
        onClick={async () => {
          const url = new URL(path, window.location.origin).href;
          try {
            if (navigator.share)
              await navigator.share({ title: `${name} · Cosmic Store`, url });
            else {
              await navigator.clipboard.writeText(url);
              setMessage("Link copiado.");
            }
          } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError"))
              setMessage("Copie o endereço desta página para compartilhar.");
          }
        }}
      >
        Compartilhar produto ↗
      </button>
      {message && (
        <p role="status" className="mt-1 text-xs text-zinc-400">
          {message}
        </p>
      )}
    </div>
  );
}
