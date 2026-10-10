"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money } from "@/lib/catalog";
import type { AccountOption } from "@/lib/robux-accounts/presentation";

type Policy = { version: string; body: string; updated_at: string };
type Catalog = {
  offers: AccountOption[];
  available: boolean;
  page: number;
  pages: number;
  total: number;
  message: string;
  policy?: Policy;
  deliveryHours?: number;
};
const ranges = [
  { label: "Todas", min: "", max: "" },
  { label: "Até 1 mil", min: "", max: "1000" },
  { label: "1 a 5 mil", min: "1001", max: "5000" },
  { label: "5 a 10 mil", min: "5001", max: "10000" },
  { label: "Mais de 10 mil", min: "10001", max: "" },
];
const field =
  "mt-2 block min-h-11 w-full rounded-xl border border-white/10 bg-[#11101c] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
export default function AccountCatalog() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [sort, setSort] = useState("value"),
    [min, setMin] = useState(""),
    [max, setMax] = useState("");
  const [page, setPage] = useState(1),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<AccountOption | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null),
    [accepted, setAccepted] = useState(false);
  const requestNumber = useRef(0),
    buying = useRef(false);
  const checkout = useRef<{ id: string; token: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const chosenId = chosen?.id;
  useEffect(() => {
    if (chosenId && !dialog.current?.open) dialog.current?.showModal();
    if (!chosenId) {
      dialog.current?.close();
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [chosenId]);
  const refresh = useCallback(async () => {
    const number = ++requestNumber.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        min,
        max,
        page: String(page),
      });
      const res = await fetch(`/api/robux/accounts/catalog?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (number !== requestNumber.current) return;
      setCatalog((previous) =>
        res.ok
          ? data
          : {
              ...(previous ?? data),
              available: false,
              message:
                "Estamos atualizando a disponibilidade. Tente novamente em instantes.",
            },
      );
    } catch {
      if (number === requestNumber.current)
        setCatalog((previous) => ({
          ...(previous ?? { offers: [], page: 1, pages: 1, total: 0 }),
          available: false,
          message:
            "Não foi possível carregar as contas. Confira sua conexão e tente atualizar.",
        }));
    } finally {
      if (number === requestNumber.current) setLoading(false);
    }
  }, [sort, min, max, page]);
  useEffect(() => {
    const counter = requestNumber;
    const timer = setTimeout(() => void refresh(), 250);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 90000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      counter.current++;
    };
  }, [refresh]);
  function choose(offer: AccountOption) {
    if (!catalog?.policy) return;
    setChosen(offer);
    setPolicy(catalog.policy);
    setAccepted(false);
    setError("");
  }
  async function buy() {
    if (!chosen || !policy || !accepted || buying.current) return;
    buying.current = true;
    setBusy(true);
    setError("");
    if (checkout.current?.id !== chosen.id)
      checkout.current = { id: chosen.id, token: crypto.randomUUID() };
    try {
      const res = await fetch("/api/robux/accounts/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: chosen.id,
          expectedPrice: chosen.price,
          checkoutToken: checkout.current.token,
          policyVersion: policy.version,
          policyAccepted: true,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/robux/contas");
        return;
      }
      if (!res.ok) {
        if (data.offer) {
          setChosen({ ...chosen, ...data.offer });
          setAccepted(false);
        }
        if (data.policy) {
          setPolicy(data.policy);
          setAccepted(false);
        }
        void refresh();
        throw new Error(data.error || "Não foi possível continuar.");
      }
      router.push(`/checkout?pedido=${data.order.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Confira sua conexão e tente novamente.",
      );
    } finally {
      buying.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label="Catálogo de contas" className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#101018] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Quanto Robux você procura?</h2>
          <Link
            href="/reembolso/contas"
            className="text-xs text-violet-300 underline underline-offset-4"
          >
            Entrega e reembolso
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Faixas de Robux">
          {ranges.map((range) => (
            <button
              type="button"
              key={range.label}
              aria-pressed={min === range.min && max === range.max}
              onClick={() => {
                setMin(range.min);
                setMax(range.max);
                setPage(1);
              }}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm transition ${min === range.min && max === range.max ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.3fr]">
          <label className="text-xs text-zinc-400">
            Robux a partir de
            <input
              aria-label="Robux a partir de"
              className={field}
              type="number"
              inputMode="numeric"
              min="0"
              max="10000000"
              placeholder="Sem mínimo"
              value={min}
              onChange={(e) => {
                setMin(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="text-xs text-zinc-400">
            Robux até
            <input
              aria-label="Robux até"
              className={field}
              type="number"
              inputMode="numeric"
              min="0"
              max="10000000"
              placeholder="Sem máximo"
              value={max}
              onChange={(e) => {
                setMax(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="col-span-2 text-xs text-zinc-400 sm:col-span-1">
            Ordenar por
            <select
              className={field}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="value">Melhor valor por 1K</option>
              <option value="price">Menor preço total</option>
              <option value="robux_desc">Mais Robux</option>
              <option value="robux_asc">Menos Robux</option>
            </select>
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="text-zinc-400">
          {loading
            ? "Atualizando opções…"
            : `${catalog?.total ?? 0} opções de saldo`}
          <span className="mt-1 block text-xs text-zinc-500">
            Atualização automática
          </span>
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="min-h-10 text-violet-300 disabled:opacity-40"
        >
          Atualizar agora
        </button>
      </div>
      {catalog && !catalog.available && (
        <p
          role="status"
          className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100"
        >
          {catalog.message || "Estamos atualizando as contas disponíveis."}
        </p>
      )}
      {!catalog ? (
        <div
          role="status"
          className="rounded-2xl border border-white/10 p-8 text-center text-zinc-400"
        >
          Consultando contas disponíveis…
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101018]">
            <div
              className="hidden grid-cols-[1.5fr_1fr_1fr_130px] gap-4 border-b border-white/10 bg-white/[.025] px-6 py-3 text-xs text-zinc-500 sm:grid"
              aria-hidden="true"
            >
              <span>Saldo da conta</span>
              <span>K base Cosmic</span>
              <span>Preço final</span>
              <span />
            </div>
            <ul
              className="divide-y divide-white/[.07]"
              aria-label="Contas disponíveis"
            >
              {catalog.offers.map((offer) => (
                <li
                  key={offer.id}
                  className="grid grid-cols-2 items-center gap-x-4 gap-y-3 p-4 transition hover:bg-white/[.02] sm:grid-cols-[1.5fr_1fr_1fr_130px] sm:px-6 sm:py-4"
                >
                  <div>
                    <h3 className="text-xl font-black tracking-tight sm:text-2xl">
                      {offer.robux.toLocaleString("pt-BR")}{" "}
                      <span className="text-sm font-medium text-zinc-400">
                        Robux
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Conta Roblox
                      {offer.options > 1
                        ? ` · ${offer.options} opções equivalentes`
                        : ""}
                    </p>
                  </div>
                  <p className="text-right text-sm text-zinc-300 sm:text-left">
                    <span className="block text-[11px] text-zinc-500 sm:hidden">
                      K base Cosmic
                    </span>
                    {money(offer.cosmicK)}{" "}
                    <span className="text-xs text-zinc-500">/ 1K</span>
                  </p>
                  <div>
                    <strong className="text-xl font-black">
                      {money(offer.price)}
                    </strong>
                    <p
                      className={`mt-1 text-[11px] ${offer.available ? "text-emerald-300" : "text-zinc-500"}`}
                    >
                      {offer.available
                        ? "Disponível para compra"
                        : "Em atualização"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold hover:bg-violet-500 disabled:opacity-40"
                    disabled={
                      !catalog.available ||
                      !offer.available ||
                      !catalog.policy ||
                      busy
                    }
                    onClick={() => choose(offer)}
                  >
                    Escolher
                  </button>
                </li>
              ))}
            </ul>
            {!catalog.offers.length && (
              <div className="p-8 text-center">
                <p className="font-bold">
                  {catalog.available
                    ? "Nenhuma conta nessa faixa"
                    : "As contas estão sendo atualizadas"}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  {catalog.available
                    ? "Experimente outra quantidade ou selecione Todas."
                    : "O catálogo aparecerá aqui assim que a consulta terminar."}
                </p>
              </div>
            )}
          </div>
          {catalog.pages > 1 && (
            <nav
              aria-label="Páginas de contas"
              className="flex items-center justify-center gap-4"
            >
              <button
                type="button"
                className="min-h-11 rounded-xl border border-white/10 px-4 text-sm disabled:opacity-30"
                disabled={catalog.page <= 1 || loading}
                onClick={() => {
                  setPage(catalog.page - 1);
                }}
              >
                Anterior
              </button>
              <span className="text-xs text-zinc-400">
                {catalog.page} de {catalog.pages}
              </span>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-white/10 px-4 text-sm disabled:opacity-30"
                disabled={catalog.page >= catalog.pages || loading}
                onClick={() => {
                  setPage(catalog.page + 1);
                }}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
      <p className="max-w-3xl text-xs leading-6 text-zinc-500">
        Cada opção inclui uma conta com o saldo informado. A disponibilidade e o
        valor são conferidos novamente antes do pedido. Contas com o mesmo saldo
        e preço aparecem juntas para facilitar sua escolha. Abaixo de 1.000 Robux,
        o preço segue a tabela por quantidade da Cosmic. A partir de 1.000, o
        cálculo é proporcional ao K base.
      </p>
      <dialog
        ref={dialog}
        aria-labelledby="account-confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setChosen(null);
        }}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#11101c] p-0 text-white shadow-2xl backdrop:bg-black/75"
      >
        {chosen && policy && (
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
                  Antes de continuar
                </p>
                <h2
                  id="account-confirm-title"
                  className="mt-2 text-2xl font-black"
                >
                  Confira sua conta
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar resumo"
                disabled={busy}
                onClick={() => setChosen(null)}
                className="min-h-10 min-w-10 rounded-lg border border-white/10 text-xl"
              >
                ×
              </button>
            </div>
            <div className="my-5 flex items-center justify-between gap-4 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
              <div>
                <strong className="text-xl">
                  {chosen.robux.toLocaleString("pt-BR")} Robux
                </strong>
                <p className="mt-1 text-xs text-zinc-400">
                  K base Cosmic {money(chosen.cosmicK)} / 1K
                </p>
              </div>
              <strong className="text-2xl">{money(chosen.price)}</strong>
            </div>
            {chosen.robux < 1000 && (
              <p className="mb-4 text-xs leading-6 text-zinc-400">
                Este saldo segue a tabela de preços abaixo de 1.000 Robux.
                O preço final é o total mostrado acima.
              </p>
            )}
            <p className="text-sm leading-6 text-zinc-300">
              Você receberá{" "}
              <strong className="text-white">
                uma conta Roblox com esse saldo
              </strong>
              . Os Robux não são enviados para sua conta atual.
            </p>
            <p className="mt-2 text-xs leading-6 text-zinc-400">
              Entrega em até {catalog?.deliveryHours ?? 24} horas após a
              confirmação do pagamento, na área privada do pedido. O Pix deverá
              ser pago durante a reserva de 20 minutos.
            </p>
            <p className="mt-3 rounded-xl border border-white/10 p-3 text-xs leading-5 text-zinc-300">
              Grave o primeiro acesso e confira o saldo assim que receber a
              conta. Se houver problema, relate preferencialmente nos primeiros
              10 minutos após a liberação dos dados. Seus direitos legais
              permanecem preservados.
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Cancelamento e reembolso</h3>
              <Link
                target="_blank"
                rel="noopener noreferrer"
                href="/reembolso/contas"
                className="text-xs text-violet-300 underline"
              >
                Abrir página
              </Link>
            </div>
            <div
              tabIndex={0}
              aria-label="Política de reembolso"
              className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-zinc-400"
            >
              {policy.body}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-violet-500"
              />
              Li a política de cancelamento e reembolso e entendi que estou
              comprando uma conta com Robux.
            </label>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={!accepted || busy}
              onClick={() => void buy()}
              className="mt-5 min-h-12 w-full rounded-xl bg-violet-600 px-4 py-3 font-bold hover:bg-violet-500 disabled:opacity-40"
            >
              {busy
                ? "Confirmando disponibilidade…"
                : "Confirmar e ir para o Pix"}
            </button>
            <p className="mt-3 text-center text-[11px] text-zinc-500">
              Se o valor mudar, você verá o novo preço antes de confirmar.
            </p>
          </div>
        )}
      </dialog>
    </section>
  );
}
