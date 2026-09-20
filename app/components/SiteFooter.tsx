import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/[.08] bg-black/20">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div><Link href="/" className="text-xl font-black">COSMIC<span className="text-violet-500">.</span></Link><p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">Produtos digitais, atendimento acompanhado e uma experiência criada para jogadores.</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-zinc-300">Navegação</p><nav aria-label="Navegação do rodapé" className="mt-4 grid gap-2 text-sm text-zinc-400"><Link href="/produtos" className="hover:text-white">Todos os produtos</Link><Link href="/jogos" className="hover:text-white">Jogos</Link><Link href="/chat" className="hover:text-white">Comunidade</Link></nav></div>
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-zinc-300">Segurança</p><nav aria-label="Políticas da loja" className="mt-4 grid gap-2 text-sm text-zinc-400"><Link href="/termos" className="hover:text-white">Termos de Uso</Link><Link href="/privacidade" className="hover:text-white">Privacidade</Link><Link href="/reembolso" className="hover:text-white">Política de reembolso</Link></nav></div>
      </div>
      <div className="border-t border-white/[.06]"><div className="shell flex flex-col justify-between gap-2 py-5 text-xs text-zinc-400 sm:flex-row"><p>© 2026 Cosmic Store. Todos os direitos reservados.</p><p>Entrega estimada em até 24 horas após a confirmação.</p></div></div>
    </footer>
  );
}
