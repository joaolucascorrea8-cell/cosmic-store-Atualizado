import Link from "next/link";
import DiscordReviewImporter from "./DiscordReviewImporter";
import { toggleReviewVisibility } from "./actions";
import PendingButton from "@/app/admin/components/PendingButton";
import Pagination from "@/app/components/Pagination";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
import { allRows } from "@/lib/query-pages";
import { localDate, normalizeSearch, pageNumber } from "@/lib/catalog";
export const dynamic = "force-dynamic";
type Params = {
  q?: string;
  origem?: string;
  visibilidade?: string;
  nota?: string;
  pagina?: string;
};
export default async function ReviewsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireAdmin();
  const params = await searchParams,
    admin = createAdminClient();
  const { data, error } = await allRows(
    admin
      .from("feedbacks")
      .select(
        "id,rating,comment,author_nickname,is_visible,created_at,source,attachment_path",
      )
      .order("created_at", { ascending: false })
      .order("id"),
  );
  const rows = data ?? [],
    query = normalizeSearch((params.q ?? "").slice(0, 100));
  const visible = rows.filter(
    (r) =>
      (!query ||
        normalizeSearch(`${r.author_nickname} ${r.comment}`).includes(query)) &&
      (!["site", "discord"].includes(params.origem ?? "") ||
        r.source === params.origem) &&
      (!["publica", "oculta"].includes(params.visibilidade ?? "") ||
        r.is_visible === (params.visibilidade === "publica")) &&
      (!/^[1-5]$/.test(params.nota ?? "") || r.rating === Number(params.nota)),
  );
  const page = Math.min(
      pageNumber(params.pagina),
      Math.max(1, Math.ceil(visible.length / 30)),
    ),
    reviews = await withSignedReviewAttachments(
      visible.slice((page - 1) * 30, page * 30),
    );
  const enabled =
      process.env.DISCORD_REVIEWS_IMPORT_ENABLED?.toLowerCase() === "true",
    channelId = process.env.DISCORD_REVIEWS_CHANNEL_ID?.trim() || null;
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">REPUTAÇÃO DA LOJA</p>
          <h1 className="admin-title">Avaliações</h1>
          <p className="admin-description">
            Consulte o histórico, ajuste a visibilidade e importe avaliações do
            Discord.
          </p>
        </div>
        <Link href="/avaliacoes" className="btn-secondary">
          Ver página pública ↗
        </Link>
      </div>
      <div className="admin-stats mt-6">
        <div className="admin-stat">
          <span>Total</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Do Discord</span>
          <strong>{rows.filter((r) => r.source === "discord").length}</strong>
        </div>
        <div className="admin-stat">
          <span>Publicadas</span>
          <strong>{rows.filter((r) => r.is_visible).length}</strong>
        </div>
      </div>
      <details className="admin-form-details admin-panel mt-6">
        <summary>
          Importar avaliações do Discord <span>⌄</span>
        </summary>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Importa nome, texto, data e a primeira imagem. As avaliações recebem 5
          estrelas e mensagens já importadas são ignoradas pelo ID do Discord.
        </p>
        <div className="mt-4">
          <DiscordReviewImporter enabled={enabled} channelId={channelId} />
        </div>
      </details>
      <section className="admin-panel mt-6">
        <h2 className="text-xl font-black">Histórico de avaliações</h2>
        <form className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_auto]">
          <input
            aria-label="Buscar avaliações"
            className="admin-input"
            name="q"
            defaultValue={params.q}
            placeholder="Buscar autor ou comentário…"
            maxLength={100}
          />
          <select
            aria-label="Origem"
            className="admin-input"
            name="origem"
            defaultValue={params.origem ?? ""}
          >
            <option value="">Todas as origens</option>
            <option value="site">Site</option>
            <option value="discord">Discord</option>
          </select>
          <select
            aria-label="Visibilidade"
            className="admin-input"
            name="visibilidade"
            defaultValue={params.visibilidade ?? ""}
          >
            <option value="">Todas as avaliações</option>
            <option value="publica">Publicadas</option>
            <option value="oculta">Ocultas</option>
          </select>
          <select
            aria-label="Nota"
            className="admin-input"
            name="nota"
            defaultValue={params.nota ?? ""}
          >
            <option value="">Todas as notas</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} estrela{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <button className="btn-primary">Filtrar</button>
        </form>
        {error ? (
          <p role="alert" className="admin-error">
            Não foi possível carregar as avaliações.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">
              {visible.length} avaliações encontradas
            </p>
            <div className="space-y-3">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-xl border border-white/10 bg-black/15 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong
                          aria-label={`${review.rating} estrelas`}
                          className="text-amber-300"
                        >
                          {"★".repeat(review.rating)}
                        </strong>
                        <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-200">
                          {review.source === "discord"
                            ? "✓ Compra verificada • Discord"
                            : "✓ Compra verificada"}
                        </span>
                        {!review.is_visible && (
                          <span className="text-xs text-zinc-400">Oculta</span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-zinc-300">
                        {review.comment}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                        <strong>{review.author_nickname}</strong>
                        <span>{localDate(review.created_at, false)}</span>
                        {review.attachment_url && (
                          <a
                            href={review.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-violet-300"
                          >
                            Ver imagem ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <form action={toggleReviewVisibility} className="shrink-0">
                      <input type="hidden" name="id" value={review.id} />
                      <input
                        type="hidden"
                        name="visible"
                        value={String(!review.is_visible)}
                      />
                      <PendingButton className="admin-small-button">
                        {review.is_visible ? "Ocultar" : "Publicar"}
                      </PendingButton>
                    </form>
                  </div>
                </article>
              ))}
              {!reviews.length && (
                <p className="admin-empty">
                  Nenhuma avaliação com esses filtros.
                </p>
              )}
            </div>
            <Pagination
              page={page}
              total={visible.length}
              pageSize={30}
              pathname="/admin/avaliacoes"
              params={params}
            />
          </>
        )}
      </section>
    </main>
  );
}
