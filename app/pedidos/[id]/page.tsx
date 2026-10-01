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
      "id,order_code,status,total,game_nickname,created_at,paid_at,delivered_at,delivery_due_at,chat_closed_at,rejection_reason,payment_email_sent_at,delivery_email_sent_at,order_items(product_name,unit_price,quantity)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) notFound();

  const status = orderStatus[order.status] ?? {
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

          <OrderProgress status={order.status} />

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
              <strong>🎉 Confirmação de entrega enviada.</strong>
              <span className="mt-1 block">
                Enviamos o e-mail e a imagem da entrega para{" "}
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
