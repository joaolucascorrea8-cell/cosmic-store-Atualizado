export const CATALOG_IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];
export function catalogImagePath(src: string, root: string | undefined) {
  if (!root) return null;
  const prefix = `${root.replace(/\/$/, "")}/storage/v1/object/public/product-images/`;
  if (!src.startsWith(prefix)) return null;
  const file = src.slice(prefix.length);
  return /^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(file) ? file : null;
}
