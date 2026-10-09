"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/catalog";
type Offer = {
  id: string;
  robux: number;
  cosmicK: number;
  price: number;
  available?: boolean;
};
type Catalog = {
  offers: Offer[];
  available: boolean;
  page: number;
  pages: number;
  total: number;
  message: string;
};
export default function AccountCatalog() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [sort, setSort] = useState("price"),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  const selected = useRef<{ id: string; token: string } | null>(null),
    buying = useRef(false);
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    const number = ++requestNumber.current;
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
      if (!res.ok) {
        setCatalog((previous) =>
          previous ? { ...previous, available: false } : data,
        );
        return;
      }
      setCatalog(data);
    } catch {
      if (number === requestNumber.current)
        setCatalog((previous) =>
          previous ? { ...previous, available: false } : null,
        );
    }
  }, [sort, min, max, page]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 300),
      interval = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, 90000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refresh]);
  async function buy(offer: Offer) {
    if (buying.current) return;
    buying.current = true;
    setBusy(offer.id);
    setError("");
    if (selected.current?.id !== offer.id)
      selected.current = { id: offer.id, token: crypto.randomUUID() };
    try {
      const res = await fetch("/api/robux/accounts/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          expectedPrice: offer.price,
          checkoutToken: selected.current.token,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/robux/contas");
        return;
      }
      if (!res.ok) {
        if (data.offer)
          setCatalog((previous) =>
            previous
              ? {
                  ...previous,
                  offers: previous.offers.map((o) =>
                    o.id === offer.id ? data.offer : o,
                  ),
                }
              : previous,
          );
        else void refresh();
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
      setBusy(null);
    }
  }
  return (
    <section aria-label="Catálogo de contas">
      <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:grid-cols-3">
        <label className="text-sm text-zinc-300">
          Ordenar
          <select
            className="mt-2 block w-full rounded-lg border border-white/10 bg-[#111122] p-3"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="price">Menor preço</option>
            <option value="robux_desc">Mais Robux</option>
            <option value="robux_asc">Menos Robux</option>
          </select>
        </label>
        <label className="text-sm text-zinc-300">
          Robux a partir de
          <input
            inputMode="numeric"
            type="number"
            min="0"
            max="10000000"
            placeholder="Qualquer quantidade"
            className="mt-2 block w-full rounded-lg border border-white/10 bg-[#111122] p-3"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-sm text-zinc-300">
          Robux até
          <input
            inputMode="numeric"
            type="number"
            min="0"
            max="10000000"
            placeholder="Sem limite"
            className="mt-2 block w-full rounded-lg border border-white/10 bg-[#111122] p-3"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <p className="mb-5 text-sm text-zinc-400">
        A disponibilidade é confirmada antes de gerar o pedido. A conta pode
        sair de estoque durante a preparação; nesse caso, nossa equipe revisará
        o pedido com você. A reserva de pagamento dura 20 minutos.
      </p>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200"
        >
          {error}
        </p>
      )}
      {!catalog ? (
        <p role="status" className="py-10 text-zinc-400">
          Consultando contas disponíveis…
        </p>
      ) : (
        <>
          {!catalog.available && (
            <p role="status" className="mb-5 text-amber-200">
              {catalog.message ||
                "Estamos verificando a disponibilidade. Tente novamente em instantes."}
            </p>
          )}
          <p className="mb-4 text-sm text-zinc-500">
            {catalog.total} opções · Página {catalog.page} de {catalog.pages}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.offers.map((offer) => (
              <article
                key={offer.id}
                className="rounded-2xl border border-white/10 bg-[#111122] p-5"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
                  Conta Roblox
                </p>
                <h2 className="mt-3 text-2xl font-black">
                  {offer.robux.toLocaleString("pt-BR")} Robux
                </h2>
                <p className="mt-3 text-sm text-zinc-400">
                  K Cosmic{" "}
                  <span className="text-zinc-200">
                    {money(offer.cosmicK)} / 1K
                  </span>
                </p>
                <strong className="mt-4 block text-2xl">
                  {money(offer.price)}
                </strong>
                <p className="mt-3 text-xs text-emerald-300">
                  {catalog.available && offer.available !== false
                    ? "Disponível · sujeito à confirmação"
                    : "Em atualização"}
                </p>
                <button
                  className="mt-4 w-full rounded-xl bg-violet-600 py-3 font-bold hover:bg-violet-500 disabled:opacity-50"
                  disabled={
                    !catalog.available ||
                    offer.available === false ||
                    Boolean(busy)
                  }
                  onClick={() => void buy(offer)}
                >
                  {busy === offer.id
                    ? "Confirmando disponibilidade…"
                    : "Comprar"}
                </button>
              </article>
            ))}
          </div>
          {!catalog.offers.length && catalog.available && (
            <p className="py-10 text-zinc-400">
              Nenhuma conta encontrada nessa faixa. Experimente outra
              quantidade.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <button
              className="rounded-xl border border-white/10 px-4 py-3 disabled:opacity-40"
              disabled={catalog.page <= 1}
              onClick={() => setPage(catalog.page - 1)}
            >
              Anterior
            </button>
            <span className="text-sm text-zinc-400">
              {catalog.page} / {catalog.pages}
            </span>
            <button
              className="rounded-xl border border-white/10 px-4 py-3 disabled:opacity-40"
              disabled={catalog.page >= catalog.pages}
              onClick={() => setPage(catalog.page + 1)}
            >
              Próxima
            </button>
            <button
              className="rounded-xl border border-white/10 px-4 py-3"
              onClick={() => void refresh()}
            >
              Atualizar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
