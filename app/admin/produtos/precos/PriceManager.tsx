"use client";
import { useState, useTransition } from "react";
import { money, localDate } from "@/lib/catalog";
import {
  readRobuxRate,
  robuxPrice,
  type PriceBatch,
} from "@/lib/robux-pricing";
import { setPricingCategories, previewPrices, applyPrices } from "./actions";
type Category = {
  id: string;
  name: string;
  game_id: string;
  robux_pricing_enabled: boolean;
};
type Game = { id: string; name: string };
type History = {
  id: string;
  new_rate: number;
  status: string;
  created_at: string;
};
export default function PriceManager({
  categories,
  games,
  history,
}: {
  categories: Category[];
  games: Game[];
  history: History[];
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [setup, setSetup] = useState<string[]>([]),
    [rate, setRate] = useState("34,00"),
    [initial, setInitial] = useState("34,00"),
    [batch, setBatch] = useState<PriceBatch | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [pending, start] = useTransition();
  const enabled = categories.filter((c) => c.robux_pricing_enabled);
  const rateNumber = readRobuxRate(rate);
  const names = new Map(games.map((g) => [g.id, g.name]));
  const toggle = (id: string, list: string[], setter: (x: string[]) => void) =>
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  function resetPreview() {
    setBatch(null);
    setError("");
    setMessage("");
    setPage(0);
  }
  function configure(value: boolean) {
    start(async () => {
      setError("");
      const r = await setPricingCategories(setup, value);
      if (r.error) setError(r.error);
      else {
        setMessage(r.success ?? "");
        setSetup([]);
        setSelected([]);
        setBatch(null);
      }
    });
  }
  return (
    <div
      className="mt-6 space-y-5"
      data-live-dirty={Boolean(batch || selected.length || setup.length)}
      data-live-busy={pending}
    >
      <details className="admin-panel">
        <summary className="cursor-pointer font-bold">
          1. Categorias que acompanham a cotação
        </summary>
        <p className="mt-3 text-sm text-zinc-400">
          Marque somente categorias com preços ligados ao Robux. Deixe Frutas
          Físicas fora. Habilitar uma categoria não altera seus preços.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={setup.includes(c.id)}
                onChange={() => toggle(c.id, setup, setSetup)}
                disabled={pending}
              />
              <span>
                {names.get(c.game_id)} · {c.name}
                <small className="block text-zinc-400">
                  {c.robux_pricing_enabled
                    ? "Acompanha Robux"
                    : "Manual / fora do reajuste"}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="btn-primary"
            disabled={!setup.length || pending}
            onClick={() => configure(true)}
          >
            Habilitar selecionadas
          </button>
          <button
            className="btn-secondary"
            disabled={!setup.length || pending}
            onClick={() => configure(false)}
          >
            Manter selecionadas manuais
          </button>
        </div>
      </details>
      <section className="admin-panel">
        <h2 className="text-lg font-bold">
          2. Escolher produtos pelo jogo e categoria
        </h2>
        {!enabled.length && (
          <p className="mt-3 text-sm text-zinc-400">
            Abra a etapa anterior e habilite as categorias que deseja reajustar.
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {games.map((g) => {
            const cats = enabled.filter((c) => c.game_id === g.id);
            if (!cats.length) return null;
            return (
              <fieldset
                key={g.id}
                className="rounded-xl border border-white/10 p-4"
              >
                <legend className="px-1 font-bold">{g.name}</legend>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={pending}
                    checked={cats.every((c) => selected.includes(c.id))}
                    onChange={(e) => {
                      resetPreview();
                      setSelected(
                        e.target.checked
                          ? [
                              ...new Set([
                                ...selected,
                                ...cats.map((c) => c.id),
                              ]),
                            ]
                          : selected.filter(
                              (id) => !cats.some((c) => c.id === id),
                            ),
                      );
                    }}
                  />
                  Todas as categorias habilitadas deste jogo
                </label>
                <div className="mt-3 space-y-3">
                  {cats.map((c) => (
                    <label
                      key={c.id}
                      className="flex gap-2 text-sm text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        disabled={pending}
                        checked={selected.includes(c.id)}
                        onChange={() => {
                          resetPreview();
                          toggle(c.id, selected, setSelected);
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="admin-label">
            Nova cotação de 1K (R$)
            <input
              className="admin-input mt-2"
              inputMode="decimal"
              value={rate}
              disabled={pending}
              onChange={(e) => {
                setRate(e.target.value);
                resetPreview();
              }}
            />
          </label>
          <label className="admin-label">
            Cotação atual dos produtos ainda sem referência
            <input
              className="admin-input mt-2"
              inputMode="decimal"
              value={initial}
              disabled={pending}
              onChange={(e) => {
                setInitial(e.target.value);
                resetPreview();
              }}
            />
            <span className="mt-2 block text-xs font-normal text-zinc-400">
              Na primeira configuração, use 34. Os produtos já vinculados usam
              sua referência salva.
            </span>
          </label>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Inclui produtos publicados e ocultos das categorias escolhidas.
          Produtos protegidos manualmente e preços de combos ficam de fora.
          Nenhum pedido existente muda.
        </p>
        <button
          className="btn-primary mt-5"
          disabled={pending || !selected.length || !rateNumber}
          onClick={() =>
            start(async () => {
              resetPreview();
              const r = await previewPrices(selected, rate, initial);
              if (r.error) setError(r.error);
              else {
                setBatch(r.batch ?? null);
                setPage(0);
              }
            })
          }
        >
          {pending ? "Processando…" : "Calcular prévia"}
        </button>
      </section>
      <details className="admin-panel">
        <summary className="cursor-pointer font-bold">
          Conferir a tabela usada para novos produtos
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-400">
                <th className="p-2">Robux</th>
                <th className="p-2">Referência (1K = R$ 34)</th>
                <th className="p-2">Nova cotação</th>
              </tr>
            </thead>
            <tbody>
              {[350, 400, 450, 500, 750, 1000, 2000, 5000].map((q) => (
                <tr key={q} className="border-t border-white/10">
                  <td className="p-2">{q.toLocaleString("pt-BR")}</td>
                  <td className="p-2">{money(robuxPrice(q))}</td>
                  <td className="p-2">
                    {rateNumber ? money(robuxPrice(q, rateNumber)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Os produtos existentes usam seus próprios preços de referência. Essa
          tabela serve ao cadastro por quantidade de Robux.
        </p>
      </details>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="admin-success">
          {message}
        </p>
      )}
      {batch && (
        <section className="admin-panel" aria-label="Prévia do reajuste">
          <h2 className="text-lg font-bold">3. Conferir e aplicar</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {batch.changes.length} produtos elegíveis · {batch.skipped}{" "}
            protegidos ·{" "}
            {
              batch.changes.filter((r) => Number(r.before) !== Number(r.after))
                .length
            }{" "}
            preços diferentes. Prévia válida por 30 minutos.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400">
                  <th className="p-2">Produto</th>
                  <th className="p-2">Atual</th>
                  <th className="p-2">Novo</th>
                </tr>
              </thead>
              <tbody>
                {batch.changes.slice(page * 50, (page + 1) * 50).map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-2">{r.name}</td>
                    <td className="whitespace-nowrap p-2">{money(r.before)}</td>
                    <td className="whitespace-nowrap p-2 font-bold text-violet-200">
                      {money(r.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.changes.length > 50 && (
            <div className="mt-3 flex items-center gap-4">
              <button
                className="admin-small-button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span className="text-sm">
                {page + 1} / {Math.ceil(batch.changes.length / 50)}
              </span>
              <button
                className="admin-small-button"
                disabled={(page + 1) * 50 >= batch.changes.length}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          )}
          <button
            className="btn-primary mt-5"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  `Aplicar a cotação de ${money(batch.new_rate)} aos ${batch.changes.length} produtos da prévia?`,
                )
              )
                return;
              start(async () => {
                const r = await applyPrices(batch.id);
                if (r.error) setError(r.error);
                else {
                  setMessage(r.success ?? "");
                  setBatch(null);
                }
              });
            }}
          >
            Aplicar reajuste conferido
          </button>
        </section>
      )}
      <section className="admin-panel">
        <h2 className="text-lg font-bold">Últimos reajustes</h2>
        <p className="mt-2 text-xs text-zinc-400">
          Desfazer restaura todo o lote. Se algum produto mudou depois, a
          operação é bloqueada para preservar essa alteração.
        </p>
        <div className="mt-4 space-y-3">
          {history.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
            >
              <div className="text-sm">
                <strong>{money(h.new_rate)} / 1K</strong>
                <span className="ml-3 text-zinc-400">
                  {localDate(h.created_at)} ·{" "}
                  {h.status === "reverted" ? "Desfeito" : "Aplicado"}
                </span>
              </div>
              {h.status === "applied" && (
                <button
                  className="admin-small-button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Restaurar os valores anteriores deste lote?"))
                      return;
                    start(async () => {
                      const r = await applyPrices(h.id, true);
                      setError(r.error ?? "");
                      setMessage(r.success ?? "");
                    });
                  }}
                >
                  Desfazer lote
                </button>
              )}
            </div>
          ))}
          {!history.length && (
            <p className="text-sm text-zinc-400">Nenhum reajuste aplicado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
