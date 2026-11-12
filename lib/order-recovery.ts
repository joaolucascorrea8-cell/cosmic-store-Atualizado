import "server-only";
import { createAdminClient } from "./supabase/admin";
import { reconcileGamePassOrder } from "./gamepass-reconciliation";
import { sendOrderStatusEmail, type OrderEmailKind } from "./order-emails";
import { recordStoreIssue } from "./store-issues";

export async function recoverOrderOperations() {
  const deadline = Date.now() + 180_000;
  const admin = createAdminClient();
  let reconciled = 0, emailAttempts = 0, failures = 0;
  const { data: pending, error: orderError } = await admin.from("robux_orders")
    .select("order_id,orders!inner(status)").in("supplier_status", ["PENDING", "COMPLETED"])
    .in("orders.status", ["paid", "preparing_delivery"])
    .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(3);
  if (orderError) throw new Error("Não foi possível consultar os Game Pass pendentes.");
  for (const row of pending ?? []) {
    if (Date.now() > deadline - 50_000) break;
    try {
      const response = await reconcileGamePassOrder(row.order_id);
      if (!response.ok) throw new Error("Conciliação do Game Pass precisa de revisão.");
      reconciled++;
    } catch (error) { failures++; await recordStoreIssue("recovery", error, "/api/maintenance/chat-attachments"); }
  }
  const { data: jobs, error: jobError } = await admin.from("order_email_jobs")
    .select("order_id,kind,status,lease_until,orders!inner(status)").in("status", ["queued", "failed", "processing"])
    .in("orders.status", ["paid", "preparing_delivery", "delivered"])
    .lt("attempts", 5).lte("next_attempt_at", new Date().toISOString())
    .order("updated_at").limit(3);
  if (jobError) throw new Error("Não foi possível consultar a fila de e-mails.");
  for (const job of jobs ?? []) {
    if (Date.now() > deadline - 50_000) break;
    if (job.status === "processing" && job.lease_until && Date.parse(job.lease_until) > Date.now()) continue;
    try { await sendOrderStatusEmail(job.order_id, job.kind as OrderEmailKind); emailAttempts++; }
    catch (error) { failures++; await recordStoreIssue("recovery", error, "/api/maintenance/chat-attachments"); }
  }
  return { reconciled, emailAttempts, failures };
}
