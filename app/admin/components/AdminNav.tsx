"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon, { type IconName } from "@/app/components/Icon";
const items: [string, string, IconName][] = [
  ["/admin", "Visão geral", "layout"],
  ["/admin/pedidos", "Pedidos e Pix", "package"],
  ["/admin/produtos", "Produtos", "tag"],
  ["/admin/combos", "Combos", "grid"],
  ["/admin/catalogo", "Jogos e categorias", "gamepad"],
  ["/admin/servidores", "Servidores", "gamepad"],
  ["/admin/suporte", "Suporte", "chat"],
  ["/admin/atendimento", "Atendimento e entrega", "clock"],
  ["/admin/cupons", "Cupons", "tag"],
  ["/admin/comunidade", "Comunidade", "user"],
  ["/admin/avaliacoes", "Avaliações", "star"],
];
export default function AdminNav() {
  const path = usePathname(),
    nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = nav.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (
      active &&
      nav.current &&
      nav.current.scrollWidth > nav.current.clientWidth
    )
      nav.current.scrollTo({
        left: Math.max(0, active.offsetLeft - nav.current.offsetLeft - 20),
        behavior: "instant",
      });
  }, [path]);
  return (
    <nav ref={nav} aria-label="Seções do painel" className="admin-nav">
      {items.map(([href, label, icon]) => {
        const active =
          href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={active ? "admin-nav-active" : ""}
          >
            <Icon name={icon} className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
