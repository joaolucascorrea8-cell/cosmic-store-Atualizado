import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { localDate } from "@/lib/catalog";
import WorkForm from "./WorkForm";
export default async function WorkPanel({
  id,
  kind,
}: {
  id: string;
  kind: "order" | "support";
}) {
  const actor = await requireAdmin(),
    client = createAdminClient();
  const [work, admins] = await Promise.all([
    client
      .from("admin_work_items")
      .select("*")
      .eq(kind === "order" ? "order_id" : "ticket_id", id)
      .maybeSingle(),
    client.from("admins").select("user_id").in("role", ["owner", "admin"]),
  ]);
  if (work.error || admins.error)
    return (
      <p className="admin-error my-5">
        Não foi possível carregar a organização da equipe.
      </p>
    );
  const notes = work.data
    ? await client
        .from("admin_work_notes")
        .select("id,body,actor_id,created_at")
        .eq("work_id", work.data.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [], error: null };
  const ids = [
    ...new Set([
      ...(admins.data ?? []).map((a) => a.user_id),
      ...(notes.data ?? []).map((n) => n.actor_id).filter(Boolean),
    ]),
  ];
  const { data: profiles } = ids.length
    ? await client.from("profiles").select("id,nickname").in("id", ids)
    : { data: [] };
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.nickname || "Equipe"]),
  );
  return (
    <details className="admin-panel my-5">
      <summary className="cursor-pointer font-bold">
        Organização da equipe ·{" "}
        {names.get(work.data?.assigned_to) ?? "Sem responsável"}
      </summary>
      <p className="mt-3 text-sm text-zinc-400">
        Somente administradores veem esta área. Assumir organiza a fila, mas não
        impede outro administrador de ajudar.
      </p>
      <WorkForm
        key={work.data?.updated_at ?? "new"}
        id={id}
        kind={kind}
        actor={actor.id}
        assigned={work.data?.assigned_to ?? ""}
        expected={work.data?.updated_at ?? ""}
        staff={(admins.data ?? []).map((a) => ({
          id: a.user_id,
          name: names.get(a.user_id) ?? "Equipe",
        }))}
      />
      <div className="mt-5 space-y-3">
        {notes.error ? (
          <p className="admin-error">Não foi possível carregar as notas.</p>
        ) : (
          (notes.data ?? []).map((n) => (
            <div key={n.id} className="rounded-xl border border-white/10 p-3">
              <p className="whitespace-pre-wrap break-words text-sm">
                {n.body}
              </p>
              <small className="mt-2 block text-zinc-500">
                {names.get(n.actor_id) ?? "Equipe"} · {localDate(n.created_at)}
              </small>
            </div>
          ))
        )}
      </div>
      {(notes.data ?? []).length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">Últimas 20 anotações.</p>
      )}
    </details>
  );
}
