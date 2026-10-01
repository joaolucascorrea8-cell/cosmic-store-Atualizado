import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { localDate, pageNumber } from "@/lib/catalog";
import Pagination from "@/app/components/Pagination";
import PendingButton from "@/app/admin/components/PendingButton";
import { moderateUser, resolveReport } from "./actions";
function nested<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}
export default async function CommunityAdmin({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams,
    admin = createAdminClient();
  const { count } = await admin
    .from("global_messages")
    .select("id", { head: true, count: "exact" });
  const total = count ?? 0,
    page = Math.min(
      pageNumber(params.pagina),
      Math.max(1, Math.ceil(total / 30)),
    );
  const [messages, reports, bans, mutes, staff] = await Promise.all([
    admin
      .from("global_messages")
      .select("id,user_id,message,created_at,profiles(nickname)")
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
    admin
      .from("message_reports")
      .select(
        "id,reason,created_at,global_messages(message,profiles(nickname))",
      )
      .is("resolved_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("chat_bans")
      .select("user_id,reason,profiles!chat_bans_user_id_fkey(nickname)"),
    admin
      .from("chat_mutes")
      .select("user_id,muted_until,profiles!chat_mutes_user_id_fkey(nickname)")
      .gt("muted_until", new Date().toISOString()),
    admin.from("admins").select("user_id").in("role", ["owner", "admin"]),
  ]);
  const staffIds = new Set(staff.data?.map((u) => u.user_id));
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="eyebrow">COMUNIDADE</p>
          <h1 className="admin-title">Chat e moderação</h1>
          <p className="admin-description">
            Revise denúncias, modere mensagens e gerencie restrições.
          </p>
        </div>
        <Link href="/admin/avaliacoes" className="btn-secondary">
          Avaliações →
        </Link>
      </div>
      {[messages, reports, bans, mutes, staff].some((r) => r.error) && (
        <p role="alert" className="admin-error mt-5">
          Não foi possível carregar parte da moderação. Atualize antes de agir.
        </p>
      )}
      <section className="admin-panel mt-6">
        <h2 className="text-lg font-black">
          Denúncias pendentes · {reports.data?.length ?? 0}
        </h2>
        <div className="mt-4 space-y-3">
          {reports.data?.map((report) => {
            const msg = nested(report.global_messages);
            return (
              <article
                key={report.id}
                className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4"
              >
                <p className="text-sm font-bold text-amber-200">
                  {report.reason}
                </p>
                <p className="mt-2 break-words text-sm text-zinc-300">
                  {msg?.message ?? "Mensagem removida"}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {msg
                    ? (nested(msg.profiles)?.nickname ?? "Usuário")
                    : "Usuário"}{" "}
                  · {localDate(report.created_at)}
                </p>
                <form action={resolveReport} className="mt-3">
                  <input type="hidden" name="report_id" value={report.id} />
                  <PendingButton className="admin-small-button">
                    Marcar como resolvida
                  </PendingButton>
                </form>
              </article>
            );
          })}
          {!reports.data?.length && (
            <p className="text-sm text-zinc-500">Nenhuma denúncia pendente.</p>
          )}
        </div>
      </section>
      <details className="admin-form-details admin-panel mt-6">
        <summary>
          Restrições ativas ·{" "}
          {(bans.data?.length ?? 0) + (mutes.data?.length ?? 0)}
          <span>⌄</span>
        </summary>
        <div className="mt-4 space-y-3">
          {bans.data?.map((user) => (
            <div
              key={`ban-${user.user_id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3"
            >
              <div>
                <strong className="text-sm">
                  {nested(user.profiles)?.nickname ?? "Usuário"}
                </strong>
                <p className="text-xs text-red-300">Banido do chat</p>
              </div>
              <form action={moderateUser}>
                <input type="hidden" name="user_id" value={user.user_id} />
                <input type="hidden" name="action" value="unban" />
                <PendingButton className="admin-small-button">
                  Remover banimento
                </PendingButton>
              </form>
            </div>
          ))}
          {mutes.data?.map((user) => (
            <div
              key={`mute-${user.user_id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3"
            >
              <div>
                <strong className="text-sm">
                  {nested(user.profiles)?.nickname ?? "Usuário"}
                </strong>
                <p className="text-xs text-amber-300">
                  Silenciado até {localDate(user.muted_until)}
                </p>
              </div>
              <form action={moderateUser}>
                <input type="hidden" name="user_id" value={user.user_id} />
                <input type="hidden" name="action" value="unmute" />
                <PendingButton className="admin-small-button">
                  Remover silêncio
                </PendingButton>
              </form>
            </div>
          ))}
        </div>
      </details>
      <section className="admin-panel mt-6">
        <h2 className="text-lg font-black">Mensagens do chat</h2>
        <div className="mt-4 space-y-3">
          {messages.data?.map((message) => (
            <article
              key={message.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-4 sm:flex-row"
            >
              <div className="min-w-0">
                <strong className="text-sm">
                  {nested(message.profiles)?.nickname ?? "Usuário"}
                </strong>
                <time className="ml-2 text-xs text-zinc-500">
                  {localDate(message.created_at)}
                </time>
                <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-300">
                  {message.message}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2">
                {[
                  ["delete_message", "Apagar"],
                  ...(!staffIds.has(message.user_id)
                    ? [
                        ["mute", "Silenciar 24h"],
                        ["ban", "Banir"],
                      ]
                    : []),
                ].map(([action, label]) => (
                  <form key={action} action={moderateUser}>
                    <input
                      type="hidden"
                      name="user_id"
                      value={message.user_id}
                    />
                    <input type="hidden" name="message_id" value={message.id} />
                    <input type="hidden" name="action" value={action} />
                    <PendingButton
                      confirm={`${label} ${action === "delete_message" ? "esta mensagem" : "este usuário"}?`}
                      className="admin-small-button"
                    >
                      {label}
                    </PendingButton>
                  </form>
                ))}
              </div>
            </article>
          ))}
          {!messages.data?.length && (
            <p className="admin-empty">Nenhuma mensagem ainda.</p>
          )}
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={30}
          pathname="/admin/comunidade"
        />
      </section>
    </main>
  );
}
