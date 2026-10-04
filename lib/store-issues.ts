import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
export function cleanIssueMessage(value: unknown) {
  return String(value instanceof Error ? value.message : value)
    .replace(
      /(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s]+/gi,
      "[endereço omitido]",
    )
    .replace(
      /\bBearer\s+\S+|\beyJ[A-Za-z0-9_.-]+|\bsb_secret_\S+/gi,
      "[credencial omitida]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail omitido]")
    .replace(
      /(?:password|token|secret|apikey|api_key)\s*[:=]\s*[^\s,;]+/gi,
      "[credencial omitida]",
    )
    .slice(0, 1000);
}
export async function recordStoreIssue(
  source: string,
  error: unknown,
  path: string,
) {
  try {
    const message = cleanIssueMessage(error) || "Falha sem detalhes";
    const safePath = path
      .split("?")[0]
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[id]")
      .slice(0, 200);
    const fingerprint = createHash("sha256")
      .update(source + "|" + safePath + "|" + message)
      .digest("hex");
    const { error: saveError } = await createAdminClient().rpc(
      "ops_record_issue",
      {
        p_fingerprint: fingerprint,
        p_source: source,
        p_path: safePath,
        p_message: message,
      },
    );
    if (saveError)
      console.error(
        "[diagnostico] Não foi possível registrar a ocorrência:",
        saveError.code,
      );
  } catch {
    console.error("[diagnostico] Registro indisponível.");
  }
}
export async function operationError(
  error: { code?: string; message?: string },
  path: string,
) {
  if (error.code === "P0001")
    return error.message ?? "Confira os dados e tente novamente.";
  await recordStoreIssue(
    "admin",
    error.message ?? error.code ?? "Falha no banco",
    path,
  );
  return "Não foi possível concluir. Confira o diagnóstico e a atualização SQL.";
}
