import { NextResponse } from "next/server";
import { syncCatalog } from "@/lib/robux-accounts/service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const state = await syncCatalog();
    return NextResponse.json(
      { ok: !state.last_error, lastSuccess: state.last_success_at },
      { status: state.last_error ? 503 : 200 },
    );
  } catch (error) {
    console.error("[robux-accounts/cron]", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
