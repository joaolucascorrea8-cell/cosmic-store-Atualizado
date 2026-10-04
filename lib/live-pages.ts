export type LivePageConfig = {
  scopes: string[];
  tables: string[];
  pollMs: number;
};
const catalog = { scopes: ["catalog", "reviews"], tables: [], pollMs: 30000 };
export function livePageConfig(pathname: string): LivePageConfig | null {
  if (pathname === "/conta/favoritos")
    return {
      scopes: ["catalog"],
      tables: ["customer_product_preferences"],
      pollMs: 15000,
    };
  if (["/admin/relatorios", "/admin/historico", "/admin/diagnostico"].includes(pathname)) return {scopes:["admin", "catalog"],tables:[],pollMs:30000};
  if (pathname === "/admin/cupons" || pathname === "/admin/atendimento")
    return { scopes: ["admin", "catalog"], tables: [], pollMs: 15000 };
  if (pathname === "/servidores")
    return { scopes: ["servers"], tables: [], pollMs: 30000 };
  if (pathname === "/admin/servidores")
    return { scopes: ["servers", "admin"], tables: [], pollMs: 15000 };
  if (
    pathname === "/admin" ||
    pathname === "/admin/pedidos" ||
    /^\/admin\/pedidos\/[^/]+$/.test(pathname) ||
    pathname === "/admin/suporte" ||
    /^\/admin\/suporte\/[^/]+$/.test(pathname)
  )
    return { scopes: ["admin", "catalog"], tables: [], pollMs: 15000 };
  if (
    pathname === "/admin/produtos" ||
    pathname === "/admin/catalogo" ||
    pathname === "/admin/combos"
  )
    return catalog;
  if (pathname === "/admin/avaliacoes")
    return { scopes: ["reviews"], tables: [], pollMs: 15000 };
  if (pathname === "/admin/comunidade")
    return {
      scopes: ["admin"],
      tables: ["global_messages", "chat_bans", "chat_mutes"],
      pollMs: 15000,
    };
  if (pathname === "/pedidos")
    return { scopes: [], tables: ["orders", "notifications"], pollMs: 15000 };
  if (pathname === "/suporte" || /^\/suporte\/[^/]+$/.test(pathname))
    return {
      scopes: [],
      tables: ["support_tickets", "notifications"],
      pollMs: 15000,
    };
  // OrderStatusWatcher and NotificationList already own these subscriptions.
  if (/^\/pedidos\/[^/]+$/.test(pathname) || pathname === "/notificacoes")
    return null;
  if (
    pathname === "/" ||
    pathname === "/jogos" ||
    pathname === "/produtos" ||
    pathname === "/combos" ||
    /^\/produto\/[^/]+$/.test(pathname) ||
    /^\/combo\/[^/]+$/.test(pathname)
  )
    return catalog;
  if (pathname === "/avaliacoes")
    return { scopes: ["reviews"], tables: [], pollMs: 30000 };
  const first = pathname.split("/")[1];
  // Dynamic game/category pages; exclude account, checkout, auth and legal routes.
  const fixed = [
    "admin",
    "api",
    "auth",
    "login",
    "forgot-password",
    "reset-password",
    "conta",
    "carrinho",
    "checkout",
    "chat",
    "ajuda",
    "privacidade",
    "termos",
    "reembolso",
    "servidores",
  ];
  return first && !fixed.includes(first) && !first.includes(".")
    ? catalog
    : null;
}
