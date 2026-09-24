import Image from "next/image";
import Link from "next/link";
import CartButton from "./CartButton";
import AccountMenu from "./AccountMenu";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_DISCORD_INVITE = "https://discord.gg/qQkQzKng3";

const Nav = ({ admin = false, discordUrl }: { admin?: boolean; discordUrl: string }) => <>
  <Link href="/">Início</Link>
  <Link href="/produtos">Produtos</Link>
  <Link href="/jogos">Jogos</Link>
  <Link href="/suporte">Suporte</Link>
  <a href={discordUrl} target="_blank" rel="noreferrer" className="!text-[#b9a8ff]">Discord ↗</a>
  {admin && <Link href="/admin" className="!text-violet-300">Painel admin</Link>}
</>;

export default async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const discordUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() || DEFAULT_DISCORD_INVITE;
  let isAdmin = false;
  let profile: { nickname: string; avatar_url: string | null } | null = null;
  if (user) {
    const [{ data: admin }, { data: userProfile }] = await Promise.all([
      supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("nickname,avatar_url").eq("id", user.id).maybeSingle(),
    ]);
    isAdmin = Boolean(admin && ["owner", "admin"].includes(admin.role));
    profile = userProfile;
  }
  const nickname = user ? String(profile?.nickname ?? user.user_metadata?.preferred_username ?? user.user_metadata?.user_name ?? user.email?.split("@")[0] ?? "Minha conta") : "";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  return <header className="site-header sticky top-0 z-50 border-b border-white/[.08] bg-[#090811]/95 backdrop-blur-xl">
    <div className="shell flex h-[68px] items-center justify-between gap-3">
      <Link href="/" aria-label="Cosmic Store - início" className="flex shrink-0 items-center gap-2.5">
        <span className="relative h-10 w-10 overflow-hidden rounded-xl border border-violet-500/25"><Image src="/images/branding/cosmic-store-logo.png" alt="" fill sizes="40px" className="object-cover" priority /></span>
        <span className="hidden text-lg font-black tracking-[-.05em] min-[390px]:inline">COSMIC<span className="text-violet-400">.</span></span>
      </Link>
      <nav aria-label="Navegação principal" className="desktop-nav hidden items-center gap-1 text-sm font-semibold text-zinc-400 lg:flex"><Nav admin={isAdmin} discordUrl={discordUrl}/></nav>
      <div className="flex items-center gap-2">
        <a href={discordUrl} target="_blank" rel="noreferrer" aria-label="Entrar no Discord da Cosmic Store" className="hidden rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 px-3 py-2 text-sm font-bold text-[#c8ceff] transition hover:border-[#5865F2]/60 hover:bg-[#5865F2]/20 md:block lg:hidden">Discord</a>
        <Link href="/produtos" aria-label="Ver catálogo" className="hidden rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 transition hover:border-violet-500/50 hover:text-white md:block lg:hidden">Catálogo</Link>
        {user ? <AccountMenu name={nickname} avatarUrl={avatarUrl} isAdmin={isAdmin} discordUrl={discordUrl} /> : <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white sm:block">Entrar</Link>}
        <CartButton />
        <details className="mobile-menu relative lg:hidden">
          <summary aria-label="Abrir menu de navegação" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-white/10 text-lg text-white">☰</summary>
          <nav aria-label="Navegação mobile" className="absolute right-0 top-12 grid w-[min(18rem,calc(100vw-2rem))] gap-1 rounded-2xl border border-white/15 bg-[#17131f] p-3 text-sm font-bold shadow-2xl [&_a]:rounded-lg [&_a]:p-3 [&_a:hover]:bg-white/10">
            <Nav admin={isAdmin} discordUrl={discordUrl}/>
            <div className="my-1 border-t border-white/10" />
            {user ? <><Link href="/conta">Minha conta</Link><Link href="/pedidos">Meus pedidos</Link><Link href="/notificacoes">Notificações</Link><Link href="/chat">Comunidade</Link></> : <Link href="/login" className="bg-violet-600 text-center">Entrar na conta</Link>}
          </nav>
        </details>
      </div>
    </div>
  </header>;
}
