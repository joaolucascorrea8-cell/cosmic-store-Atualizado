import {recordStoreIssue} from "@/lib/store-issues";
import { couponCode } from "@/lib/coupons";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayload } from "@/lib/pix";
import {
  createAdminNotifications,
  notifyAdminDiscord,
} from "@/lib/notifications";

type RequestedItem = {
  id?: unknown;
  quantity?: unknown;
  kind?: unknown;
  price?: unknown;
};
type CreatedOrder = {
  id: string;
  order_code: string;
  status: string;
  total: number;
  pix_payload: string;
};
type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  is_active: boolean;
};
type ComboProduct = {
  id: string;
  name: string;
  stock: number;
  unlimited_stock: boolean;
  is_active: boolean;
};
type ComboItem = {
  product_id: string;
  quantity: number;
  products: ComboProduct | ComboProduct[] | null;
};
type ComboRow = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  combo_items: ComboItem[] | null;
};

async function orderResponse(order: CreatedOrder) {
  const qrCode = await QRCode.toDataURL(order.pix_payload, {
    width: 440,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return NextResponse.json(
    { order, qrCode },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function comboIsLive(combo: ComboRow) {
  const now = Date.now();
  return (
    combo.is_active &&
    (!combo.starts_at || new Date(combo.starts_at).getTime() <= now) &&
    (!combo.ends_at || new Date(combo.ends_at).getTime() > now)
  );
}

function nestedProduct(
  value: ComboProduct | ComboProduct[] | null | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export async function POST(request: Request) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para finalizar." },
      { status: 401 },
    );

  const body = (await request.json().catch(() => null)) as {
    items?: RequestedItem[];
    gameNickname?: unknown;
    checkoutToken?: unknown;
    couponCode?: unknown;
    expectedTotal?: unknown;
  } | null;
  const nickname =
    typeof body?.gameNickname === "string" ? body.gameNickname.trim() : "";
  if (nickname.length < 2 || nickname.length > 60)
    return NextResponse.json(
      { error: "Informe um nickname válido do jogo." },
      { status: 400 },
    );

  const token =
    typeof body?.checkoutToken === "string" ? body.checkoutToken : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    )
  ) {
    return NextResponse.json(
      { error: "Sessão de checkout inválida. Atualize a página." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const existing = await admin
    .from("orders")
    .select(
      "id,order_code,status,total,pix_payload,subtotal,discount_total,coupon_code,delivery_hours",
    )
    .eq("user_id", user.id)
    .eq("checkout_token", token)
    .maybeSingle();
  if (existing.error)
    return NextResponse.json(
      {
        error:
          "Não foi possível verificar o pedido. Confirme as migrations do banco de dados.",
      },
      { status: 500 },
    );
  if (existing.data) return orderResponse(existing.data);

  if (
    !Array.isArray(body?.items) ||
    body.items.length === 0 ||
    body.items.length > 40
  ) {
    return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
  }

  const requested = body.items.map((item) => ({
    id:
      item && typeof item === "object" && typeof item.id === "string"
        ? item.id
        : "",
    quantity: item && typeof item === "object" ? item.quantity : null,
    price: item && typeof item === "object" ? item.price : undefined,
    kind:
      item && typeof item === "object" && item.kind === "combo"
        ? ("combo" as const)
        : ("product" as const),
  }));

  if (
    requested.some(
      (item) =>
        !/^[0-9a-f-]{36}$/i.test(item.id) ||
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99,
    ) ||
    new Set(requested.map((item) => `${item.kind}:${item.id}`)).size !==
      requested.length
  ) {
    return NextResponse.json(
      { error: "Itens ou quantidades inválidos." },
      { status: 400 },
    );
  }

  const productIds = requested
    .filter((item) => item.kind === "product")
    .map((item) => item.id);
  const comboIds = requested
    .filter((item) => item.kind === "combo")
    .map((item) => item.id);

  const [productResult, comboResult] = await Promise.all([
    productIds.length
      ? admin
          .from("products")
          .select("id,name,price,stock,unlimited_stock,is_active")
          .in("id", productIds)
      : Promise.resolve({ data: [] as ProductRow[], error: null }),
    comboIds.length
      ? admin
          .from("combos")
          .select(
            "id,name,price,is_active,starts_at,ends_at,combo_items(product_id,quantity,products(id,name,stock,unlimited_stock,is_active))",
          )
          .in("id", comboIds)
      : Promise.resolve({ data: [] as ComboRow[], error: null }),
  ]);

  if (productResult.error || comboResult.error) {
    return NextResponse.json(
      { error: "Não foi possível verificar os itens do carrinho." },
      { status: 500 },
    );
  }

  const products = (productResult.data ?? []) as ProductRow[];
  const combos = (comboResult.data ?? []) as unknown as ComboRow[];
  if (
    products.length !== productIds.length ||
    combos.length !== comboIds.length
  ) {
    return NextResponse.json(
      { error: "Um item não está mais disponível." },
      { status: 400 },
    );
  }

  const stockNeeds = new Map<
    string,
    { product: ComboProduct | ProductRow; quantity: number }
  >();
  const addStockNeed = (
    product: ComboProduct | ProductRow,
    quantity: number,
  ) => {
    const current = stockNeeds.get(product.id);
    stockNeeds.set(product.id, {
      product,
      quantity: (current?.quantity ?? 0) + quantity,
    });
  };

  let itemRows: {
    product_id: string | null;
    combo_id: string | null;
    product_name: string;
    unit_price: number;
    quantity: number;
  }[];
  try {
    itemRows = requested.map((item) => {
      if (item.kind === "product") {
        const product = products.find((entry) => entry.id === item.id);
        if (!product?.is_active) throw new Error("Produto indisponível.");
        if (
          typeof item.price !== "number" ||
          Math.round(item.price * 100) !==
            Math.round(Number(product.price) * 100)
        )
          throw new Error("O preço mudou. Atualize o carrinho antes de pagar.");
        if (
          !Number.isFinite(Number(product.price)) ||
          Number(product.price) < 0
        )
          throw new Error("Preço inválido.");
        addStockNeed(product, item.quantity as number);
        return {
          product_id: product.id,
          combo_id: null,
          product_name: product.name,
          unit_price: Number(product.price),
          quantity: item.quantity as number,
        };
      }

      const combo = combos.find((entry) => entry.id === item.id);
      if (!combo || !comboIsLive(combo))
        throw new Error("Combo indisponível ou promoção encerrada.");
      if (
        typeof item.price !== "number" ||
        Math.round(item.price * 100) !== Math.round(Number(combo.price) * 100)
      )
        throw new Error("O preço do combo mudou. Atualize o carrinho.");
      if (!Number.isFinite(Number(combo.price)) || Number(combo.price) <= 0)
        throw new Error("Preço do combo inválido.");
      if (!combo.combo_items?.length)
        throw new Error("Este combo não possui produtos.");

      for (const comboItem of combo.combo_items) {
        const product = nestedProduct(comboItem.products);
        if (!product?.is_active)
          throw new Error(
            `Um produto do combo ${combo.name} não está disponível.`,
          );
        addStockNeed(
          product,
          Number(comboItem.quantity) * (item.quantity as number),
        );
      }

      return {
        product_id: null,
        combo_id: combo.id,
        product_name: combo.name,
        unit_price: Number(combo.price),
        quantity: item.quantity as number,
      };
    });

    for (const { product, quantity } of stockNeeds.values()) {
      if (!product.unlimited_stock && Number(product.stock) < quantity) {
        throw new Error(`Estoque insuficiente para ${product.name}.`);
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Item indisponível." },
      { status: 400 },
    );
  }

  let total =
    Math.round(
      itemRows.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) *
        100,
    ) / 100;
  if (total <= 0)
    return NextResponse.json(
      { error: "O total do pedido deve ser positivo." },
      { status: 400 },
    );

  const code = couponCode(body?.couponCode);
  if (code.length > 30)
    return NextResponse.json({ error: "Cupom inválido." }, { status: 400 });
  const rpcItems = itemRows.map((item) => ({
    id: item.combo_id ?? item.product_id,
    kind: item.combo_id ? "combo" : "product",
    quantity: item.quantity,
    unit_price: item.unit_price,
  }));
  const quote = await admin.rpc("quote_store_checkout", {
    p_user_id: user.id,
    p_items: rpcItems,
    p_code: code,
  });
  if (quote.error || !quote.data)
    return NextResponse.json(
      {
        error:
          quote.error?.code === "P0001"
            ? quote.error.message
            : "Não foi possível conferir os valores. Tente novamente.",
      },
      { status: 409 },
    );
  total = Number(quote.data.total);
  if (
    code &&
    (typeof body?.expectedTotal !== "number" ||
      Math.round(body.expectedTotal * 100) !== Math.round(total * 100))
  )
    return NextResponse.json(
      {
        error:
          "O desconto mudou. Aplique o cupom novamente para conferir o valor.",
      },
      { status: 409 },
    );
  const orderCode = `COSMIC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  try {
    const pixPayload = createPixPayload(total, orderCode);
    const { data: result, error: orderError } = await admin.rpc(
      "create_store_order_with_coupon",
      {
        p_user_id: user.id,
        p_checkout_token: token,
        p_nickname: nickname,
        p_order_code: orderCode,
        p_pix_payload: pixPayload,
        p_expected_total: total,
        p_code: code,
        p_items: itemRows.map((item) => ({
          id: item.combo_id ?? item.product_id,
          kind: item.combo_id ? "combo" : "product",
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      },
    );
    if (orderError || !result?.order) {
      if (orderError?.code === "P0001")
        return NextResponse.json(
          { error: orderError.message },
          { status: 409 },
        );
      throw orderError ?? new Error("Não foi possível criar o pedido.");
    }
    const order = result.order as CreatedOrder;
    if (!result.created) return orderResponse(order);

    await Promise.allSettled([
      createAdminNotifications(
        "Novo pedido recebido",
        `Pedido ${order.order_code} acabou de ser criado.`,
        `/admin/pedidos/${order.id}`,
        user.id,
      ),
      notifyAdminDiscord(
        `🛒 Novo pedido **${order.order_code}** — ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      ),
    ]);
    return orderResponse(order);
  } catch (error) {
    await recordStoreIssue("checkout",error,"/api/orders");
    console.error(
      "Falha no checkout:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    return NextResponse.json(
      {
        error:
          "Não foi possível criar o pedido. Tente novamente sem pagar duas vezes.",
      },
      { status: 500 },
    );
  }
}
