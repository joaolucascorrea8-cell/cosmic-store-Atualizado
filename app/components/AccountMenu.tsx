"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "./Icon";
export default function AccountMenu({
  name,
  avatarUrl,
  isAdmin,
  discordUrl,
}: {
  name: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  discordUrl: string;
}) {
  const router = useRouter(),
    root = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const close = () => {
    if (root.current) root.current.open = false;
  };
  useEffect(() => {
    const pointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("cosmic-mobile-menu-open", close);
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("cosmic-mobile-menu-open", close);
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, []);
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      close();
      router.push("/");
      router.refresh();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      ref={root}
      onToggle={() => {
        if (root.current?.open)
          window.dispatchEvent(new Event("cosmic-account-menu-open"));
      }}
      className="relative"
    >
      <summary
        aria-label={`Menu de ${name}`}
        className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-2.5 py-2 text-sm font-bold"
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-full bg-violet-600 bg-cover bg-center text-xs"
          style={
            avatarUrl
              ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
              : undefined
          }
        >
          {!avatarUrl && name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate sm:block">{name}</span>
        <Icon name="chevron" className="h-3 w-3 rotate-90 text-zinc-400" />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/15 bg-[#16161e] p-2 shadow-2xl">
        <p className="truncate border-b border-white/10 px-3 py-3 text-xs text-zinc-400">
          {name}
        </p>
        {[
          ["/conta", "Meu perfil"],
          ["/pedidos", "Meus pedidos"],
          ["/conta/favoritos", "Favoritos e reposição"],
          ["/suporte", "Suporte"],
          ["/notificacoes", "Notificações"],
          ...(isAdmin ? [["/admin", "Painel administrativo"]] : []),
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={close}
            className="block rounded-lg px-3 py-2.5 text-sm hover:bg-white/5"
          >
            {label}
          </Link>
        ))}
        <a
          href={discordUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg px-3 py-2.5 text-sm text-violet-300"
        >
          Entrar no Discord ↗
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => void signOut()}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-red-300 hover:bg-white/5"
        >
          {busy ? "Saindo…" : "Sair da conta"}
        </button>
        {error && (
          <p role="alert" className="p-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
