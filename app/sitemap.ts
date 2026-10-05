import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://cosmic-store-blush.vercel.app";
  return [
    "",
    "/produtos",
    "/combos",
    "/jogos",
    "/robux",
    "/servidores",
    "/avaliacoes",
    "/ajuda",
    "/termos",
    "/privacidade",
    "/reembolso",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/produtos" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/produtos" ? 0.9 : 0.6,
  }));
}
