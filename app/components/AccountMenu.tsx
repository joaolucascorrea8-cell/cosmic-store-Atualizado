"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountMenu({ name, avatarUrl, isAdmin, discordUrl }: { name: string; avatarUrl?: string | null; isAdmin: boolean; discordUrl: string }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return <details className="group relative">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold hover:bg-white/10">
      {avatarUrl ? <span className="h-6 w-6 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(avatarUrl).slice(1, -1)})` }} /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-xs">{name.charAt(0).toUpperCase()}</span>}
      <span className="hidden max-w-32 truncate sm:block">{name}</span><span className="text-zinc-500">⌄</span>
    </summary>
    <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#121017] p-2 shadow-2xl">
      <div className="border-b border-white/10 px-3 py-2 text-xs text-zinc-500">Conta conectada</div>
      <Link href="/conta" className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/5">Meu perfil</Link>
      <Link href="/pedidos" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/5">Meus pedidos</Link>
      <Link href="/suporte" className="block rounded-lg px-3 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/10">Suporte e atendimento</Link>
      <Link href="/notificacoes" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/5">Notificações</Link>
      <a href={discordUrl} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#b9c0ff] hover:bg-[#5865F2]/10">Entrar no Discord ↗</a>
      {isAdmin && <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/5">Painel administrativo</Link>}
      <button onClick={signOut} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-300 hover:bg-red-500/10">Sair da conta</button>
    </div>
  </details>;
}
