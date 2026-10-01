"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="conteudo-principal" tabIndex={-1} className="page-state">
      <div className="page-state-card">
        <p className="eyebrow">Algo saiu da órbita</p>
        <h1 className="mt-3 text-3xl font-black">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-3 text-zinc-400">
          Tente novamente. Se continuar, fale com o suporte.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 min-h-11 rounded-xl bg-violet-600 px-6 font-bold hover:bg-violet-500"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
