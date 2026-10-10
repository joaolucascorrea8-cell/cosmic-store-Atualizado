import AccountOrderPanel from "@/app/admin/robux/contas/AccountOrderPanel";
import DeliveryInstructions from "@/app/components/DeliveryInstructions";
import WorkPanel from "@/app/admin/components/WorkPanel";
import OrderDiscount from "@/app/components/OrderDiscount";
import CopyButton from "@/app/components/CopyButton";
import { localDate, UUID_PATTERN } from "@/lib/catalog";
import { requireAdmin } from "@/lib/require-admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrderChat from "@/app/pedidos/[id]/OrderChat";
import { orderStatus } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { withSignedChatAttachments } from "@/lib/chat-attachments";
import {
  resendOrderEmail,
  updateOrderChat,
} from "../actions";
import OrderStatusActions from "../OrderStatusActions";
import PendingButton from "../../components/PendingButton";
import RobuxStatusWatcher from "@/app/pedidos/[id]/RobuxStatusWatcher";
import { executeRobuxOrder } from "@/app/admin/robux/actions";
import { getByRobuxBalance, getByRobuxRates } from "@/lib/byrobux";
import { effectiveMarginPerThousand } from "@/lib/robux-pricing";
import { getRobuxSettings } from "@/lib/robux-settings";

type RobuxOrderRow = {
  mode: string;
  requested_robux: number;
  gamepass_robux: number;
  net_robux: number;
  gamepass_url: string;
  quoted_supplier_k: number;
  quoted_cosmic_k: number;
  quoted_supplier_cost: number;
  supplier_batch_id: string | null;
  supplier_order_id: string | null;
  supplier_status: string;
  supplier_rate_at_execute: number | null;
  supplier_cost_at_execute: number | null;
  supplier_error_message: string | null;
  executed_at: string | null;
  completed_at: string | null;
};
type AuditEvent = {
  id: string;
  admin_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};
type Delivery = {
  id: string;
  title: string;
  channel: string;
  status: string;
  error_message: string | null;
  created_at: string;
};
function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const actionLabels: Record<string, string> = {
  "account:credentials_saved": "Dados da conta salvos com segurança",
  "account:manual_acquisition": "Aquisição manual da conta registrada",
  "status:paid": "Pagamento confirmado",
  "status:preparing_delivery": "Preparação da entrega iniciada",
  "status:proof_rejected": "Comprovante recusado",
  "status:cancelled": "Pedido cancelado",
  "status:delivered": "Pedido marcado como entregue",
  "auto:unpaid_closed": "Encerrado automaticamente sem comprovante",
  "chat:open": "Atendimento reaberto",
  "chat:close": "Atendimento encerrado",
};

export const maxDuration = 300;

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "*,order_items(product_name,unit_price,quantity,delivery_instructions),profiles(nickname),robux_orders(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) notFound();
  const [{ data: messages }, { data: events }, { data: deliveries }] =
    await Promise.all([
      admin
        .from("order_messages")
        .select(
          "id,user_id,message,created_at,attachment_path,attachment_name,attachment_type,profiles(nickname,avatar_url)",
        )
        .eq("order_id", id)
        .order("created_at"),
      admin
        .from("order_admin_events")
        .select("id,admin_id,action,details,created_at")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("notification_deliveries")
        .select("id,title,channel,status,error_message,created_at")
        .eq("link", `/pedidos/${id}`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
  const signedMessages = await withSignedChatAttachments(messages ?? []);
  const adminIds = [
    ...new Set(((events ?? []) as AuditEvent[]).map((event) => event.admin_id)),
  ];
  const { data: adminProfiles } = adminIds.length
    ? await admin.from("profiles").select("id,nickname").in("id", adminIds)
    : { data: [] };
  const adminNames = new Map(
    (adminProfiles ?? []).map((profile) => [profile.id, profile.nickname]),
  );
  let proofUrl: string | null = null;
  if (order.proof_path) {
    const { data } = await admin.storage
      .from("payment-proofs")
      .createSignedUrl(order.proof_path, 600);
    proofUrl = data?.signedUrl ?? null;
  }
  const robuxOrder = relation(order.robux_orders as RobuxOrderRow | RobuxOrderRow[] | null);
  const isRobux = order.order_type === "robux" && Boolean(robuxOrder);
  let supplierOverview: { rate: number; balance: number } | null = null;
  let minRobuxMargin = 7;
  if (isRobux) {
    try {
      const [rates, balance, robuxSettings] = await Promise.all([
        getByRobuxRates(),
        getByRobuxBalance(),
        getRobuxSettings(),
      ]);
      minRobuxMargin = robuxSettings.minMarginPerThousand;
      supplierOverview = {
        rate: Number(rates.robuxRateBrlPerThousand),
        balance: Number(balance.balanceBrl),
      };
    } catch {}
  }
  const status = orderStatus[order.status] ?? {
    label: order.status,
    className: "",
  };
  const chatAvailable = ["paid", "preparing_delivery", "delivered"].includes(
    order.status,
  );
  const canSend = chatAvailable && !order.chat_closed_at;
  const supplierStatus = isRobux ? String(robuxOrder?.supplier_status ?? "NOT_STARTED") : "";
  const buttons: string[][] =
    order.status === "proof_submitted" || order.status === "under_review"
      ? [
          ["paid", "Confirmar pagamento"],
          ["proof_rejected", "Recusar comprovante"],
          ["cancelled", "Cancelar pedido"],
        ]
      : order.status === "paid"
        ? isRobux
          ? [["cancelled", "Cancelar pedido"]]
          : [
              ["preparing_delivery", "Iniciar preparação"],
              ["cancelled", "Cancelar pedido"],
            ]
        : order.status === "preparing_delivery"
          ? isRobux
            ? ["PENDING", "COMPLETED"].includes(supplierStatus)
              ? []
              : [["cancelled", "Cancelar pedido"]]
            : [
                ["delivered", order.order_type === "robux_account" ? "Liberar conta e concluir entrega" : "Marcar como entregue"],
                ["cancelled", "Cancelar pedido"],
              ]
          : order.status === "awaiting_payment" ||
              order.status === "proof_rejected"
            ? [["cancelled", "Cancelar pedido"]]
            : [];
  const canRetryPaymentEmail =
    ["paid", "preparing_delivery", "delivered"].includes(order.status) &&
    !order.payment_email_sent_at;
  const canRetryDeliveryEmail =
    order.status === "delivered" && !order.delivery_email_sent_at;
  return (
    <main
      id="conteudo-principal"
      tabIndex={-1}
      className="min-h-screen bg-[#080812] px-4 py-6 text-white sm:p-6"
    >
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/pedidos"
          className="inline-flex min-h-11 items-center text-sm font-bold text-zinc-300"
        >
          ← Todos os pedidos
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-violet-400">Pedido</p>
            <h1 className="break-all text-2xl font-black sm:text-3xl">
              {order.order_code}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Cliente: {order.profiles?.nickname ?? "Cliente"} • Nick:{" "}
              {order.game_nickname}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={order.game_nickname} label="Copiar nickname" />
              <CopyButton value={order.order_code} label="Copiar código" />
            </div>
            {order.delivery_due_at &&
              !["delivered", "cancelled"].includes(order.status) && (
                <p className="mt-1 text-sm text-amber-300">
                  Prazo: {localDate(order.delivery_due_at)}
                </p>
              )}
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <section className="mt-7 rounded-2xl border border-white/10 bg-[#111122] p-4 sm:p-6">
          <div className="space-y-3">
            {order.order_items?.map(
              (
                item: {
                  product_name: string;
                  unit_price: number;
                  quantity: number;
                },
                index: number,
              ) => (
                <div key={index} className="flex justify-between gap-4">
                  <span>
                    {item.quantity}× {item.product_name}
                  </span>
                  <strong className="shrink-0">
                    {(Number(item.unit_price) * item.quantity).toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" },
                    )}
                  </strong>
                </div>
              ),
            )}
          </div>
          <div className="my-5 border-t border-white/10" />
          <OrderDiscount
            subtotal={order.subtotal}
            discount={order.discount_total}
            code={order.coupon_code}
          />
          <div className="flex justify-between text-xl">
            <strong>Total</strong>
            <strong>
              {Number(order.total).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </div>
          {proofUrl && (
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-sky-600 px-5 font-bold"
            >
              Abrir comprovante
            </a>
          )}
        </section>
        {order.order_type === "robux_account" && <AccountOrderPanel orderId={id} status={order.status} />}
        {isRobux && robuxOrder && (
          <section className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/[.055] p-4 sm:p-6">
            {supplierStatus === "PENDING" && (
              <RobuxStatusWatcher orderId={id} initialSupplierStatus={supplierStatus} />
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Entrega automática · ByRobux</p>
                <h2 className="mt-1 text-xl font-black">Pedido de Robux</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${supplierStatus === "COMPLETED" ? "bg-emerald-500/15 text-emerald-300" : supplierStatus === "PENDING" ? "bg-violet-500/15 text-violet-200" : supplierStatus === "CANCELLED" || supplierStatus === "FAILED" ? "bg-red-500/15 text-red-300" : "bg-white/10 text-zinc-300"}`}>
                {supplierStatus === "NOT_STARTED" ? "Aguardando execução" : supplierStatus === "PENDING" ? "Processando" : supplierStatus === "COMPLETED" ? "GamePass comprado" : supplierStatus === "CANCELLED" ? "Cancelado pelo fornecedor" : "Falha"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">Opção</p><strong className="mt-1 block text-sm">{robuxOrder.mode === "tax_paid" ? "Taxa paga" : "Sem taxa paga"}</strong></div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">GamePass</p><strong className="mt-1 block text-sm">{Number(robuxOrder.gamepass_robux).toLocaleString("pt-BR")} Robux</strong></div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">Cliente recebe</p><strong className="mt-1 block text-sm">≈ {Number(robuxOrder.net_robux).toLocaleString("pt-BR")} Robux</strong></div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">K vendido</p><strong className="mt-1 block text-sm">R$ {Number(robuxOrder.quoted_cosmic_k).toFixed(2).replace(".", ",")}</strong></div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={String(robuxOrder.gamepass_url)} target="_blank" rel="noreferrer" className="btn-secondary">Abrir GamePass ↗</a>
              <CopyButton value={String(robuxOrder.gamepass_url)} label="Copiar link" />
            </div>

            {supplierOverview && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-zinc-500">K atual fornecedor</p><strong className="mt-1 block">R$ {supplierOverview.rate.toFixed(2).replace(".", ",")}</strong></div>
                <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-zinc-500">Saldo ByRobux</p><strong className="mt-1 block">{supplierOverview.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
                <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-zinc-500">Custo atual estimado</p><strong className="mt-1 block">{((Number(robuxOrder.gamepass_robux) / 1000) * supplierOverview.rate).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
                <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-zinc-500">Margem atual / 1K</p><strong className={`mt-1 block ${effectiveMarginPerThousand(Number(order.total), Number(robuxOrder.gamepass_robux), supplierOverview.rate) >= minRobuxMargin ? "text-emerald-300" : "text-amber-300"}`}>R$ {effectiveMarginPerThousand(Number(order.total), Number(robuxOrder.gamepass_robux), supplierOverview.rate).toFixed(2).replace(".", ",")}</strong></div>
              </div>
            )}

            {robuxOrder.supplier_error_message && (
              <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{String(robuxOrder.supplier_error_message)}</p>
            )}

            {["paid", "preparing_delivery"].includes(order.status) && !["PENDING", "COMPLETED"].includes(supplierStatus) && (
              <form action={executeRobuxOrder} className="mt-5">
                <input type="hidden" name="order_id" value={id} />
                <PendingButton
                  confirm={supplierStatus === "CANCELLED" ? "Tentar a compra novamente na ByRobux?" : "Comprar este GamePass usando seu saldo da ByRobux?"}
                  className="min-h-11 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black hover:bg-violet-500"
                >
                  {supplierStatus === "CANCELLED" || supplierStatus === "FAILED" ? "Tentar novamente" : "Comprar e entregar"}
                </PendingButton>
                <p className="mt-2 text-xs leading-5 text-zinc-500">Antes de executar, a Cosmic confere novamente K, margem, GamePass e saldo. Se algo estiver fora dos limites, a compra é bloqueada.</p>
              </form>
            )}
            {supplierStatus === "PENDING" && (
              <p className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm text-violet-100">Compra enviada. O status é consultado automaticamente enquanto esta página ou a página do cliente estiver aberta.</p>
            )}
            {supplierStatus === "COMPLETED" && (
              <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">GamePass comprado com sucesso. Os Robux agora ficam sujeitos ao período de pendência do Roblox.</p>
            )}
          </section>
        )}

        {buttons.length > 0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-[#111122] p-4 sm:p-6">
            <h2 className="font-black">Atualizar pedido</h2>
            {buttons.some(([value]) => value === "delivered") && (
              <p className="mt-2 text-sm text-amber-200">
                {order.order_type === "robux_account"
                  ? "Salve o usuário e a senha na seção Dados da conta. Ao marcar como entregue, o cliente poderá consultar os dados no pedido; o e-mail envia apenas o aviso de entrega."
                  : "Antes de marcar como entregue, envie a print da entrega no chat abaixo. Ela será anexada ao e-mail final do cliente."}
              </p>
            )}
            <OrderStatusActions
              key={`${id}:${order.status}`}
              orderId={id}
              status={order.status}
              buttons={buttons}
            />
          </section>
        )}
        {(canRetryPaymentEmail || canRetryDeliveryEmail) && (
          <section className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 sm:p-5">
            <h2 className="font-black text-amber-100">E-mail pendente</h2>
            <p className="mt-1 text-sm text-amber-100/70">
              O pedido está atualizado, mas um e-mail automático ainda não foi
              registrado como enviado. Você pode tentar novamente.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canRetryPaymentEmail && (
                <form action={resendOrderEmail}>
                  <input type="hidden" name="order_id" value={id} />
                  <input type="hidden" name="email_kind" value="payment" />
                  <PendingButton className="min-h-11 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-black">
                    Reenviar e-mail de pagamento
                  </PendingButton>
                </form>
              )}
              {canRetryDeliveryEmail && (
                <form action={resendOrderEmail}>
                  <input type="hidden" name="order_id" value={id} />
                  <input type="hidden" name="email_kind" value="delivery" />
                  <PendingButton className="min-h-11 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-black">
                    Reenviar e-mail de entrega
                  </PendingButton>
                </form>
              )}
            </div>
          </section>
        )}
        <WorkPanel id={id} kind="order" />
        <DeliveryInstructions items={order.order_items ?? []} />
        {chatAvailable && (
          <>
            <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111122] p-5">
              <div>
                <h2 className="font-black">Atendimento do pedido</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {canSend
                    ? "Chat aberto para a equipe e o cliente."
                    : "Chat encerrado; o histórico segue visível."}
                </p>
              </div>
              <form action={updateOrderChat}>
                <input type="hidden" name="order_id" value={id} />
                <input
                  type="hidden"
                  name="chat_action"
                  value={canSend ? "close" : "open"}
                />
                <PendingButton
                  className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold ${canSend ? "bg-zinc-700" : "bg-violet-600"}`}
                >
                  {canSend ? "Encerrar atendimento" : "Reabrir atendimento"}
                </PendingButton>
              </form>
            </section>
            <OrderChat
              orderId={id}
              userId={user.id}
              initialMessages={signedMessages as never[]}
              canSend={canSend}
              isAdmin
            />
          </>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#111122] p-5">
            <h2 className="font-black">Histórico administrativo</h2>
            <div className="mt-4 space-y-3">
              {(events as AuditEvent[] | null)?.length ? (
                (events as AuditEvent[]).map((event) => (
                  <div
                    key={event.id}
                    className="border-l-2 border-violet-500/50 pl-3"
                  >
                    <p className="text-sm font-bold">
                      {actionLabels[event.action] ?? event.action}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {adminNames.get(event.admin_id) ?? "Administrador"} •{" "}
                      {localDate(event.created_at)}
                    </p>
                    {typeof event.details?.rejection_reason === "string" && (
                      <p className="mt-1 text-xs text-red-200">
                        {event.details.rejection_reason}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">
                  Nenhuma alteração registrada ainda.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#111122] p-5">
            <h2 className="font-black">Entrega de avisos</h2>
            <div className="mt-4 space-y-3">
              {(deliveries as Delivery[] | null)?.length ? (
                (deliveries as Delivery[]).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-bold capitalize">
                        {delivery.channel === "site"
                          ? "Notificação no site"
                          : delivery.channel}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-300">
                        {delivery.title}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {localDate(delivery.created_at)}
                      </p>
                      {delivery.error_message && (
                        <p
                          className="mt-1 line-clamp-2 text-xs text-red-300"
                          title={delivery.error_message}
                        >
                          {delivery.error_message}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${delivery.status === "sent" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
                    >
                      {delivery.status === "sent" ? "Enviado" : "Falhou"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">
                  Nenhum aviso registrado ainda.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
