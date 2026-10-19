import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "A venda de contas com Robux não está mais disponível na Cosmic Store." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
