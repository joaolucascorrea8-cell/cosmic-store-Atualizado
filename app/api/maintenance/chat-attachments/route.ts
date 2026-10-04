import { createAdminClient } from "@/lib/supabase/admin";
import { recordStoreIssue } from "@/lib/store-issues";
import { NextRequest, NextResponse } from "next/server";

import { cleanupExpiredChatAttachments } from "@/lib/chat-attachment-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let closedOrders = 0,
    cleanup = null;
  let failed = false;
  try {
    const { data, error } = await createAdminClient().rpc("ops_expire_orders");
    if (error)
      throw new Error(
        error.code === "P0001"
          ? error.message
          : `Rotina de pedidos: ${error.code}`,
      );
    closedOrders = data ?? 0;
  } catch (error) {
    failed = true;
    await recordStoreIssue("cron", error, "/api/maintenance/chat-attachments");
  }
  try {
    cleanup = await cleanupExpiredChatAttachments();
  } catch (error) {
    failed = true;
    await recordStoreIssue("cron", error, "/api/maintenance/chat-attachments");
  }
  return NextResponse.json(
    { ok: !failed, closedOrders, cleanup },
    { status: failed ? 500 : 200 },
  );
}
