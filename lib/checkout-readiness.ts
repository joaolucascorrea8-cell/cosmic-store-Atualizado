import "server-only";
import { createAdminClient } from "./supabase/admin";

export async function checkoutReady() {
  try {
    const { data, error } = await createAdminClient().rpc("store_checkout_ready");
    return !error && data === true;
  } catch { return false; }
}
