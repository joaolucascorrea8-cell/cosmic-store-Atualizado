"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateByRobux,
  executeByRobux,
  friendlyByRobuxError,
  getByRobuxBalance,
} from "@/lib/byrobux";
import { getRobuxSettings } from "@/lib/robux-settings";
import { effectiveMarginPerThousand } from "@/lib/robux-pricing";
import { notifyCustomer } from "@/lib/notifications";
import { UUID_PATTERN } from "@/lib/catalog";

export type RobuxSettingsState = { error?: string; success?: string };

function numberField(form: FormData, name: string) {
  const raw = String(form.get(name) ?? "").replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function saveRobuxSettings(
  _state: RobuxSettingsState,
  form: FormData,
): Promise<RobuxSettingsState> {
  const user = await requireAdmin();
  const minCosmicK = numberField(form, "min_cosmic_k");
  const margin = numberField(form, "margin_per_thousand");
  const maxSupplierK = numberField(form, "max_supplier_k");
  const minMargin = numberField(form, "min_margin_per_thousand");
  const pendingMin = numberField(form, "pending_days_min");
  const pendingMax = numberField(form, "pending_days_max");
  const tutorialUrl = String(form.get("tutorial_url") ?? "").trim();
  if (
    minCosmicK === null ||
    margin === null ||
    maxSupplierK === null ||
    minMargin === null ||
    minCosmicK <= 0 ||
    margin < 0 ||
    maxSupplierK <= 0 ||
    minMargin < 0
  )
    return { error: "Confira os valores de K e margem." };
  if (
    pendingMin === null ||
    pendingMax === null ||
    !Number.isInteger(pendingMin) ||
    !Number.isInteger(pendingMax) ||
    pendingMin < 1 ||
    pendingMax > 30 ||
    pendingMax < pendingMin
  )
    return { error: "Informe um prazo válido entre 1 e 30 dias." };
  if (tutorialUrl.length > 500)
    return { error: "O link do tutorial pode ter até 500 caracteres." };
  if (tutorialUrl && !/^https?:\/\//i.test(tutorialUrl))
    return { error: "O tutorial precisa usar um link http ou https." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("robux_settings")
    .update({
      enabled: form.get("enabled") === "on",
      min_cosmic_k: minCosmicK,
      margin_per_thousand: margin,
      max_supplier_k: maxSupplierK,
      min_margin_per_thousand: minMargin,
      tutorial_url: tutorialUrl,
      pending_days_min: pendingMin,
      pending_days_max: pendingMax,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    console.error("[admin/robux/settings]", error);
    return {
      error:
        "Não foi possível salvar. Confira se a migration de Robux foi aplicada.",
    };
  }
  revalidatePath("/robux");
  revalidatePath("/admin/robux");
  return { success: "Configurações de Robux salvas." };
}

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function executeRobuxOrder(formData: FormData) {
  const user = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  if (!UUID_PATTERN.test(orderId)) throw new Error("Pedido inválido.");

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id,user_id,order_code,status,total,order_type,robux_orders(order_id,gamepass_url,gamepass_robux,supplier_request_id,supplier_batch_id,supplier_status,executed_by)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order || order.order_type !== "robux")
    throw new Error("Pedido de Robux não encontrado.");
  if (!["paid", "preparing_delivery"].includes(order.status))
    throw new Error("Confirme o pagamento antes de comprar o GamePass.");

  const details = relation(order.robux_orders);
  if (!details) throw new Error("Detalhes do pedido de Robux não encontrados.");
  if (details.supplier_status === "COMPLETED") return;
  if (details.supplier_status === "PENDING")
    throw new Error("Este pedido já está sendo processado pela ByRobux.");

  const settings = await getRobuxSettings();
  if (!settings.enabled)
    throw new Error("As compras de Robux estão pausadas nas configurações.");

  try {
    const quote = await calculateByRobux(details.gamepass_url);
    const item = quote.items?.[0];
    if (!item || item.error || Number(item.robux) !== Number(details.gamepass_robux))
      throw new Error(
        "O GamePass mudou ou não pôde ser validado. Confira o link antes de executar.",
      );
    const supplierK = Number(quote.rateBrlPerThousand);
    if (!Number.isFinite(supplierK) || supplierK <= 0)
      throw new Error("A ByRobux retornou uma cotação inválida.");
    if (supplierK > settings.maxSupplierK)
      throw new Error(
        `K atual ${supplierK.toLocaleString("pt-BR")}. O limite configurado é ${settings.maxSupplierK.toLocaleString("pt-BR")}.`,
      );
    const margin = effectiveMarginPerThousand(
      Number(order.total),
      Number(details.gamepass_robux),
      supplierK,
    );
    if (margin < settings.minMarginPerThousand)
      throw new Error(
        `Margem atual de R$ ${margin.toFixed(2).replace(".", ",")} por 1K está abaixo do mínimo de R$ ${settings.minMarginPerThousand.toFixed(2).replace(".", ",")}.`,
      );

    const balance = await getByRobuxBalance();
    if (Number(balance.balanceBrl) + 0.001 < Number(item.priceBrl))
      throw new Error(
        `Saldo ByRobux insuficiente. Disponível: ${Number(balance.balanceBrl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; custo atual: ${Number(item.priceBrl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      );

    // A trava e a chave idempotente são persistidas ANTES da chamada externa.
    // Após timeout, recuperar usa a mesma chave; CANCELLED só gira a chave sob lock.
    const { data: claimed, error: claimError } = await admin.rpc("claim_gamepass_execution", {
      p_order_id: orderId, p_admin_id: user.id, p_expected_request: details.supplier_request_id,
    });
    if (claimError || !claimed?.supplier_request_id) throw new Error(claimError?.code === "P0001" ? claimError.message : "Não foi possível reservar a tentativa de compra.");
    const requestId = String(claimed.supplier_request_id);
    const execution = await executeByRobux({ requestId, links: [details.gamepass_url] });
    const { data: transition, error: saveError } = await admin.rpc("finish_gamepass_execution", {
      p_order_id: orderId, p_admin_id: user.id, p_request: requestId,
      p_batch: execution.batchId, p_rate: supplierK, p_cost: Number(item.priceBrl),
    });
    if (saveError) throw new Error("O envio pode ter sido aceito. Recupere a mesma tentativa antes de cancelar ou iniciar outra compra.");
    if (transition?.changed) {
      await notifyCustomer(order.user_id, "Compra do GamePass iniciada",
        `A compra do GamePass do pedido ${order.order_code} foi enviada para processamento.`,
        `/pedidos/${orderId}`).catch(() => undefined);
    }
  } catch (error) {
    const message = friendlyByRobuxError(error);
    await admin
      .from("robux_orders")
      .update({
        supplier_error_code:
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code ?? "") || null
            : null,
        supplier_error_message: message.slice(0, 500),
        last_checked_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    // Erros esperados da integração (saldo insuficiente, K/margem fora
    // do limite, GamePass alterado, indisponibilidade do fornecedor etc.)
    // são mostrados dentro do próprio pedido. Não relançamos a exceção,
    // pois isso fazia o Next/React abrir a tela genérica de erro 441.
    console.warn(`[robux-order] Execução bloqueada para ${orderId}: ${message}`);
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath(`/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    return;
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
}
