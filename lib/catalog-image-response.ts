import sharp from "sharp";
import { createHash } from "node:crypto";
import { CATALOG_IMAGE_WIDTHS } from "./catalog-image-url";

// No URL input: only a public file inside the configured product-images bucket.
async function renderCatalogImage(request: Request, root: string | undefined, fetcher: typeof fetch) {
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

type ImageResult = { body: Uint8Array; status: number; headers: Headers; expires: number };

// Só imagens públicas: não guarda sessões, URLs assinadas, preços ou estoque.
// O cache local é menor que o prazo HTTP existente e não depende de persistência na Vercel.
export function createCatalogImageResponder({ now = Date.now, ttlMs = 60_000, maxBytes = 16 * 1024 * 1024, maxEntries = 64 } = {}) {
  const completed = new Map<string, ImageResult>();
  const pending = new Map<string, Promise<ImageResult>>();
  let bytes = 0;
  function remove(key: string) {
    const entry = completed.get(key);
    if (entry) bytes -= entry.body.byteLength;
    completed.delete(key);
  }
  function remember(key: string, result: ImageResult) {
    for (const [oldKey, entry] of completed) if (entry.expires <= now()) remove(oldKey);
    if (result.status !== 200 || result.body.byteLength > maxBytes) return;
    remove(key);
    while (completed.size && (completed.size >= maxEntries || bytes + result.body.byteLength > maxBytes)) remove(completed.keys().next().value!);
    completed.set(key, result);
    bytes += result.body.byteLength;
  }
  return async function respond(request: Request, root: string | undefined, fetcher: typeof fetch = fetch) {
    const url = new URL(request.url), file = url.searchParams.get("file") ?? "", width = Number(url.searchParams.get("w"));
    // A validação também precede qualquer consulta ao cache.
    if (!root || !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(file) || !CATALOG_IMAGE_WIDTHS.includes(width)) return new Response("Imagem inválida", { status: 400 });
    const key = JSON.stringify([root, file, width]);
    let result = completed.get(key);
    if (result && result.expires <= now()) { remove(key); result = undefined; }
    if (result) { completed.delete(key); completed.set(key, result); }
    else {
      let work = pending.get(key);
      if (!work) {
        work = (async () => {
          const response = await renderCatalogImage(request, root, fetcher);
          const body = new Uint8Array(await response.arrayBuffer());
          const headers = new Headers(response.headers);
          if (response.status === 200) headers.set("ETag", `"${createHash("sha256").update(body).digest("hex")}"`);
          const rendered = { body, status: response.status, headers, expires: now() + ttlMs };
          remember(key, rendered);
          return rendered;
        })().finally(() => { if (pending.get(key) === work) pending.delete(key); });
        if (pending.size < 16) pending.set(key, work);
      }
      result = await work;
    }
    const tag = result.headers.get("etag");
    const matches = request.headers.get("if-none-match")?.split(",").some(value => [tag, `W/${tag}`, "*"].includes(value.trim()));
    if (result.status === 200 && tag && matches) return new Response(null, { status: 304, headers: result.headers });
    return new Response(new Uint8Array(result.body), { status: result.status, headers: result.headers });
  };
}

export const catalogImageResponse = createCatalogImageResponder();
