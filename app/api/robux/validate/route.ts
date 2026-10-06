import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateByRobux,
  friendlyByRobuxError,
  resolveGamePassCreator,
} from "@/lib/byrobux";
import { getRobuxSettings } from "@/lib/robux-settings";
import {
  cosmicRateFromSupplier,
  isRobuxPurchaseMode,
  readRobuxAmount,
  robuxBreakdown,
  salePriceForGamepass,
} from "@/lib/robux-pricing";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para verificar o GamePass." },
      { status: 401 },
    );

  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    mode?: unknown;
    link?: unknown;
  } | null;
  const amount = readRobuxAmount(body?.amount);
  const mode = body?.mode;
  const link = typeof body?.link === "string" ? body.link.trim() : "";
  if (!amount || !isRobuxPurchaseMode(mode))
    return NextResponse.json(
      { error: "Informe uma quantidade de Robux válida." },
      { status: 400 },
    );
  if (link.length < 20 || link.length > 500)
    return NextResponse.json(
      { error: "Cole o link completo do seu GamePass." },
      { status: 400 },
    );

  try {
    const settings = await getRobuxSettings();
    if (!settings.enabled)
      return NextResponse.json(
        { error: "As compras de Robux estão temporariamente pausadas." },
        { status: 503 },
      );
    const quote = await calculateByRobux(link);
    const item = quote.items?.[0];
    if (!item || item.error)
      return NextResponse.json(
        { error: "A ByRobux não reconheceu este GamePass. Confira o link e tente novamente." },
        { status: 400 },
      );
    const supplierK = Number(quote.rateBrlPerThousand);
    if (!Number.isFinite(supplierK) || supplierK <= 0)
      throw new Error("Cotação inválida do fornecedor.");
    if (supplierK > settings.maxSupplierK)
      return NextResponse.json(
        {
          error:
            "A cotação do fornecedor está acima do limite da Cosmic. As compras estão pausadas para evitar um preço ruim.",
        },
        { status: 503 },
      );

    const breakdown = robuxBreakdown(amount, mode);
    if (Number(item.robux) !== breakdown.gamepassRobux)
      return NextResponse.json(
        {
          error: `O GamePass está em ${Number(item.robux).toLocaleString("pt-BR")} Robux. Para esta opção, coloque exatamente ${breakdown.gamepassRobux.toLocaleString("pt-BR")} Robux e verifique novamente.`,
          expectedGamepassRobux: breakdown.gamepassRobux,
          actualGamepassRobux: Number(item.robux),
        },
        { status: 409 },
      );

    const cosmicK = cosmicRateFromSupplier(supplierK, settings);
    const price = salePriceForGamepass(breakdown.gamepassRobux, cosmicK);
    const creator = await resolveGamePassCreator({
      gamePassId: item.id,
      byRobuxUsername: item.username,
    });
    return NextResponse.json({
      valid: true,
      username: creator.name,
      creatorType: creator.type,
      creatorSource: creator.source,
      gamepassId: item.id,
      gamepassRobux: breakdown.gamepassRobux,
      netRobux: breakdown.netRobux,
      feeRobux: breakdown.feeRobux,
      cosmicK,
      price,
    });
  } catch (error) {
    console.error("[robux/validate]", error);
    return NextResponse.json(
      { error: friendlyByRobuxError(error) },
      { status: 503 },
    );
  }
}
