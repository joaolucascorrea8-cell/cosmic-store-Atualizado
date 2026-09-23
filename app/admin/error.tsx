"use client";
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="admin-panel mx-auto mt-8 max-w-xl"><h1 className="text-xl font-bold">Não foi possível concluir a operação</h1><p className="mt-3 text-sm leading-6 text-zinc-400">{error.message || "Confira os dados e tente novamente."}</p><button type="button" onClick={reset} className="btn-primary mt-5">Tentar novamente</button></div>;
}
