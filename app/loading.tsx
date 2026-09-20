export default function Loading() {
  return (
    <main className="page-state" aria-busy="true" aria-live="polite">
      <div className="page-state-card">
        <span aria-hidden="true" className="mx-auto grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-violet-600 text-2xl">✦</span>
        <p className="mt-5 font-bold">Carregando a Cosmic Store...</p>
      </div>
    </main>
  );
}
