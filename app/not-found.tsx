import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-state">
      <div className="page-state-card">
        <p className="eyebrow">Erro 404</p>
        <h1 className="mt-3 text-3xl font-black">Página não encontrada</h1>
        <p className="mt-3 text-zinc-400">O endereço pode estar incorreto ou o conteúdo não existe mais.</p>
        <Link href="/" className="mt-6 inline-grid min-h-11 place-items-center rounded-xl bg-violet-600 px-6 font-bold hover:bg-violet-500">Voltar ao início</Link>
      </div>
    </main>
  );
}
