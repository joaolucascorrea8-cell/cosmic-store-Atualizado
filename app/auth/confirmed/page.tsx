"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeInternalPath } from "@/lib/safe-redirect";

export default function AuthConfirmedPage() {
  const router = useRouter();
  const [next, setNext] = useState("/conta");

  useEffect(() => {
    const target = safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/conta");
    setNext(target);
    const timer = window.setTimeout(() => {
      router.replace(target);
      router.refresh();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080812] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-emerald-400/20 bg-[#111122] p-8 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-400/10 text-3xl">✓</div>
        <h1 className="mt-5 text-3xl font-black">E-mail confirmado!</h1>
        <p className="mt-3 leading-6 text-zinc-400">Sua conta está pronta e sua sessão já foi criada. Entrando na Cosmic Store...</p>
        <div className="mx-auto mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/5"><div className="h-full w-full origin-left animate-pulse rounded-full bg-emerald-400" /></div>
        <Link href={next} className="mt-6 block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-white/10">
          Continuar agora
        </Link>
      </div>
    </main>
  );
}
