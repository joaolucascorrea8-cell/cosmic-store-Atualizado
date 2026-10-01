"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { cartKey, cartSignature } from "@/lib/cart";
import { money, UUID_PATTERN } from "@/lib/catalog";
import { uploadProof as sendProof } from "@/lib/proof-upload";
import FileDropZone from "@/app/components/FileDropZone";
type CreatedOrder = {
  id: string;
  order_code: string;
  status: string;
  total: number;
  pix_payload: string;
  game_nickname?: string;
};
type Draft = {
  token?: string;
  signature?: string;
  nickname?: string;
  orderId?: string;
};
const draftKey = "cosmic-checkout-draft-v2";
function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {}
}
export default function CheckoutContent() {
  const router = useRouter(),
    { items, cartLoaded, clearCart } = useCart();
  const [gameNickname, setGameNickname] = useState(""),
    [order, setOrder] = useState<CreatedOrder | null>(null),
    [qrCode, setQrCode] = useState(""),
    [proof, setProof] = useState<File | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [initialized, setInitialized] = useState(false);
  const [orderSignature, setOrderSignature] = useState("");
  const busy = useRef(false),
    draft = useRef<Draft>({});
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      let saved: Draft = {};
      try {
        const parsed = JSON.parse(sessionStorage.getItem(draftKey) ?? "{}");
        if (parsed && typeof parsed === "object") saved = parsed;
      } catch {}
      draft.current = saved;
      setGameNickname(typeof saved.nickname === "string" ? saved.nickname : "");
      const id =
        new URLSearchParams(window.location.search).get("pedido") ??
        saved.orderId;
      if (id && UUID_PATTERN.test(id)) {
        try {
          const response = await fetch(`/api/orders/${id}`, {
            cache: "no-store",
          });
          const data = await response.json();
          if (cancelled) return;
          if (response.status === 401) {
            router.push(
              `/login?next=${encodeURIComponent(`/checkout?pedido=${id}`)}`,
            );
            return;
          }
          if (!response.ok)
            throw new Error(data.error ?? "Não foi possível retomar o pedido.");
          if (
            !["awaiting_payment", "proof_rejected"].includes(data.order.status)
          ) {
            router.replace(`/pedidos/${id}`);
            return;
          }
          setOrder(data.order);
          setOrderSignature(saved.signature ?? "");
          setQrCode(data.qrCode);
          setGameNickname(data.order.game_nickname ?? saved.nickname ?? "");
          draft.current = { ...saved, orderId: id };
        } catch (caught) {
          if (!cancelled)
            setError(
              caught instanceof Error
                ? caught.message
                : "Não foi possível carregar o pedido.",
            );
        }
      }
      if (!cancelled) setInitialized(true);
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [router]);
  useEffect(() => {
    if (initialized && !order) {
      draft.current = { ...draft.current, nickname: gameNickname };
      saveDraft(draft.current);
    }
  }, [gameNickname, initialized, order]);
  async function createOrder() {
    if (busy.current || !items.length || gameNickname.trim().length < 2) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const signature = cartSignature(items),
        fingerprint = signature + gameNickname.trim();
      const token =
        draft.current.signature === fingerprint && draft.current.token
          ? draft.current.token
          : crypto.randomUUID();
      draft.current = {
        token,
        signature: fingerprint,
        nickname: gameNickname.trim(),
      };
      saveDraft(draft.current);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameNickname: gameNickname.trim(),
          checkoutToken: token,
          items: items.map(({ id, quantity, kind, price }) => ({
            id,
            quantity,
            price,
            kind: kind ?? "product",
          })),
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login?next=/checkout");
        return;
      }
      if (!response.ok)
        throw new Error(data.error ?? "Não foi possível criar o pedido.");
      if (!["awaiting_payment", "proof_rejected"].includes(data.order.status)) {
        router.push(`/pedidos/${data.order.id}`);
        return;
      }
      draft.current = { ...draft.current, orderId: data.order.id };
      saveDraft(draft.current);
      setOrder(data.order);
      setOrderSignature(fingerprint);
      setQrCode(data.qrCode);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao criar o pedido.",
      );
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
      if (
        draft.current.signature ===
        cartSignature(items) + (draft.current.nickname ?? "")
      )
        clearCart();
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
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
        items.length > 0 &&
        orderSignature !== cartSignature(items) + gameNickname.trim() && (
          <p className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">
            Este Pix pertence ao pedido {order.order_code}. Os itens adicionados
            depois continuam no seu carrinho.
          </p>
        )}
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
              Conferiremos o nickname informado para realizar a entrega. Revise
              antes de continuar.
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
            <div className="mt-5 flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>
            <div className="mt-3 flex justify-between text-sm text-zinc-400">
              <span>Forma de pagamento</span>
              <span>Pix</span>
            </div>
            <div className="my-5 border-t border-white/10" />
            <div className="flex items-end justify-between">
              <span>Total</span>
              <strong className="text-2xl font-black">{money(total)}</strong>
            </div>
            <button
              type="button"
              disabled={
                loading || gameNickname.trim().length < 2 || !items.length
              }
              onClick={() => void createOrder()}
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Preparando seu pedido…" : "Continuar para o Pix →"}
            </button>
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              Ao continuar, você cria um pedido. Nenhum pagamento é realizado
              automaticamente.
            </p>
          </aside>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[370px_1fr]">
          <section className="checkout-section text-center">
            <p className="eyebrow">PAGUE COM PIX</p>
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
            <Link
              href={`/pedidos/${order.id}`}
              className="btn-secondary mt-3 w-full"
            >
              Acompanhar pedido
            </Link>
            <p className="mt-5 text-xs leading-6 text-zinc-500">
              Guarde seu comprovante. Não envie senhas, códigos de acesso ou
              dados bancários no chat.
            </p>
          </section>
        </div>
      )}
      {error && (
        <p role="alert" className="admin-error mt-5">
          {error}
        </p>
      )}
    </main>
  );
}
