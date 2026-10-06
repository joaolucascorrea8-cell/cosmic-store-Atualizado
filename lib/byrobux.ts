import "server-only";

export type ByRobuxRateResponse = {
  robuxRateBrlPerThousand: number;
  dollarRateBrl: number;
  additionalUsdPerThousandRobux: number;
  catalogMaintenance: boolean;
  maintenanceMessage: string | null;
};

export type ByRobuxCalculateItem = {
  id: string;
  link: string;
  robux: number;
  username: string | null;
  error: boolean;
};

export type ByRobuxCalculateResponse = {
  items: Array<ByRobuxCalculateItem & { priceBrl: number }>;
  rateBrlPerThousand: number;
};

export type ByRobuxBalanceResponse = {
  balanceBrlCents: number;
  balanceBrl: number;
};

export type ByRobuxOrder = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | string;
  amount: number;
  rate: number;
  batchId: string;
  createdAt: string;
};

export type RobloxGamePassCreator = {
  name: string;
  type: "User" | "Group" | "Unknown";
  targetId: string | null;
  source: "byrobux" | "roblox" | "fallback";
};

function cleanCreatorName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCreatorType(value: unknown): RobloxGamePassCreator["type"] {
  const type = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (type === "user") return "User";
  if (type === "group") return "Group";
  return "Unknown";
}

export function normalizeByRobuxUsername(value: unknown) {
  const username = cleanCreatorName(value);
  return username || "Identificada pelo GamePass";
}

export async function resolveGamePassCreator({
  gamePassId,
  byRobuxUsername,
}: {
  gamePassId: unknown;
  byRobuxUsername: unknown;
}): Promise<RobloxGamePassCreator> {
  const supplierName = cleanCreatorName(byRobuxUsername);
  if (supplierName) {
    return {
      name: supplierName,
      type: "Unknown",
      targetId: null,
      source: "byrobux",
    };
  }

  const id = typeof gamePassId === "string" ? gamePassId.trim() : String(gamePassId ?? "").trim();
  if (!/^\d{1,20}$/.test(id)) {
    return {
      name: "Identificada pelo GamePass",
      type: "Unknown",
      targetId: null,
      source: "fallback",
    };
  }

  try {
    const response = await fetch(
      `https://apis.roblox.com/game-passes/v1/game-passes/${encodeURIComponent(id)}/product-info`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      console.warn(
        `[roblox/gamepass] Não foi possível consultar o criador do GamePass ${id}: HTTP ${response.status}.`,
      );
      return {
        name: "Identificada pelo GamePass",
        type: "Unknown",
        targetId: null,
        source: "fallback",
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          Creator?: {
            Name?: unknown;
            CreatorType?: unknown;
            CreatorTargetId?: unknown;
            Id?: unknown;
          };
          creator?: {
            name?: unknown;
            creatorType?: unknown;
            creatorTargetId?: unknown;
            id?: unknown;
          };
        }
      | null;

    const creator = payload?.Creator;
    const creatorLower = payload?.creator;
    const name =
      cleanCreatorName(creator?.Name) || cleanCreatorName(creatorLower?.name);
    if (!name) {
      return {
        name: "Identificada pelo GamePass",
        type: "Unknown",
        targetId: null,
        source: "fallback",
      };
    }

    const rawTargetId =
      creator?.CreatorTargetId ??
      creatorLower?.creatorTargetId ??
      creator?.Id ??
      creatorLower?.id ??
      null;

    return {
      name,
      type: normalizeCreatorType(
        creator?.CreatorType ?? creatorLower?.creatorType,
      ),
      targetId:
        rawTargetId === null || rawTargetId === undefined
          ? null
          : String(rawTargetId),
      source: "roblox",
    };
  } catch (error) {
    console.warn(
      `[roblox/gamepass] Falha ao consultar o criador do GamePass ${id}.`,
      error,
    );
    return {
      name: "Identificada pelo GamePass",
      type: "Unknown",
      targetId: null,
      source: "fallback",
    };
  }
}

export class ByRobuxApiError extends Error {
  status: number;
  code: string | null;
  retryAfter: string | null;

  constructor({
    message,
    status,
    code,
    retryAfter,
  }: {
    message: string;
    status: number;
    code?: string | null;
    retryAfter?: string | null;
  }) {
    super(message);
    this.name = "ByRobuxApiError";
    this.status = status;
    this.code = code ?? null;
    this.retryAfter = retryAfter ?? null;
  }
}

function apiConfig() {
  const apiKey = process.env.BYROBUX_API_KEY?.trim();
  const base = (
    process.env.BYROBUX_API_BASE_URL?.trim() || "https://byrobux.net/api/v1"
  ).replace(/\/+$/, "");
  if (!apiKey) throw new Error("BYROBUX_API_KEY não configurada no servidor.");
  return { apiKey, base };
}

async function requestByRobux<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const { apiKey, base } = apiConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey)
    headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ByRobuxApiError({
      status: 503,
      code: "NETWORK_ERROR",
      message:
        error instanceof Error
          ? `Não foi possível conectar ao fornecedor: ${error.message}`
          : "Não foi possível conectar ao fornecedor.",
    });
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; code?: string }
    | T
    | null;
  if (!response.ok) {
    const apiError = payload as { error?: string; code?: string } | null;
    throw new ByRobuxApiError({
      status: response.status,
      code: apiError?.code ?? null,
      retryAfter: response.headers.get("Retry-After"),
      message: apiError?.error ?? `Fornecedor retornou HTTP ${response.status}.`,
    });
  }
  if (payload === null) {
    throw new ByRobuxApiError({
      status: 502,
      code: "INVALID_RESPONSE",
      message: "Resposta inválida do fornecedor.",
    });
  }
  return payload as T;
}

export function getByRobuxRates() {
  return requestByRobux<ByRobuxRateResponse>("/rates");
}

export function getByRobuxBalance() {
  return requestByRobux<ByRobuxBalanceResponse>("/balance");
}

export function calculateByRobux(links: string) {
  return requestByRobux<ByRobuxCalculateResponse>("/quick-buy/calculate", {
    method: "POST",
    body: { links },
  });
}

export async function executeByRobux({
  requestId,
  links,
}: {
  requestId: string;
  links: string[];
}) {
  return requestByRobux<{ batchId: string }>("/quick-buy/execute", {
    method: "POST",
    idempotencyKey: requestId,
    body: { requestId, links },
  });
}

export function listByRobuxOrders(page = 1, limit = 50) {
  return requestByRobux<{
    orders: ByRobuxOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/orders?page=${page}&limit=${limit}`);
}

export async function findByRobuxOrderByBatchId(batchId: string) {
  const first = await listByRobuxOrders(1, 50);
  return first.orders.find((order) => order.batchId === batchId) ?? null;
}

export function friendlyByRobuxError(error: unknown) {
  if (!(error instanceof ByRobuxApiError))
    return error instanceof Error
      ? error.message
      : "Não foi possível falar com o fornecedor.";
  switch (error.code) {
    case "INSUFFICIENT_BALANCE":
      return "Saldo insuficiente na ByRobux para concluir esta compra.";
    case "BANNED":
      return "A conta vinculada à API da ByRobux está suspensa.";
    case "NO_VALID_ITEMS":
      return "O link informado não é um GamePass válido.";
    case "PRICE_CHANGED":
      return "O preço mudou na ByRobux. Atualize a cotação e tente novamente.";
    case "PRICE_VALIDATION_FAILED":
      return "A ByRobux não conseguiu validar o preço do GamePass. Tente novamente.";
    case "CONFIG_UNAVAILABLE":
      return "A ByRobux está temporariamente indisponível.";
    case "LOCK_TIMEOUT":
      return "A ByRobux ainda está processando outra operação. Tente novamente em instantes.";
    default:
      if (error.status === 429)
        return "Muitas consultas em pouco tempo. Aguarde alguns segundos e tente novamente.";
      return error.message || "Não foi possível concluir a operação na ByRobux.";
  }
}
