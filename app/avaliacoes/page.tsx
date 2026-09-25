import Link from "next/link";
import ReviewCard from "@/app/components/ReviewCard";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 18;

type SearchParams = Promise<{
  page?: string;
  imagem?: string;
}>;

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const withImage = params.imagem === "1";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("feedbacks")
    .select("id,rating,comment,author_nickname,created_at,source,attachment_path", { count: "exact" })
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (withImage) query = query.not("attachment_path", "is", null);

  const [{ data, count }, { data: summaryRows }] = await Promise.all([
    query,
    supabase.from("feedbacks").select("rating,source,attachment_path").eq("is_visible", true),
  ]);

  const reviews = await withSignedReviewAttachments(data ?? []);
  const all = summaryRows ?? [];
  const total = all.length;
  const average = total ? all.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total : 0;
  const imageCount = all.filter((review) => Boolean(review.attachment_path)).length;
  const discordCount = all.filter((review) => review.source === "discord").length;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const pageHref = (nextPage: number) => {
    const queryString = new URLSearchParams();
    if (nextPage > 1) queryString.set("page", String(nextPage));
    if (withImage) queryString.set("imagem", "1");
    const suffix = queryString.toString();
    return `/avaliacoes${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="shell py-9 sm:py-12">
        <nav aria-label="Navegação de localização" className="mb-7 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Link href="/">Início</Link><span>/</span><span className="text-zinc-200">Avaliações</span>
        </nav>

        <section className="rounded-3xl border border-violet-500/15 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.18),transparent_42%),#121017] p-6 sm:p-8">
          <p className="eyebrow">CONFIANÇA COSMIC</p>
          <div className="mt-2 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Avaliações da Cosmic Store</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Experiências reais de clientes que compraram com a gente, incluindo avaliações da nossa comunidade no Discord e compras verificadas pelo site.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[470px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-zinc-500">Média</span><strong className="mt-1 block text-2xl">{average.toFixed(1)} ★</strong></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-zinc-500">Avaliações</span><strong className="mt-1 block text-2xl">{total}</strong></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-zinc-500">Com imagem</span><strong className="mt-1 block text-2xl">{imageCount}</strong></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-zinc-500">Do Discord</span><strong className="mt-1 block text-2xl">{discordCount}</strong></div>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] pb-5">
            <div>
              <h2 className="text-xl font-black">Quem compra, recomenda</h2>
              <p className="mt-1 text-sm text-zinc-500">{count ?? 0} avaliação{(count ?? 0) === 1 ? "" : "ões"} neste filtro.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/avaliacoes" className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${!withImage ? "border-violet-400/40 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[.03] text-zinc-300 hover:border-white/20"}`}>Todas</Link>
              <Link href="/avaliacoes?imagem=1" className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${withImage ? "border-violet-400/40 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[.03] text-zinc-300 hover:border-white/20"}`}>Com imagem</Link>
            </div>
          </div>

          {reviews.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
            </div>
          ) : (
            <div className="empty-store-state mt-7">Nenhuma avaliação encontrada nesse filtro.</div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {page > 1 ? <Link href={pageHref(page - 1)} className="btn-secondary">← Anterior</Link> : <span className="btn-secondary pointer-events-none opacity-40">← Anterior</span>}
              <span className="px-3 text-sm text-zinc-400">Página <strong className="text-white">{Math.min(page, totalPages)}</strong> de {totalPages}</span>
              {page < totalPages ? <Link href={pageHref(page + 1)} className="btn-secondary">Próxima →</Link> : <span className="btn-secondary pointer-events-none opacity-40">Próxima →</span>}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
