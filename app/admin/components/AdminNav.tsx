"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [
  { href: "/admin", label: "Visão geral", icon: "◫" },
  { href: "/admin/pedidos", label: "Pedidos e Pix", icon: "▤" },
  { href: "/admin/produtos", label: "Produtos", icon: "◈" },
  { href: "/admin/catalogo", label: "Jogos e categorias", icon: "▦" },
  { href: "/admin/suporte", label: "Suporte", icon: "◎" },
  { href: "/admin/comunidade", label: "Comunidade", icon: "♧" },
];
export default function AdminNav() {
  const pathname = usePathname();
  return <nav aria-label="Seções do painel" className="admin-nav">{items.map((item) => {const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "admin-nav-active" : ""}><span className="text-lg" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>;})}</nav>;
}
