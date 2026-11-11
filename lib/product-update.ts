import type { SupabaseClient } from "@supabase/supabase-js";

// Do not adopt a newer revision while an administrator is editing stale values.
export function updateProductAtRevision(
  client: SupabaseClient,
  id: string,
  revision: number,
  values: Record<string, unknown>,
) {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("Reabra o produto antes de salvar.");
  return client.from("products").update(values).eq("id", id)
    .eq("ops_version", revision).select("id,ops_version").maybeSingle();
}
