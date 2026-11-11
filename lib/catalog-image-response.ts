import sharp from "sharp";
import { CATALOG_IMAGE_WIDTHS } from "./catalog-image-url";

// No URL input: only a public file inside the configured product-images bucket.
export async function catalogImageResponse(request: Request, root: string | undefined, fetcher: typeof fetch = fetch) {
  const url = new URL(request.url), file = url.searchParams.get("file") ?? "";
  const width = Number(url.searchParams.get("w"));
  if (!root || !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(file) || !CATALOG_IMAGE_WIDTHS.includes(width))
    return new Response("Imagem inválida", { status: 400 });
  const maxBytes = 5 * 1024 * 1024;
  try {
    const source = new URL(`/storage/v1/object/public/product-images/${file}`, root);
    const upstream = await fetcher(source, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!upstream.ok || !upstream.body) return new Response("Imagem indisponível", { status: upstream.status === 404 ? 404 : 502 });
    if (Number(upstream.headers.get("content-length")) > maxBytes) {
      await upstream.body.cancel();
      return new Response("Imagem muito grande", { status: 413 });
    }
    const reader = upstream.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return new Response("Imagem muito grande", { status: 413 }); }
      chunks.push(value);
    }
    const input = Buffer.concat(chunks);
    const raster = (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) ||
      input.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
      (input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP");
    if (!raster) return new Response("Formato inválido", { status: 415 });
    const metadata = await sharp(input, { limitInputPixels: 20000000 }).metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) return new Response("Formato inválido", { status: 415 });
    const output = await sharp(input, { limitInputPixels: 20000000 }).rotate()
      .resize({ width, withoutEnlargement: true }).webp({ lossless: true, effort: 3 }).toBuffer();
    return new Response(new Uint8Array(output), { headers: {
      "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    } });
  } catch { return new Response("Imagem indisponível", { status: 502 }); }
}
