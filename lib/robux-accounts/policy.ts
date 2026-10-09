import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountPolicy = {
  version: string;
  body: string;
  updated_at: string;
};
export async function readAccountPolicy(): Promise<AccountPolicy> {
  const { data, error } = await createAdminClient()
    .from("robux_account_policy")
    .select("version,body,updated_at")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error("Política de contas indisponível.");
  return data;
}
