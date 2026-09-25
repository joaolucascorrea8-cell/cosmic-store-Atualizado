import Link from "next/link";
import ReviewCard from "@/app/components/ReviewCard";

type Feedback = {
  id: string;
  rating: number;
  comment: string;
  author_nickname: string;
  created_at: string;
  source?: string | null;
  attachment_url?: string | null;
};

type StoreFeedbacksProps = {
  feedbacks: Feedback[];
  showMoreLink?: boolean;
};

export default function StoreFeedbacks({ feedbacks, showMoreLink = true }: StoreFeedbacksProps) {
  if (!feedbacks.length) return null;

  return (
    <section className="shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AVALIAÇÕES REAIS</p>
          <h2 className="section-title">Quem compra, recomenda</h2>
          <p className="section-description">Experiências de clientes que já compraram na Cosmic Store.</p>
        </div>
        {showMoreLink && (
          <Link href="/avaliacoes" className="section-link">
            Ver mais avaliações ↗
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {feedbacks.slice(0, 3).map((item) => (
          <ReviewCard key={item.id} review={item} />
        ))}
      </div>

      {showMoreLink && (
        <div className="mt-6 flex justify-center md:hidden">
          <Link href="/avaliacoes" className="btn-secondary">
            Ver mais avaliações →
          </Link>
        </div>
      )}
    </section>
  );
}
