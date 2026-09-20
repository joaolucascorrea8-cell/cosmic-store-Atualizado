const BUCKET_NAME = "product-images";

export const PRODUCT_IMAGE_BUCKET = BUCKET_NAME;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedProductImageUrl(value: string) {
  if (value === "") return true;

  if (
    /^\/images\/products\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(
      value
    )
  ) {
    return true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!supabaseUrl) return false;

  const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/`;

  return value.startsWith(prefix) && !value.slice(prefix.length).includes("/");
}

export function getManagedProductImagePath(value: string | null) {
  if (!value) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!supabaseUrl) return null;

  const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/`;

  if (!value.startsWith(prefix)) return null;

  const path = value.slice(prefix.length);

  return path && !path.includes("/") ? path : null;
}
