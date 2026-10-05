"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type RobuxPurchaseMode,
  readRobuxAmount,
  robuxBreakdown,
  salePriceForGamepass,
} from "@/lib/robux-pricing";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function robux(value: number) {
  return value.toLocaleString("pt-BR");
}

type Validation = {
  valid: true;
  username: string;
  gamepassId: string;
  gamepassRobux: number;
  netRobux: number;
  feeRobux: number;
  cosmicK: number;
  price: number;
};

export default function RobuxCalculator({
  initialCosmicK,
  available,
  unavailableMessage,
  tutorialUrl,
  pendingDaysMin,
  pendingDaysMax,
}: {
  initialCosmicK: number | null;
  available: boolean;
  unavailableMessage: string;
  tutorialUrl: string;
  pendingDaysMin: number;
  pendingDaysMax: number;
}) {
  const router = useRouter();
  const [amountText, setAmountText] = useState("1000");
  const [mode, setMode] = useState<RobuxPurchaseMode>("tax_paid");
  const [cosmicK, setCosmicK] = useState(initialCosmicK ?? 34);
  const [link, setLink] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"validate" | "order" | "">("");
  const checkoutToken = useRef(crypto.randomUUID());
  const amount = readRobuxAmount(amountText);

  const options = useMemo(() => {
    if (!amount) return null;
    const paid = robuxBreakdown(amount, "tax_paid");
    const notPaid = robuxBreakdown(amount, "tax_not_paid");
    return {
      tax_paid: {
        ...paid,
        price: salePriceForGamepass(paid.gamepassRobux, cosmicK),
      },
      tax_not_paid: {
        ...notPaid,
        price: salePriceForGamepass(notPaid.gamepassRobux, cosmicK),
      },
    };
  }, [amount, cosmicK]);
  const selected = options?.[mode] ?? null;

  function resetValidation() {
    setValidation(null);
    setError("");
  }

  async function validateGamepass() {
    if (!amount || !selected || !link.trim() || busy) return;
    setBusy("validate");
    setError("");
    setValidation(null);
    try {
      const response = await fetch("/api/robux/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, mode, link: link.trim() }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login?next=/robux");
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível verificar o GamePass.");
      const valid = data as Validation;
      setCosmicK(Number(valid.cosmicK));
      setValidation(valid);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível verificar o GamePass.",
      );
    } finally {
      setBusy("");
    }
  }

  async function createOrder() {
    if (!amount || !validation || busy) return;
    setBusy("order");
    setError("");
    try {
      const response = await fetch("/api/robux/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          mode,
          link: link.trim(),
          checkoutToken: checkoutToken.current,
          expectedPrice: validation.price,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login?next=/robux");
        return;
      }
      if (!response.ok) {
        if (response.status === 409) setValidation(null);
        throw new Error(data.error ?? "Não foi possível criar seu pedido.");
      }
      router.push(`/checkout?pedido=${data.order.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar seu pedido.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section className="rounded-3xl border border-violet-500/20 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.18),transparent_42%),#121017] p-5 sm:p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">
              1 · Escolha a quantidade
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Pode ser 400, 450, 1.000, 7.500 ou outra quantidade.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">
              2 · Crie o GamePass
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Nós mostramos exatamente qual preço colocar no passe.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">
              3 · Pague com Pix
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Você envia o comprovante e a equipe confirma antes da compra.
            </p>
          </div>
        </div>
      </section>

      {!available ? (
        <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5 text-amber-100">
          <strong>Robux temporariamente indisponível</strong>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {unavailableMessage}
          </p>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-3xl border border-white/10 bg-[#121017] p-5 sm:p-7">
            <label htmlFor="robux-amount" className="text-lg font-black">
              Quantos Robux você quer?
            </label>
            <div className="mt-4 flex items-center rounded-2xl border border-white/10 bg-[#080812] px-4 focus-within:border-violet-500">
              <input
                id="robux-amount"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                max={1_000_000}
                value={amountText}
                onChange={(event) => {
                  setAmountText(event.target.value.replace(/\D/g, "").slice(0, 7));
                  resetValidation();
                }}
                className="min-h-16 min-w-0 flex-1 bg-transparent text-2xl font-black outline-none"
                aria-describedby="robux-amount-help"
              />
              <span className="shrink-0 text-sm font-bold text-zinc-400">Robux</span>
            </div>
            <p id="robux-amount-help" className="mt-2 text-xs text-zinc-500">
              Digite a quantidade e depois escolha como a taxa de 30% do Roblox será tratada.
            </p>

            {amount && options ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("tax_paid");
                    resetValidation();
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${
                    mode === "tax_paid"
                      ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(167,139,250,.18)]"
                      : "border-white/10 bg-white/[.025] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">Taxa paga</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Você recebe o valor completo.
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-black text-violet-200">
                      Recomendado
                    </span>
                  </div>
                  <div className="mt-5 space-y-2 text-sm">
                    <p className="flex justify-between gap-3 text-zinc-400">
                      <span>Você recebe</span>
                      <strong className="text-white">{robux(options.tax_paid.netRobux)} Robux</strong>
                    </p>
                    <p className="flex justify-between gap-3 text-zinc-400">
                      <span>Crie o GamePass por</span>
                      <strong className="text-white">{robux(options.tax_paid.gamepassRobux)} Robux</strong>
                    </p>
                    <p className="flex justify-between gap-3 text-zinc-400">
                      <span>Taxa do Roblox incluída</span>
                      <span>{robux(options.tax_paid.feeRobux)} Robux</span>
                    </p>
                  </div>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total</span>
                    <strong className="mt-1 block text-2xl font-black">{money(options.tax_paid.price)}</strong>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("tax_not_paid");
                    resetValidation();
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${
                    mode === "tax_not_paid"
                      ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(167,139,250,.18)]"
                      : "border-white/10 bg-white/[.025] hover:border-white/20"
                  }`}
                >
                  <div>
                    <p className="text-lg font-black">Sem taxa paga</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      O Roblox desconta 30% do GamePass.
                    </p>
                  </div>
                  <div className="mt-5 space-y-2 text-sm">
                    <p className="flex justify-between gap-3 text-zinc-400">
                      <span>GamePass</span>
                      <strong className="text-white">{robux(options.tax_not_paid.gamepassRobux)} Robux</strong>
                    </p>
                    <p className="flex justify-between gap-3 text-zinc-400">
                      <span>Roblox desconta</span>
                      <span>{robux(options.tax_not_paid.feeRobux)} Robux</span>
                    </p>
                    <p className="flex justify-between gap-3 text-zinc-400">
                      <span>Você recebe</span>
                      <strong className="text-white">{robux(options.tax_not_paid.netRobux)} Robux</strong>
                    </p>
                  </div>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total</span>
                    <strong className="mt-1 block text-2xl font-black">{money(options.tax_not_paid.price)}</strong>
                  </div>
                </button>
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                Informe uma quantidade entre 1 e 1.000.000 Robux.
              </p>
            )}

            <p className="mt-5 text-xs leading-6 text-zinc-500">
              Cotação Cosmic atual: <strong className="text-zinc-300">{money(cosmicK)} por 1.000 Robux do GamePass</strong>. O valor é reconferido antes de gerar o Pix.
            </p>
          </section>

          {selected && (
            <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-3xl border border-white/10 bg-[#121017] p-5 sm:p-7">
                <p className="eyebrow">ANTES DE PAGAR</p>
                <h2 className="mt-2 text-2xl font-black">Crie e verifique seu GamePass</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Para a opção <strong className="text-white">{mode === "tax_paid" ? "Taxa paga" : "Sem taxa paga"}</strong>, coloque o GamePass exatamente em <strong className="text-white">{robux(selected.gamepassRobux)} Robux</strong>. A Cosmic confere o link antes de liberar o pagamento.
                </p>

                <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/[.07] p-4">
                  <strong className="text-violet-100">Como funciona a taxa?</strong>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    O Roblox retém 30% da venda do GamePass. Em <strong>Taxa paga</strong>, nós aumentamos o valor do passe para você receber a quantidade escolhida. Em <strong>Sem taxa paga</strong>, o passe fica no valor digitado e os 30% são descontados do que chega para você.
                  </p>
                </div>

                <details className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-4">
                  <summary className="cursor-pointer font-black">Não sabe criar um GamePass? Veja o passo a passo</summary>
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
                    <li>Abra o Creator Hub do Roblox e entre em uma experiência publicada da sua conta.</li>
                    <li>Acesse a área de monetização e crie um Pass.</li>
                    <li>Coloque o Pass à venda pelo valor exato mostrado pela Cosmic.</li>
                    <li>Copie o link do GamePass e cole no campo abaixo.</li>
                  </ol>
                  <p className="mt-4 text-xs leading-6 text-amber-200/80">
                    O Roblox pode exigir que sua experiência esteja publicada e que sua conta cumpra requisitos de publicação/verificação. Confirme que consegue criar e vender o Pass antes de pagar.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tutorialUrl && (
                      <a href={tutorialUrl} target="_blank" rel="noreferrer" className="btn-primary">
                        ▶ Assistir tutorial em vídeo
                      </a>
                    )}
                    <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noreferrer" className="btn-secondary">
                      Abrir Creator Hub ↗
                    </a>
                  </div>
                </details>

                <label htmlFor="gamepass-link" className="admin-label mt-6">Link do GamePass</label>
                <input
                  id="gamepass-link"
                  value={link}
                  onChange={(event) => {
                    setLink(event.target.value);
                    resetValidation();
                  }}
                  placeholder="https://www.roblox.com/game-pass/..."
                  className="admin-input"
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={!link.trim() || Boolean(busy)}
                  onClick={() => void validateGamepass()}
                  className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "validate" ? "Verificando…" : "Verificar GamePass"}
                </button>

                {error && (
                  <p role="alert" className="admin-error mt-4">{error}</p>
                )}
                {validation && (
                  <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
                    <strong className="text-emerald-200">✓ GamePass verificado</strong>
                    <div className="mt-3 grid gap-2 text-zinc-300 sm:grid-cols-2">
                      <p>Conta: <strong className="text-white">{validation.username}</strong></p>
                      <p>GamePass: <strong className="text-white">{robux(validation.gamepassRobux)} Robux</strong></p>
                      <p>Você recebe: <strong className="text-white">≈ {robux(validation.netRobux)} Robux</strong></p>
                      <p>Total: <strong className="text-white">{money(validation.price)}</strong></p>
                    </div>
                  </div>
                )}
              </div>

              <aside className="h-fit rounded-3xl border border-white/10 bg-[#121017] p-5 lg:sticky lg:top-24">
                <p className="text-xs font-black uppercase tracking-[.16em] text-zinc-500">Resumo</p>
                <div className="mt-4 space-y-3 text-sm">
                  <p className="flex justify-between gap-3 text-zinc-400"><span>Opção</span><strong className="text-white">{mode === "tax_paid" ? "Taxa paga" : "Sem taxa paga"}</strong></p>
                  <p className="flex justify-between gap-3 text-zinc-400"><span>GamePass</span><strong className="text-white">{robux(selected.gamepassRobux)}</strong></p>
                  <p className="flex justify-between gap-3 text-zinc-400"><span>Recebimento estimado</span><strong className="text-white">{robux(selected.netRobux)}</strong></p>
                  <p className="flex justify-between gap-3 text-zinc-400"><span>Prazo do Roblox</span><strong className="text-white">~{pendingDaysMin}–{pendingDaysMax} dias</strong></p>
                </div>
                <div className="my-5 border-t border-white/10" />
                <p className="flex items-end justify-between gap-3"><span>Total</span><strong className="text-2xl font-black">{money(selected.price)}</strong></p>
                <button
                  type="button"
                  disabled={!validation || Boolean(busy)}
                  onClick={() => void createOrder()}
                  className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "order" ? "Gerando Pix…" : "Comprar com Pix →"}
                </button>
                {!validation && <p className="mt-3 text-xs leading-5 text-zinc-500">Verifique o GamePass antes de continuar.</p>}
                <p className="mt-5 rounded-xl border border-amber-400/15 bg-amber-500/[.06] p-3 text-xs leading-6 text-amber-100/75">
                  Após a Cosmic comprar seu GamePass, os Robux podem aparecer como pendentes. O prazo de liberação é controlado pelo Roblox e pode variar.
                </p>
                <p className="mt-4 text-xs leading-5 text-zinc-500">Nunca envie sua senha do Roblox. A Cosmic precisa apenas do link do GamePass.</p>
              </aside>
            </section>
          )}
        </>
      )}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.02] p-5 text-sm leading-7 text-zinc-400">
        <strong className="text-white">Importante:</strong> a compra é feita por GamePass. Depois da confirmação do pagamento, a Cosmic realiza a compra e o Roblox processa a liberação dos Robux. O prazo mostrado é uma estimativa e não significa liberação instantânea.
        <div className="mt-3">
          <Link href="/suporte" className="font-bold text-violet-300 hover:text-violet-200">Precisa de ajuda? Fale com o suporte →</Link>
        </div>
      </section>
    </div>
  );
}
