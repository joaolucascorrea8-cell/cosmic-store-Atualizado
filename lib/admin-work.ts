import "server-only";
import { requireAdmin } from "./require-admin";
import { createAdminClient } from "./supabase/admin";
export async function workAssignments(
  kind: "order" | "support",
  ids: string[],
) {
  await requireAdmin();
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const client = createAdminClient(),
    field = kind === "order" ? "order_id" : "ticket_id";
  const { data, error } = await client
    .from("admin_work_items")
    .select("order_id,ticket_id,assigned_to")
    .in(field, ids);
  if (error) {
    for (const id of ids) names.set(id, "Equipe indisponível");
    return names;
  }
  const staff = [
    ...new Set((data ?? []).map((x) => x.assigned_to).filter(Boolean)),
  ];
  const profiles = staff.length
    ? await client.from("profiles").select("id,nickname").in("id", staff)
    : { data: [] };
  for (const row of data ?? []) {
    if (row.assigned_to)
      names.set(
        row[field],
        profiles.data?.find((p) => p.id === row.assigned_to)?.nickname ||
          "Equipe",
      );
  }
  return names;
}
