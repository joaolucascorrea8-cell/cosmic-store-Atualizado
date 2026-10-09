import { NextResponse } from "next/server";
import { UUID_PATTERN } from "@/lib/catalog";
import { readCustomerAccountDelivery } from "@/lib/robux-accounts/delivery";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie",
  };
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400, headers },
    );
  try {
    const { status, delivery } = await readCustomerAccountDelivery(id);
    return NextResponse.json(
      delivery
        ? { delivery }
        : {
            error:
              status === 401
                ? "Entre na sua conta para consultar a entrega."
                : "Os dados desta entrega ainda não estão disponíveis.",
          },
      { status, headers },
    );
  } catch {
    // Never log ciphertext, passwords or decrypted form values.
    return NextResponse.json(
      {
        error:
          "Não foi possível abrir a entrega. Fale com o suporte pelo seu pedido.",
      },
      { status: 503, headers },
    );
  }
}
