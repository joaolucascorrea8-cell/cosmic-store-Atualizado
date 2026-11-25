"use client";
import type { ProductContext } from "@/lib/product-context";
import ProductIdentity from "@/app/components/ProductIdentity";
import { useProductContexts } from "@/app/context/useProductContexts";
import { couponCode, type CheckoutQuote } from "@/lib/coupons";
import ServiceHours from "@/app/components/ServiceHours";
import { deliveryText, type ServiceSettings } from "@/lib/store-service";
import Image from "@/app/components/StoreImage";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { readAttempt, writeAttempt, type CheckoutAttempt } from "@/lib/checkout-attempt";
import { cartKey, cartSignature } from "@/lib/cart";
import { money, UUID_PATTERN } from "@/lib/catalog";
import { uploadProof as sendProof } from "@/lib/proof-upload";
import FileDropZone from "@/app/components/FileDropZone";
type ConfirmedItem = { product_id: string | null; product_name: string; quantity: number; unit_price: number; context: ProductContext | null };
type CreatedOrder = {
  id: string;
  order_code: string;
  status: string;
  order_type?: string;
  total: number;
  pix_payload: string;
  game_nickname?: string;
  subtotal?: number;
  discount_total?: number;
  coupon_code?: string | null;
  delivery_hours?: number | null;
};
type CheckoutProps = { service: ServiceSettings | null; serviceNow: number };

export default function CheckoutContent(props: CheckoutProps) {
  const { cartOwner } = useCart();
  const orderId = useSearchParams().get("pedido");
  return <CheckoutForm key={JSON.stringify([cartOwner, orderId])} {...props} orderId={orderId} />;
}

function CheckoutForm({ service, serviceNow, orderId }: CheckoutProps & { orderId: string | null }) {
  const router = useRouter();
  const { items, cartLoaded, cartOwner, consumeCart } = useCart();
  const attemptKey = `cosmic-checkout-attempt:${cartOwner}`;
  const [pending, setPending] = useState<CheckoutAttempt | null>(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const productContexts = useProductContexts(items.map(item => item.id));
  const [gameNickname, setGameNickname] = useState(""),
    [order, setOrder] = useState<CreatedOrder | null>(null),
    [qrCode, setQrCode] = useState(""),
    [proof, setProof] = useState<File | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [initialized, setInitialized] = useState(false);
  const [confirmedItems, setConfirmedItems] = useState<ConfirmedItem[]>([]);
  const [previousOrderId, setPreviousOrderId] = useState("");
  const [retry, setRetry] = useState(0);
  const [couponInput, setCouponInput] = useState("");
  const [quote, setQuote] = useState<{
    signature: string;
    data: CheckoutQuote;
  } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const quoteRequest = useRef(0);
  const currentSignature = cartSignature(items);
  const currentQuote =
    quote?.signature === currentSignature ? quote.data : null;
  async function applyCoupon() {
    const requestId = ++quoteRequest.current;
    setQuoting(true);
    setQuoteError("");
    try {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, couponCode: couponCode(couponInput) }),
      });
      const data = await response.json();
      if (!active.current || requestId !== quoteRequest.current) return;
      if (response.status === 401) {
        router.push("/login?next=/checkout");
        return;
      }
      if (!response.ok) {
        setQuote(null);
        throw new Error(data.error ?? "Não foi possível aplicar o cupom.");
      }
      setQuote({ signature: currentSignature, data: data.quote });
      setCouponInput(data.quote.code ?? "");
    } catch (caught) {
      if (requestId === quoteRequest.current) {
        setQuote(null);
        setQuoteError(
          caught instanceof Error ? caught.message : "Confira sua conexão.",
        );
      }
    } finally {
      if (requestId === quoteRequest.current) setQuoting(false);
    }
  }
  useEffect(() => {
    if (!cartLoaded || !initialized || orderId !== null || !items.length) return;
    let cancelled = false;
    const requestId = ++quoteRequest.current;
    queueMicrotask(() => {
      if (!cancelled) {
        setQuote(null);
        setQuoteError("");
        setQuoting(true);
      }
    });
    void fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, couponCode: pending?.coupon ?? "" }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (cancelled || requestId !== quoteRequest.current) return;
        if (response.ok)
          setQuote({ signature: cartSignature(items), data: data.quote });
        else if (response.status === 401) router.replace("/login?next=/checkout");
        else
          setQuoteError(data.error ?? "Não foi possível conferir o resumo.");
      })
      .catch(() => {
        if (!cancelled && requestId === quoteRequest.current)
          setQuoteError("Confira sua conexão para atualizar o resumo.");
      })
      .finally(() => {
        if (!cancelled && requestId === quoteRequest.current) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items, initialized, cartLoaded, orderId, pending, retry, router]);
  const busy = useRef(false);
  const completed = useRef(false);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  useEffect(() => {
    if (!cartLoaded || orderId !== null) return;
    const saved = readAttempt(attemptKey);
    queueMicrotask(() => {
      if (!active.current) return;
      if (saved?.signature === currentSignature) {
        setPending(saved);
        setGameNickname(saved.nickname);
        setCouponInput(saved.coupon);
      }
      setInitialized(true);
    });
  }, [cartLoaded, orderId, attemptKey, currentSignature]);

  useEffect(() => {
    if (orderId === null || !cartLoaded) return;
    let closed = false;
    let checking = false;
    let loaded = false;
    const controller = new AbortController();
    async function check() {
      if (checking || document.hidden) return;
      checking = true;
      try {
        if (!orderId || !UUID_PATTERN.test(orderId)) throw new Error("Pedido inválido.");
        const response = await fetch(`/api/orders/${orderId}${loaded ? "?status=1" : ""}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
        });
        const data = await response.json();
        if (closed) return;
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/checkout?pedido=${orderId}`)}`);
          return;
        }
        if (!response.ok) throw new Error(data.error ?? "Não foi possível conferir este pedido.");
        if (!["awaiting_payment", "proof_rejected"].includes(data.order.status) || data.payable === false) {
          setOrder(null);
          router.replace(`/pedidos/${orderId}`);
          return;
        }
        if (!loaded) {
          setError("");
          setOrder(data.order);
          setConfirmedItems(data.items ?? []);
          setQrCode(data.qrCode);
          setGameNickname(data.order.game_nickname ?? "");
          loaded = true;
        }
        setInitialized(true);
      } catch (cause) {
        if (!closed) {
          loaded = false;
          setOrder(null);
          setQrCode("");
          setError(cause instanceof Error ? cause.message : "Não foi possível conferir este pedido.");
          setInitialized(true);
        }
      } finally { checking = false; }
    }
    void check();
    const interval = window.setInterval(check, 10000);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      closed = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [orderId, cartLoaded, retry, router]);

  const sameAttempt = pending?.signature === currentSignature &&
    pending.nickname === gameNickname.trim() && pending.coupon === couponCode(couponInput);
  async function createOrder() {
    if (
      completed.current || busy.current ||
      (quoting && !sameAttempt) ||
      !items.length ||
      gameNickname.trim().length < 2
    )
      return;
    if (!sameAttempt && (!currentQuote || couponCode(couponInput) !== (currentQuote.code ?? ""))) {
      setQuoteError("Aplique o cupom ou remova o código antes de continuar.");
      return;
    }
    busy.current = true;
    setLoading(true);
    setError("");
    setPreviousOrderId("");
    let submitted: CheckoutAttempt | null = null;
    try {
      const signature = cartSignature(items);
      const attempt = sameAttempt ? pending : {
        signature, token: crypto.randomUUID(), nickname: gameNickname.trim(),
        coupon: currentQuote?.code ?? "", total: currentQuote!.total,
      };
      submitted = attempt;
      writeAttempt(attemptKey, attempt);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameNickname: gameNickname.trim(),
          checkoutToken: attempt.token,
          cartOwner: cartOwner === "guest" ? undefined : cartOwner,
          couponCode: attempt.coupon,
          expectedTotal: attempt.total,
          items: items.map(({ id, quantity, kind, price }) => ({
            id,
            quantity,
            price,
            kind: kind ?? "product",
          })),
        }),
      });
      const data = await response.json();
      if (!active.current) return;
      if (response.status === 401) {
        router.push("/login?next=/checkout");
        return;
      }
      if (!response.ok) {
        if ([400, 409].includes(response.status)) {
          submitted = null;
          writeAttempt(attemptKey, null);
          setPending(null);
          setRetry(value => value + 1);
        }
        throw new Error(data.error ?? "Não foi possível criar o pedido.");
      }
      writeAttempt(attemptKey, null);
      if (!["awaiting_payment", "proof_rejected"].includes(data.order.status)) {
        // Uma resposta perdida pode ser recuperada depois de o pedido já ter sido encerrado.
        setPending(null);
        setPreviousOrderId(data.order.id);
        setError(data.order.status === "cancelled" ? "O pedido da tentativa anterior foi cancelado. Confira o carrinho para iniciar outra compra." : "Já existe um pedido para essa tentativa. Acompanhe a situação no histórico.");
        return;
      }
      completed.current = true;
      consumeCart(signature);
      router.replace(`/checkout?pedido=${data.order.id}`);
      return;
    } catch (caught) {
      if (!active.current) return;
      setPending(submitted);
      setError(caught instanceof TypeError ? "A conexão foi interrompida. Retome a tentativa para verificar seu pedido." : caught instanceof Error ? caught.message : "Confira sua conexão e tente novamente.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  async function uploadProof() {
    if (busy.current || !order || !proof) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      await sendProof(order.id, proof);
      if (!active.current) return;
      router.push(`/pedidos/${order.id}?proof=sent`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao enviar comprovante.",
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  async function copyPix() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.pix_payload);
      setCopied(true);
    } catch {
      setError("Selecione e copie o código Pix abaixo.");
    }
  }
  if (!cartLoaded || !initialized)
    return (
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell page-state"
        role="status"
      >
        Carregando seu checkout…
      </main>
    );
  if (orderId !== null && !order)
    return <main id="conteudo-principal" className="shell page-state"><div>
      <p role="alert">{error || "Conferindo a situação do pedido…"}</p>
      {error && <button className="btn-secondary mt-4" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>}
      <Link href="/pedidos" className="btn-secondary mt-4">Meus pedidos</Link>
    </div></main>;
  if (!items.length && !order && !error)
    return (
      <main id="conteudo-principal" tabIndex={-1} className="shell page-state">
        <div>
          <h1 className="text-2xl font-black">Seu carrinho está vazio</h1>
          <p className="mt-2 text-zinc-400">
            Adicione um produto antes de finalizar.
          </p>
          <Link href="/produtos" className="btn-primary mt-5">
            Ver produtos
          </Link>
        </div>
      </main>
    );
  return (
    <main id="conteudo-principal" tabIndex={-1} className="shell pb-16">
      <div className="catalog-page-head">
        <Link
          href={order ? `/pedidos/${order.id}` : "/carrinho"}
          className="text-xs font-bold text-zinc-400 hover:text-white"
        >
          ← {order ? "Ver pedido" : "Voltar ao carrinho"}
        </Link>
        <p className="eyebrow mt-7">CHECKOUT · PAGAMENTO PIX</p>
        <h1 className="section-title">
          {order ? "Finalize seu pagamento" : "Finalizar compra"}
        </h1>
        <p className="section-description">
          {order
            ? `Pedido ${order.order_code} · Envie o comprovante após pagar.`
            : "Confira os itens e informe seu nickname para entrega."}
        </p>
      </div>
      {order &&
        items.length > 0 && (
          <p className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">
            Este Pix pertence ao pedido {order.order_code}. Os itens adicionados
            depois continuam no seu carrinho.
          </p>
        )}
      {order?.order_type === "robux_account" && <div className="mb-5 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 text-sm text-zinc-300">Você está comprando uma conta com Robux. Os dados de acesso serão liberados no pedido após o pagamento e a preparação da entrega. <Link href={`/pedidos/${order.id}`} className="text-violet-300 underline">Consultar pedido e política lida</Link>.</div>}
      <ol aria-label="Etapas da compra" className="checkout-steps mb-7">
        <li className="checkout-step-active">
          <span>01</span> Dados
        </li>
        <li className={order ? "checkout-step-active" : ""}>
          <span>02</span> Pix
        </li>
        <li className={order ? "checkout-step-active" : ""}>
          <span>03</span> Comprovante
        </li>
      </ol>
      {!order ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <section className="checkout-section">
            <h2 className="text-lg font-black">Dados para entrega</h2>
            <label htmlFor="game-nickname" className="admin-label mt-6">
              Nickname no jogo *
            </label>
            <input
              id="game-nickname"
              className="admin-input"
              value={gameNickname}
              onChange={(event) => setGameNickname(event.target.value)}
              minLength={2}
              maxLength={60}
              autoComplete="off"
              placeholder="Digite exatamente como aparece no jogo"
              required
            />
            <p className="mt-2 text-xs text-zinc-500">
              Este nickname será usado para todos os itens deste pedido. Confira se ele identifica você nos jogos listados. Se precisar de nicknames diferentes, fale com a equipe antes de gerar o Pix.
            </p>
            <h3 className="mt-8 border-b border-white/10 pb-3 text-sm font-black">
              Itens da compra
            </h3>
            <div className="space-y-3 py-4">
              {items.map((item) => (
                <div
                  key={cartKey(item)}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-zinc-300">
                    {item.quantity} × {item.name}
                    <ProductIdentity context={productContexts.contexts[item.id]} loading={productContexts.loading} />
                  </span>
                  <strong className="shrink-0">
                    {money(item.price * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>
            <p className="mt-2 rounded-lg border border-white/10 bg-white/[.025] p-3 text-xs leading-6 text-zinc-400">
              A confirmação de pagamento é manual. Seu pedido aparecerá na área
              Meus pedidos.
            </p>
          </section>
          <aside className="checkout-summary">
            <h2 className="text-lg font-black">Resumo</h2>
            <div className="mt-5">
              <label htmlFor="coupon-code" className="admin-label">
                Tem um cupom?
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon-code"
                  value={couponInput}
                  maxLength={30}
                  onChange={(e) => setCouponInput(e.target.value)}
                  disabled={loading || quoting}
                  className="admin-input min-w-0 uppercase"
                  placeholder="Código de desconto"
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={loading || quoting || !items.length}
                  onClick={() => void applyCoupon()}
                  className="btn-secondary shrink-0"
                >
                  {quoting ? "…" : "Aplicar"}
                </button>
              </div>
              {currentQuote?.code && (
                <button
                  type="button"
                  disabled={loading || quoting}
                  className="mt-2 text-xs text-zinc-400 underline"
                  onClick={() => {
                    quoteRequest.current++;
                    setCouponInput("");
                    setQuote((value) =>
                      value
                        ? {
                            ...value,
                            data: {
                              ...value.data,
                              discount: 0,
                              total: value.data.subtotal,
                              code: null,
                            },
                          }
                        : null,
                    );
                    setQuoteError("");
                  }}
                >
                  Remover cupom
                </button>
              )}
              {quoteError && (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {quoteError} <button className="underline" onClick={() => void applyCoupon()}>Conferir novamente</button> · <Link href="/carrinho" className="underline">Rever carrinho</Link>
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>
            {currentQuote && currentQuote.discount > 0 && (
              <div className="mt-3 flex justify-between gap-3 text-sm text-emerald-300">
                <span className="break-all">Cupom {currentQuote.code}</span>
                <strong className="shrink-0">
                  − {money(currentQuote.discount)}
                </strong>
              </div>
            )}
            <div className="mt-3 flex justify-between text-sm text-zinc-400">
              <span>Forma de pagamento</span>
              <span>Pix</span>
            </div>
            <div className="my-5 border-t border-white/10" />
            <div className="flex items-end justify-between">
              <span>Total</span>
              <strong className="text-2xl font-black">
                {money(sameAttempt ? pending.total : currentQuote?.total ?? total)}
              </strong>
            </div>
            <button
              type="button"
              disabled={
                loading ||
                (!sameAttempt && (quoting || !currentQuote)) ||
                gameNickname.trim().length < 2 ||
                !items.length
              }
              onClick={() => void createOrder()}
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Preparando seu pedido…" : sameAttempt ? "Retomar tentativa de compra" : "Continuar para o Pix →"}
            </button>
            {currentQuote && (
              <p className="mt-4 text-xs leading-6 text-violet-200">
                {deliveryText(currentQuote.delivery_hours)}
              </p>
            )}
            {service && (
              <ServiceHours settings={service} initialTime={serviceNow} />
            )}
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              Ao continuar, você cria um pedido. Nenhum pagamento é realizado
              automaticamente.
            </p>
          </aside>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[370px_1fr]">
          <section className="checkout-section text-center">
            <p className="eyebrow">PAGAMENTO VIA PIX</p>
            <p className="mt-2 text-xs text-zinc-400">Se já pagou, envie o comprovante. Faça apenas um Pix por pedido.</p>
            {confirmedItems.length > 0 && <div className="mt-4 space-y-3 text-left" aria-label="Itens confirmados do pedido">
              {confirmedItems.map((item, i) => <div key={`${item.product_id}-${i}`}><p className="text-sm font-bold">{item.quantity} × {item.product_name}</p><ProductIdentity context={item.context} /></div>)}
              <p className="text-xs text-zinc-400">Identificação do catálogo atual. Os itens e valores do pedido permanecem registrados no histórico.</p>
            </div>}
            <div className="mx-auto mt-5 max-w-[260px] rounded-xl bg-white p-3">
              <Image
                src={qrCode}
                alt="QR Code Pix do seu pedido"
                width={440}
                height={440}
                unoptimized
                className="aspect-square w-full"
              />
            </div>
            <strong className="mt-5 block text-3xl font-black">
              {money(Number(order.total))}
            </strong>
            {Number(order.discount_total) > 0 && (
              <p className="mt-2 text-xs text-emerald-300">
                Cupom {order.coupon_code}: −{" "}
                {money(Number(order.discount_total))}
              </p>
            )}
            {order.delivery_hours && (
              <p className="mt-3 text-xs text-zinc-400">
                {deliveryText(order.delivery_hours)}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-400">
              Confirme o nome do recebedor e o valor no seu banco.
            </p>
            <button
              type="button"
              onClick={() => void copyPix()}
              className="btn-primary mt-5 w-full"
            >
              {copied ? "✓ Código copiado" : "Copiar código Pix"}
            </button>
            <details className="mt-4 rounded-lg border border-white/10 p-3 text-left text-xs text-zinc-400">
              <summary className="cursor-pointer font-bold">
                Ver código Pix copia e cola
              </summary>
              <p className="mt-3 break-all select-all">{order.pix_payload}</p>
            </details>
          </section>
          <section className="checkout-section">
            <p className="eyebrow">DEPOIS DE PAGAR</p>
            <h2 className="mt-2 text-2xl font-black">Envie o comprovante</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Depois que o Pix aparecer como concluído no seu banco, envie o
              comprovante. A equipe irá conferir o recebimento antes de
              confirmar o pedido.
            </p>
            <div className="mt-6">
              <FileDropZone
                file={proof}
                onChange={setProof}
                disabled={loading}
              />
            </div>
            <button
              type="button"
              disabled={!proof || loading}
              onClick={() => void uploadProof()}
              className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Enviando comprovante…" : "Enviar comprovante →"}
            </button>
            <p className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-3 text-xs leading-5 text-zinc-400">
              Está com dificuldade para anexar o arquivo? Você pode continuar
              sem enviar agora e voltar ao pedido depois. O pagamento continuará
              pendente até a equipe confirmar que o Pix foi recebido.
            </p>
            <Link
              href={`/pedidos/${order.id}`}
              className="btn-secondary mt-3 w-full"
            >
              Enviar depois e acompanhar pedido
            </Link>
            <p className="mt-5 text-xs leading-6 text-zinc-500">
              Envie apenas o comprovante. Nunca compartilhe senhas, códigos de
              acesso ou dados bancários no chat.
            </p>
          </section>
        </div>
      )}
      {error && (
        <p role="alert" className="admin-error mt-5">
          {error} {previousOrderId && <Link className="underline" href={`/pedidos/${previousOrderId}`}>Ver pedido</Link>}
        </p>
      )}
    </main>
  );
}
