import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate, money } from "@/lib/catalog";
const entities: Record<string, string> = {
  products: "Produtos",
  categories: "Categorias",
  games: "Jogos",
  combos: "Combos",
};
const fields: Record<string, string> = {
  name: "Nome",
  price: "Preço",
  stock: "Estoque",
  is_active: "Publicado",
  unlimited_stock: "Estoque ilimitado",
  category_id: "Categoria",
  description: "Descrição",
  image_url: "Imagem",
  display_order: "Ordem",
  robux_pricing_enabled: "Reajuste por Robux",
  pricing_locked: "Proteção manual",
  pricing_rate: "Cotação",
  robux_quantity: "Robux",
  delivery_instructions: "Instruções de entrega",
  low_stock_threshold: "Limite de estoque baixo",
  delivery_hours: "Prazo em horas",
};
function value(k: string, v: unknown) {
  if (v === null || v === undefined || v === "") return "Vazio";
  if (k === "price" || k === "pricing_rate") return money(Number(v));
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; pagina?: string; q?: string }>;
}) {
  await requireAdmin();
  const p = await searchParams;
  const page = Math.max(
      1,
      Math.min(100000, Number.parseInt(p.pagina ?? "1") || 1),
    ),
    type = Object.hasOwn(entities, p.tipo ?? "") ? p.tipo! : "",
    query = (p.q ?? "").trim().slice(0, 100),
    client = createAdminClient();
  let request = client
    .from("catalog_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");
  if (type) request = request.eq("entity", type);
  if (query)
    request = request.ilike(
      "label",
      "%" + query.replace(/[%_\\]/g, "\\$&") + "%",
    );
  const { data, error, count } = await request.range(
    (page - 1) * 30,
    page * 30 - 1,
  );
  const actorIds = [
    ...new Set((data ?? []).map((e) => e.actor_id).filter(Boolean)),
  ];
  const profiles = actorIds.length
    ? await client.from("profiles").select("id,nickname").in("id", actorIds)
    : { data: [] };
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.nickname]));
  const href = (n: number) =>
    "/admin/historico?" +
    new URLSearchParams({ pagina: String(n), tipo: type, q: query });
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <h1 className="admin-title">Histórico do catálogo</h1>
      <p className="admin-description">
        Alterações registradas a partir desta atualização. Movimentações
        automáticas aparecem como sistema.
      </p>
      <form className="admin-panel mt-6 flex flex-wrap items-end gap-3">
        <label className="admin-label">
          Buscar item
          <input
            name="q"
            defaultValue={query}
            className="admin-input mt-2"
            maxLength={100}
          />
        </label>
        <label className="admin-label">
          Área
          <select name="tipo" defaultValue={type} className="admin-input mt-2">
            <option value="">Todas</option>
            {Object.entries(entities).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary">Filtrar</button>
      </form>
      {error ? (
        <p className="admin-error mt-5">
          Não foi possível consultar o histórico.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {(data ?? []).map((e) => {
            const b = e.before_data ?? {},
              a = e.after_data ?? {};
            const changed = Object.keys(fields).filter(
              (k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]),
            );
            return (
              <details key={e.id} className="admin-panel">
                <summary className="cursor-pointer text-sm">
                  <strong>{e.label}</strong> · {entities[e.entity] ?? e.entity}{" "}
                  ·{" "}
                  {e.action === "insert"
                    ? "Criado"
                    : e.action === "delete"
                      ? "Excluído"
                      : "Atualizado"}
                  <span className="mt-2 block text-xs text-zinc-400">
                    {localDate(e.created_at)} ·{" "}
                    {names.get(e.actor_id) ?? "Sistema / integração"}
                    {e.batch_id ? " · Reajuste por lote" : ""}
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  {changed.map((k) => (
                    <div
                      key={k}
                      className="grid gap-2 rounded-lg bg-white/[.025] p-3 text-sm sm:grid-cols-[150px_1fr_1fr]"
                    >
                      <strong>{fields[k]}</strong>
                      <span className="break-words whitespace-pre-wrap text-zinc-400">
                        Antes: {value(k, b[k])}
                      </span>
                      <span className="break-words whitespace-pre-wrap">
                        Depois: {value(k, a[k])}
                      </span>
                    </div>
                  ))}
                  {!changed.length && (
                    <p className="text-sm text-zinc-400">
                      Referência de preço ou outros dados de controle
                      atualizados.
                    </p>
                  )}
                </div>
              </details>
            );
          })}
          {!data?.length && (
            <p className="admin-empty">Nenhum registro para estes filtros.</p>
          )}
        </div>
      )}
      <div className="mt-5 flex items-center gap-4">
        {page > 1 && (
          <Link className="admin-small-button" href={href(page - 1)}>
            Anterior
          </Link>
        )}
        <span className="text-sm text-zinc-400">
          Página {page} · {count ?? 0} registros
        </span>
        {page * 30 < (count ?? 0) && (
          <Link className="admin-small-button" href={href(page + 1)}>
            Próxima
          </Link>
        )}
      </div>
    </main>
  );
}
