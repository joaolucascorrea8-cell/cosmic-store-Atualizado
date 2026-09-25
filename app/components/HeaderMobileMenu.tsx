"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function HeaderMobileMenu({
  loggedIn,
  discordUrl,
}: {
  loggedIn: boolean;
  discordUrl: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeWhenAccountOpens = () => {
      if (detailsRef.current) detailsRef.current.open = false;
    };

    window.addEventListener("cosmic-account-menu-open", closeWhenAccountOpens);
    return () => window.removeEventListener("cosmic-account-menu-open", closeWhenAccountOpens);
  }, []);

  function handleToggle() {
    if (detailsRef.current?.open) {
      window.dispatchEvent(new Event("cosmic-mobile-menu-open"));
    }
  }

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  const linkClass = "rounded-lg p-3 transition hover:bg-white/10";

  return <details ref={detailsRef} onToggle={handleToggle} className="mobile-menu relative lg:hidden">
    <summary aria-label="Abrir menu de navegação" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-white/10 text-lg text-white">☰</summary>
    <nav aria-label="Navegação mobile" className="absolute right-0 top-12 grid w-[min(18rem,calc(100vw-2rem))] gap-1 rounded-2xl border border-white/15 bg-[#17131f] p-3 text-sm font-bold shadow-2xl">
      <Link href="/" onClick={closeMenu} className={linkClass}>Início</Link>
      <Link href="/jogos" onClick={closeMenu} className={linkClass}>Jogos</Link>
      <Link href="/combos" onClick={closeMenu} className={linkClass}>Combos</Link>
      <Link href="/suporte" onClick={closeMenu} className={linkClass}>Suporte</Link>
      <a href={discordUrl} target="_blank" rel="noreferrer" onClick={closeMenu} className={`${linkClass} text-[#b9a8ff]`}>Discord ↗</a>

      {!loggedIn && <>
        <div className="my-1 border-t border-white/10" />
        <Link href="/login" onClick={closeMenu} className="rounded-lg bg-violet-600 p-3 text-center text-white hover:bg-violet-500">Entrar na conta</Link>
      </>}
    </nav>
  </details>;
}
