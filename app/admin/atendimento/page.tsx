import AutoCloseForm from "./AutoCloseForm";
import ReplyForm from "./equipe/ReplyForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/query-pages";
import { requireAdmin } from "@/lib/require-admin";
import { getStoreService } from "@/lib/store-service-server";
import ServiceForm from "./ServiceForm";
export default async function ServicePage() {
  await requireAdmin();
  const settings = await getStoreService();
  const client = createAdminClient();
  const auto = await client
    .from("store_ops_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const [replies, games] = await Promise.all([
    allRows(
      client
        .from("admin_quick_replies")
        .select("*")
        .order("scope")
        .order("label")
        .order("id"),
    ),
    allRows(client.from("games").select("id,name").order("name").order("id")),
  ]);
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <p className="eyebrow">Organização da equipe</p>
      <h1 className="admin-title">Atendimento e entrega</h1>
      <p className="admin-description">
        Defina expectativas claras para os clientes antes da compra.
      </p>
      {settings ? (
        <ServiceForm settings={settings} />
      ) : (
        <p className="admin-error mt-6">
          Não foi possível carregar as configurações. Confira a atualização SQL.
        </p>
      )}
      {auto.error || !auto.data ? (
        <p className="admin-error mt-5">
          Automação indisponível. Confira a atualização SQL.
        </p>
      ) : (
        <AutoCloseForm key={auto.data.updated_at} settings={auto.data} />
      )}
      <details className="admin-panel mt-5">
        <summary className="cursor-pointer font-bold">
          Respostas rápidas da equipe
        </summary>
        <p className="mt-3 text-sm text-zinc-400">
          Os botões preenchem o rascunho da conversa. Você confere antes de
          enviar.
        </p>
        {replies.error || games.error ? (
          <p className="admin-error mt-3">
            Não foi possível carregar as respostas.
          </p>
        ) : (
          <>
            <details className="mt-4 rounded-xl border border-white/10 p-4">
              <summary className="cursor-pointer font-bold">
                Nova resposta
              </summary>
              <ReplyForm games={games.data ?? []} />
            </details>
            {(replies.data ?? []).map((r) => (
              <details
                key={r.id}
                className="mt-3 rounded-xl border border-white/10 p-4"
              >
                <summary className="cursor-pointer text-sm font-bold">
                  {r.label} · {r.scope === "order" ? "Pedidos" : "Suporte"}
                  {!r.is_active ? " · Oculta" : ""}
                </summary>
                <ReplyForm
                  key={r.updated_at}
                  reply={r}
                  games={games.data ?? []}
                />
              </details>
            ))}
          </>
        )}
      </details>
    </main>
  );
}
