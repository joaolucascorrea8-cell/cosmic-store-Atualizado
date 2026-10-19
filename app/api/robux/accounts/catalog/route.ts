import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { offers: [], available: false, page: 1, pages: 1, total: 0, message: "A venda de contas com Robux não está mais disponível na Cosmic Store." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
