import { slugify } from "./catalog";

// Keep existing global URLs and UUID relationships. Never regenerate saved slugs.
export function automaticProductSlug(game: string, name: string, max = 100) {
  const prefix = (slugify(game) || "jogo").slice(0, 50).replace(/-+$/, "");
  const product = slugify(name) || "produto";
  return `${prefix}-${product}`.slice(0, max).replace(/-+$/, "");
}

type SlugError = { code?: string; message?: string; details?: string };
export function isProductSlugConflict(error: SlugError | null) {
  return error?.code === "23505" &&
    (/Key \(slug\)=/.test(error.details ?? "") ||
      /products_slug_key/.test(error.message ?? ""));
}

// The database UNIQUE constraint arbitrates concurrent requests; no preflight race.
// Retry only slug conflicts, never unrelated constraints or connection failures.
export async function persistWithUniqueSlug<T extends { error: SlugError | null }>(
  base: string,
  persist: (slug: string) => PromiseLike<T>,
  automatic = true,
) {
  let slug = base;
  for (let attempt = 0; ; attempt++) {
    const result = await persist(slug);
    if (!automatic || !isProductSlugConflict(result.error) || attempt >= 7)
      return { result, slug };
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    slug = `${base.slice(0, 87).replace(/-+$/, "")}-${suffix}`;
  }
}
