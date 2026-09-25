import DiscordReviewImporter from "./DiscordReviewImporter";
import { toggleReviewVisibility } from "./actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSignedReviewAttachments } from "@/lib/review-attachments";

export const dynamic = "force-dynamic";

export default async function ReviewsAdminPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("feedbacks").select("id,rating,comment,author_nickname,is_visible,created_at,source,discord_message_id,attachment_path").order("created_at", { ascending: false }).limit(100);
  const reviews = await withSignedReviewAttachments(data ?? []);
  const enabled = String(process.env.DISCORD_REVIEWS_IMPORT_ENABLED ?? "false").toLowerCase() === "true";
  const channelId = process.env.DISCORD_REVIEWS_CHANNEL_ID?.trim() || null;
  const discordCount = reviews.filter(review => review.source === "discord").length;
  const siteCount = reviews.filter(review => review.source !== "discord").length;

  return <main className="admin-page"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">REPUTAÇÃO DA LOJA</p><h1 className="admin-title">Avaliações</h1><p className="admin-description">Gerencie avaliações verificadas do site e importe o histórico antigo do Discord.</p></div></div>
    <section className="admin-stats mt-6"><div className="admin-stat"><span>Carregadas</span><strong>{reviews.length}</strong></div><div className="admin-stat"><span>Do Discord</span><strong>{discordCount}</strong></div><div className="admin-stat"><span>Do site</span><strong>{siteCount}</strong></div></section>
    <section className="admin-panel mt-6"><p className="eyebrow">MIGRAÇÃO ÚNICA</p><h2 className="mt-1 text-xl font-black">Importar avaliações do Discord</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">O importador lê o canal configurado, traz texto, nome, data e a primeira imagem de cada avaliação. Tudo entra como 5 estrelas. Mensagens já importadas são ignoradas pelo ID original do Discord.</p><div className="mt-5"><DiscordReviewImporter enabled={enabled} channelId={channelId} /></div></section>
    <section className="admin-panel mt-6"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">AVALIAÇÕES</p><h2 className="mt-1 text-xl font-black">Últimas avaliações</h2></div><span className="text-xs text-zinc-500">Até 100 mais recentes</span></div><div className="mt-5 space-y-3">{reviews.map(review => <article key={review.id} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{"★".repeat(review.rating)}</strong><span className={review.source === "discord" ? "rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200" : "rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-200"}>{review.source === "discord" ? "Importada do Discord" : "Compra verificada"}</span>{!review.is_visible && <span className="rounded-full bg-zinc-500/10 px-2 py-1 text-[10px] font-bold text-zinc-400">Oculta</span>}</div><p className="mt-2 text-sm leading-6 text-zinc-300">“{review.comment}”</p><div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500"><strong className="text-zinc-300">{review.author_nickname}</strong><span>{new Date(review.created_at).toLocaleDateString("pt-BR")}</span>{review.attachment_url && <a href={review.attachment_url} target="_blank" rel="noreferrer" className="font-bold text-violet-300">📷 Ver imagem da entrega ↗</a>}</div></div><form action={toggleReviewVisibility} className="shrink-0"><input type="hidden" name="id" value={review.id}/><input type="hidden" name="visible" value={String(!review.is_visible)}/><button className="admin-small-button">{review.is_visible ? "Ocultar" : "Publicar"}</button></form></div></article>)}{reviews.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">Nenhuma avaliação ainda.</p>}</div></section>
  </main>;
}
