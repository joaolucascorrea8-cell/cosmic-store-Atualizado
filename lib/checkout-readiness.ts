import "server-only";
import { createAdminClient } from "./supabase/admin";

export async function checkoutReady() {
  try {
    const { data, error } = await createAdminClient().rpc("store_checkout_capabilities");
    return !error && data?.version === 1 && data?.ready === true;
  } catch { return false; }
}
