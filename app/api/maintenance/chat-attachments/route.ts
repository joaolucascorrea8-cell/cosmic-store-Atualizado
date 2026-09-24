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
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredChatAttachments();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[chat-attachment-retention]", error);
    return NextResponse.json({ error: "Falha ao limpar anexos antigos." }, { status: 500 });
  }
}
