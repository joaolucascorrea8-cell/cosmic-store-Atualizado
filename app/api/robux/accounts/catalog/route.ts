import { after, NextResponse } from "next/server";
import { publicCatalog, syncCatalog } from "@/lib/robux-accounts/service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  // Filters/pagination immediately use the shared cache. The refresh stays
  // attached to the server request lifetime and retains the DB synchronization lock.
  after(async () => {
    try { await syncCatalog(); }
    catch { console.error("[robux-accounts/background] Sincronização indisponível."); }
  });
  try {
    return NextResponse.json(
      await publicCatalog(new URL(request.url).searchParams),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[robux-accounts/catalog]", error);
    return NextResponse.json(
      {
        offers: [],
        available: false,
        page: 1,
        pages: 1,
        total: 0,
        message:
          "As contas estão temporariamente indisponíveis. Tente novamente em instantes.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
