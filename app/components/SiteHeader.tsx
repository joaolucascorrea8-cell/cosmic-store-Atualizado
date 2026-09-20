import Image from "next/image";
import Link from "next/link";
import CartButton from "./CartButton";
import AccountMenu from "./AccountMenu";
import { createClient } from "@/lib/supabase/server";

const Nav = ({ admin = false }: { admin?: boolean }) => <>
  <Link href="/">Início</Link>
  <Link href="/produtos">Produtos</Link>
  <Link href="/jogos">Jogos</Link>
  <Link href="/chat">Chat</Link>
  {admin && <Link href="/admin" className="!text-violet-300">Admin</Link>}
</>;

export default async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const nickname = user ? String(profile?.nickname ?? user.user_metadata?.preferred_username ?? user.user_metadata?.user_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Minha conta") : "";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  return <header className="sticky top-0 z-50 border-b border-white/[.07] bg-[#08070b]/80 backdrop-blur-2xl">
    <div className="wide-shell flex h-[72px] items-center justify-between">
      <Link href="/" className="flex items-center gap-3 text-xl font-black tracking-tight">
        <span className="purple-shadow relative h-11 w-11 overflow-hidden rounded-[14px] border border-violet-400/25"><Image src="/images/branding/cosmic-store-logo.png" alt="Cosmic Store" fill sizes="44px" className="object-cover" priority /></span>
        <span className="hidden sm:inline">COSMIC<span className="text-violet-500">.</span></span>
      </Link>
      <nav aria-label="Navegação principal" className="hidden items-center gap-1 rounded-full border border-white/[.07] bg-white/[.025] p-1 text-sm font-semibold text-zinc-400 md:flex [&_a]:rounded-full [&_a]:px-4 [&_a]:py-2 [&_a]:transition [&_a:hover]:bg-white/[.06] [&_a:hover]:text-white"><Nav admin={isAdmin} /></nav>
      <div className="flex items-center gap-2">
        <details className="relative md:hidden">
          <summary aria-label="Abrir menu" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-white/10 bg-white/5"><span aria-hidden="true">☰</span></summary>
          <nav aria-label="Navegação mobile" className="absolute right-0 mt-2 grid w-52 rounded-xl border border-white/10 bg-[#121017] p-2 text-sm font-bold shadow-2xl [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2 [&_a:hover]:bg-white/5">
            <Nav admin={isAdmin} />
            <div className="my-1 border-t border-white/10" />
            {user ? <>
              <Link href="/conta" className="text-violet-300">Minha conta</Link>
              <Link href="/pedidos">Meus pedidos</Link>
              <Link href="/suporte">Suporte</Link>
            </> : <Link href="/login" className="bg-violet-600 text-center text-white hover:bg-violet-500">Entrar na conta</Link>}
          </nav>
        </details>
        {user ? <AccountMenu name={nickname} avatarUrl={avatarUrl} isAdmin={isAdmin} /> : <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-zinc-400 hover:text-white sm:block">Entrar</Link>}
        <CartButton />
      </div>
    </div>
  </header>;
}
