import { matchesProductName } from "./catalog";

// Routes describe existing services; catalog names, images and prices stay in Supabase.
export const storeServices = [
  {
    href: "/robux",
    name: "Robux",
    description: "Compra via GamePass",
    keywords: "robux gamepass compra rapida saldo",
    icon: "coins",
  },
  {
    href: "/robux/contas",
    name: "Contas com Robux",
    description: "Contas prontas com saldo",
    keywords: "contas conta robux saldo",
    icon: "user",
  },
  {
    href: "/servidores",
    name: "Servidores",
    description: "Encontre seu servidor VIP",
    keywords: "servidores servidor privado vip",
    icon: "gamepad",
  },
] as const;

export function matchesCatalogSearch(
  query: string,
  ...names: (string | null | undefined)[]
) {
  return matchesProductName(names.filter(Boolean).join(" "), query);
}

export function matchingServices(query: string) {
  return query.trim()
    ? storeServices.filter((service) =>
        matchesCatalogSearch(query, service.name, service.keywords),
      )
    : [];
}
