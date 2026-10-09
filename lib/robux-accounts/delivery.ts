import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { decryptCredentials } from "./credentials-crypto";

export function accountDeliveryConfigured() {
  return /^[a-f0-9]{64}$/i.test(process.env.ROBUX_ACCOUNT_DELIVERY_KEY ?? "");
}
async function readDelivery(orderId: string) {
  const { data, error } = await createAdminClient()
    .from("robux_account_deliveries")
    .select("encrypted_credentials,updated_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar os dados da entrega.");
  if (!data) return null;
  try {
    return {
      ...decryptCredentials(
        orderId,
        data.encrypted_credentials,
        process.env.ROBUX_ACCOUNT_DELIVERY_KEY ?? "",
      ),
      updated_at: data.updated_at,
    };
  } catch {
    throw new Error(
      "Não foi possível abrir os dados da conta. Confira a chave de entrega configurada no servidor.",
    );
  }
}
export async function readAdminAccountDelivery(orderId: string) {
  await requireAdmin();
  return readDelivery(orderId);
}
export async function readCustomerAccountDelivery(orderId: string) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { status: 401 as const, delivery: null };
  const { data: order, error } = await client
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .eq("order_type", "robux_account")
    .eq("status", "delivered")
    .maybeSingle();
  if (error) throw new Error("Não foi possível conferir o pedido.");
  if (!order) return { status: 404 as const, delivery: null };
  const delivery = await readDelivery(orderId);
  return { status: delivery ? (200 as const) : (404 as const), delivery };
}
