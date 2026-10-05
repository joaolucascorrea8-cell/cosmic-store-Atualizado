"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function StoreNav({
  admin,
  discordUrl,
}: {
  admin: boolean;
  discordUrl: string;
}) {
  const path = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="desktop-nav hidden items-center gap-1 text-sm font-semibold text-zinc-400 lg:flex"
    >
      {[
        ["/", "Início"],
        ["/jogos", "Jogos"],
        ["/robux", "Robux"],
        ["/combos", "Combos"],
        ["/servidores", "Servidores"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
      <a
        href={discordUrl}
        target="_blank"
        rel="noreferrer"
        className="text-violet-300"
      >
        Discord ↗
      </a>
      {admin && <Link href="/admin">Admin</Link>}
    </nav>
  );
}
