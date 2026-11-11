import { createClient } from "@/lib/supabase/server";
import { readProductContexts } from "@/lib/product-context-server";
import { UUID_PATTERN } from "@/lib/catalog";
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids")?.split(",") ?? [];
  if (!ids.length || ids.length > 40 || ids.some(id => !UUID_PATTERN.test(id)))
    return Response.json({ error: "Produtos inválidos." }, { status: 400 });
  const result = await readProductContexts(await createClient(), ids);
  return Response.json(result.error ? { error: "Não foi possível confirmar jogo e categoria." } : { contexts: result.contexts }, {
    status: result.error ? 503 : 200, headers: { "Cache-Control": "private, no-store" },
  });
}
