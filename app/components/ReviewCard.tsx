type ReviewCardProps = {
  review: {
    id: string;
    rating: number;
    comment: string;
    author_nickname: string;
    created_at: string;
    source?: string | null;
    attachment_url?: string | null;
  };
  compact?: boolean;
};

export default function ReviewCard({ review, compact = false }: ReviewCardProps) {
  const isDiscord = review.source === "discord";

  return (
    <article className={`surface card-hover rounded-3xl ${compact ? "p-5" : "p-6"}`}>
      <div className="text-amber-300" aria-label={`${review.rating} estrelas`}>
        {"★".repeat(review.rating)}
        <span className="text-zinc-700">{"★".repeat(Math.max(0, 5 - review.rating))}</span>
      </div>

      <p className={`${compact ? "mt-4" : "mt-5"} leading-7 text-zinc-300`}>
        “{review.comment}”
      </p>

      {review.attachment_url && (
        <a
          href={review.attachment_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-lg border border-violet-400/20 bg-violet-500/[.06] px-3 py-2 text-xs font-bold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/10"
        >
          📷 Ver imagem da entrega ↗
        </a>
      )}

      <div className="mt-6 border-t border-white/[.06] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <strong className="text-zinc-100">{review.author_nickname}</strong>
          <span
            className={isDiscord
              ? "rounded-full border border-indigo-400/15 bg-indigo-500/10 px-2.5 py-1 font-bold text-indigo-200"
              : "rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-200"}
          >
            {isDiscord ? "✓ Compra verificada • Discord" : "✓ Compra verificada"}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          {new Date(review.created_at).toLocaleDateString("pt-BR")}
        </p>
      </div>
    </article>
  );
}
