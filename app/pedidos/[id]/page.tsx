import DeliveryInstructions from "@/app/components/DeliveryInstructions";
import OrderDiscount from "@/app/components/OrderDiscount";
import RepurchaseButton from "./RepurchaseButton";
import { deliveryText } from "@/lib/store-service";
import Link from "next/link";
import CopyButton from "@/app/components/CopyButton";
import { localDate, UUID_PATTERN } from "@/lib/catalog";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import NotificationReadMarker from "@/app/components/NotificationReadMarker";
import { createClient } from "@/lib/supabase/server";
import { withSignedChatAttachments } from "@/lib/chat-attachments";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
import { orderStatus } from "@/lib/order-status";
import OrderChat from "./OrderChat";
import FeedbackForm from "./FeedbackForm";
import ProofReuploadForm from "./ProofReuploadForm";
import OrderStatusWatcher from "./OrderStatusWatcher";
import OrderProgress from "./OrderProgress";
import RobuxStatusWatcher from "./RobuxStatusWatcher";

type RobuxOrderRow = {
  mode: string;
  requested_robux: number;
  gamepass_robux: number;
  net_robux: number;
  fee_robux?: number;
  gamepass_url: string;
  gamepass_id: string;
  roblox_username: string;
  quoted_cosmic_k: number;
  supplier_status: string;
  supplier_error_message: string | null;
  executed_at: string | null;
  completed_at: string | null;
};
function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/pedidos/${id}`);

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id,order_code,status,total,subtotal,discount_total,coupon_code,delivery_hours,game_nickname,created_at,paid_at,delivered_at,delivery_due_at,chat_closed_at,rejection_reason,payment_email_sent_at,delivery_email_sent_at,order_type,order_items(product_name,unit_price,quantity,delivery_instructions),robux_orders(mode,requested_robux,gamepass_robux,net_robux,gamepass_url,gamepass_id,roblox_username,quoted_cosmic_k,supplier_status,supplier_error_message,executed_at,completed_at)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) notFound();

  const isAccount = order.order_type === "robux_account";
  const { data: accountDetails } = isAccount ? await supabase.from("robux_account_order_details").select("robux,cosmic_k,sale_price,fulfillment_status").eq("order_id", id).maybeSingle() : { data: null };
  const robuxOrder = relation(order.robux_orders as RobuxOrderRow | RobuxOrderRow[] | null);
  const isRobux = order.order_type === "robux" && Boolean(robuxOrder);
  const supplierStatus = robuxOrder?.supplier_status ?? "";
  const status = isAccount && ["paid", "preparing_delivery"].includes(order.status)
    ? { label: accountDetails?.fulfillment_status === "review" ? "Entrega em revisão" : accountDetails?.fulfillment_status === "acquired" ? "Conta em preparação" : "Aguardando aquisição da conta", className: "text-violet-200 bg-violet-500/10" }
    : isRobux
    ? supplierStatus === "COMPLETED" || order.status === "delivered"
      ? { label: "GamePass comprado", className: "text-emerald-300 bg-emerald-500/10" }
      : supplierStatus === "PENDING"
        ? { label: "Comprando GamePass", className: "text-violet-200 bg-violet-500/10" }
        : supplierStatus === "CANCELLED" || supplierStatus === "FAILED"
          ? { label: "Entrega em revisão", className: "text-amber-200 bg-amber-500/10" }
          : orderStatus[order.status] ?? { label: order.status, className: "bg-white/5 text-zinc-300" }
    : orderStatus[order.status] ?? {
        label: order.status,
        className: "bg-white/5 text-zinc-300",
      };
  const maskEmail = (email?: string | null) => {
    if (!email) return "seu e-mail";
    const [local, domain] = email.split("@");
    if (!domain) return "seu e-mail";
    return `${local.slice(0, 2)}${"*".repeat(Math.max(3, Math.min(6, local.length - 2)))}@${domain}`;
  };
  const maskedEmail = maskEmail(user.email);
  const chatAvailable = ["paid", "preparing_delivery", "delivered"].includes(
    order.status,
  );
  const canSend = chatAvailable && !order.chat_closed_at;
  const { data: messages } = chatAvailable
    ? await supabase
        .from("order_messages")
        .select(
          "id,user_id,message,created_at,attachment_path,attachment_name,attachment_type,profiles(nickname,avatar_url)",
        )
        .eq("order_id", id)
        .order("created_at")
    : { data: [] };
  const signedMessages = chatAvailable
    ? await withSignedChatAttachments(messages ?? [])
    : [];
  const { data: rawFeedback } =
    order.status === "delivered"
      ? await supabase
          .from("feedbacks")
          .select("rating,comment,attachment_path")
          .eq("order_id", id)
          .maybeSingle()
      : { data: null };
  const feedback = rawFeedback
    ? (await withSignedReviewAttachments([rawFeedback]))[0]
    : null;

  return (
    <>
      <SiteHeader />
      <NotificationReadMarker
        userId={user.id}
        scope="orders"
        link={`/pedidos/${id}`}
      />
      <OrderStatusWatcher
        orderId={id}
        initialStatus={order.status}
        initialChatClosedAt={order.chat_closed_at}
      />
      {isRobux && supplierStatus === "PENDING" && (
        <RobuxStatusWatcher orderId={id} initialSupplierStatus={supplierStatus} />
      )}
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell min-h-[70vh] py-12"
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/pedidos"
            className="mb-6 inline-block text-sm text-zinc-400 hover:text-white"
          >
            ← Meus pedidos
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">
                Pedido
              </p>
              <h1 className="mt-2 text-3xl font-black">{order.order_code}</h1>
              <p className="mt-2 text-sm text-zinc-500">
                Criado em {localDate(order.created_at)}
              </p>
              {order.delivery_due_at &&
                !["delivered", "cancelled"].includes(order.status) && (
                  <p className="mt-1 text-sm text-amber-300">
                    Entrega prevista até {localDate(order.delivery_due_at)}.
                  </p>
                )}
            </div>
            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          {isRobux && robuxOrder ? (
            <div className="mt-7 grid grid-cols-3 gap-2 text-center text-[11px] font-bold sm:text-xs">
              <div className={`rounded-xl border p-3 ${["paid", "preparing_delivery", "delivered"].includes(order.status) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[.02] text-zinc-500"}`}>Pagamento</div>
              <div className={`rounded-xl border p-3 ${["PENDING", "COMPLETED"].includes(supplierStatus) ? "border-violet-500/30 bg-violet-500/10 text-violet-200" : "border-white/10 bg-white/[.02] text-zinc-500"}`}>GamePass</div>
              <div className={`rounded-xl border p-3 ${supplierStatus === "COMPLETED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[.02] text-zinc-500"}`}>Robux pendentes</div>
            </div>
          ) : (
            <OrderProgress status={order.status} />
          )}
          {order.delivery_hours && !isRobux && (
            <p className="mt-3 text-xs text-zinc-400">
              {deliveryText(order.delivery_hours)}
            </p>
          )}

          <section className="mt-8 rounded-2xl border border-white/10 bg-[#121017] p-6">
            <div className="flex justify-between">
              <span className="text-zinc-400">Nickname no jogo</span>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <strong className="break-all">{order.game_nickname}</strong>
                <CopyButton value={order.game_nickname} label="Copiar nick" />
              </div>
            </div>
            <div className="my-5 border-t border-white/10" />
            <div className="space-y-3">
              {order.order_items?.map((item, index) => (
                <div key={index} className="flex justify-between gap-3 text-sm">
                  <span>
                    {item.quantity}× {item.product_name}
                  </span>
                  <strong>
                    {(Number(item.unit_price) * item.quantity).toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" },
                    )}
                  </strong>
                </div>
              ))}
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
          </section>

          {isAccount && accountDetails && <section className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><h2 className="text-xl font-black">Conta com {accountDetails.robux.toLocaleString("pt-BR")} Robux</h2><p className="mt-2 text-sm text-zinc-300">K Cosmic: R$ {Number(accountDetails.cosmic_k).toFixed(2).replace(".", ",")} / 1K · Entrega dos dados no chat privado.</p><p className="mt-2 text-sm text-zinc-400">A disponibilidade é conferida durante a preparação. Caso a conta não esteja disponível, a equipe revisará a entrega com você.</p></section>}
          {isRobux && robuxOrder && (
            <section className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/[.055] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Entrega via GamePass</p>
                  <h2 className="mt-1 text-xl font-black">Detalhes dos seus Robux</h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-zinc-300">{robuxOrder.mode === "tax_paid" ? "Taxa paga" : "Sem taxa paga"}</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">GamePass</p><strong className="mt-1 block">{Number(robuxOrder.gamepass_robux).toLocaleString("pt-BR")} Robux</strong></div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">Você recebe</p><strong className="mt-1 block">≈ {Number(robuxOrder.net_robux).toLocaleString("pt-BR")} Robux</strong></div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-zinc-500">Conta Roblox</p><strong className="mt-1 block break-all">{robuxOrder.roblox_username}</strong></div>
              </div>
              <a href={robuxOrder.gamepass_url} target="_blank" rel="noreferrer" className="btn-secondary mt-4">Abrir meu GamePass ↗</a>

              {supplierStatus === "PENDING" && (
                <p className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-100">Seu pagamento foi confirmado e a compra do GamePass está sendo processada. Esta página atualiza o status automaticamente.</p>
              )}
              {(supplierStatus === "CANCELLED" || supplierStatus === "FAILED") && (
                <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">A compra automática precisa de uma nova tentativa. Seu pagamento continua confirmado e a equipe da Cosmic foi avisada.</p>
              )}
              {(supplierStatus === "COMPLETED" || order.status === "delivered") && (
                <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
                  <strong className="block">✓ GamePass comprado com sucesso</strong>
                  <span className="mt-1 block">Agora o Roblox processa a liberação. Os Robux podem aparecer como <strong>pendentes</strong> e normalmente levam cerca de 3 a 7 dias para ficar disponíveis. Esse prazo é controlado pelo Roblox.</span>
                </div>
              )}
            </section>
          )}

          {!isRobux && !isAccount && ["delivered", "cancelled"].includes(order.status) && (
            <RepurchaseButton orderId={id} />
          )}
          {order.status === "awaiting_payment" && (
            <section className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/10 p-5">
              <h2 className="font-bold">Falta concluir o pagamento</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Seu pedido já está salvo. Abra o Pix e envie o comprovante para
                continuar.
              </p>
              <Link
                href={`/checkout?pedido=${id}`}
                className="btn-primary mt-4"
              >
                Pagar com Pix e enviar comprovante
              </Link>
            </section>
          )}
          {order.status === "proof_submitted" && (
            <p className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sky-200">
              Recebemos seu comprovante. Você será avisado quando o pagamento
              for conferido.
            </p>
          )}
          {order.delivery_email_sent_at ? (
            <p className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <strong>{isRobux ? "🎮 Confirmação da compra do GamePass enviada." : "🎉 Confirmação de entrega enviada."}</strong>
              <span className="mt-1 block">
                {isRobux ? "Enviamos a confirmação para " : "Enviamos o e-mail e a imagem da entrega para "}
                <strong>{maskedEmail}</strong>. Se não aparecer na caixa de
                entrada, confira também Spam e Promoções.
              </span>
            </p>
          ) : order.payment_email_sent_at ? (
            <p className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <strong>✅ Pagamento confirmado.</strong>
              <span className="mt-1 block">
                Enviamos a confirmação para <strong>{maskedEmail}</strong>. Se
                não encontrar, confira também Spam e Promoções.
              </span>
            </p>
          ) : null}
          {order.status === "proof_rejected" && (
            <>
              <p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
                <strong>Comprovante recusado.</strong>
                <span className="mt-1 block">
                  Motivo:{" "}
                  {order.rejection_reason ??
                    "O comprovante não pôde ser confirmado."}
                </span>
              </p>
              <ProofReuploadForm orderId={id} />
            </>
          )}
          {!isRobux && <DeliveryInstructions items={order.order_items ?? []} />}
          {chatAvailable ? (
            <OrderChat
              orderId={id}
              userId={user.id}
              initialMessages={signedMessages as never[]}
              canSend={canSend}
            />
          ) : (
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6">
              <h2 className="font-black">Chat do pedido</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Será liberado assim que o pagamento for confirmado.
              </p>
            </section>
          )}
          {order.status === "delivered" && (
            <FeedbackForm orderId={id} userId={user.id} initial={feedback} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
