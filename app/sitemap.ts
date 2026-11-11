import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { allRows } from "@/lib/query-pages";
import { catalogSitemapPaths, storeOrigin } from "@/lib/store-seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Anonymous public reads only: never include admin/session-visible products.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const [games, categories, products] = await Promise.all([
    allRows(client.from("games").select("id,slug").eq("is_active", true).order("id")),
    allRows(client.from("categories").select("id,slug,game_id").order("id")),
    allRows(client.from("products").select("slug,category_id").eq("is_active", true).order("id")),
  ]);
  if (games.error || categories.error || products.error) throw new Error("Sitemap temporariamente indisponível");
  const paths = catalogSitemapPaths(games.data ?? [], categories.data ?? [], products.data ?? []);
  if (paths.length > 50000) throw new Error("O catálogo exige sitemap dividido");
  return paths.map(path => ({ url: `${storeOrigin()}${path}`, changeFrequency: path.startsWith("/produto/") ? "weekly" : "daily" }));
}
