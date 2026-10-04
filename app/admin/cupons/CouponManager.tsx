"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { money } from "@/lib/catalog";
import { couponDateInput, type Coupon } from "@/lib/coupons";
import { saveCoupon } from "./actions";
type Choice = { id: string; name: string };
function CouponEditor({
  coupon,
  games,
  products,
}: {
  coupon?: Coupon;
  games: Choice[];
  products: Choice[];
}) {
  const [state, action, pending] = useActionState(saveCoupon, {});
  const [dirty, setDirty] = useState(false),
    [scope, setScope] = useState(
      coupon?.product_id ? "product" : coupon?.game_id ? "game" : "all",
    );
  const form = useRef<HTMLFormElement>(null);
  const id = coupon?.id ?? "new";
  useEffect(() => {
    if (state.success)
      queueMicrotask(() => {
        setDirty(false);
        if (!coupon) {
          form.current?.reset();
          setScope("all");
        }
      });
  }, [state, coupon]);
  return (
    <form
      ref={form}
      action={action}
      onChange={() => setDirty(true)}
      data-live-dirty={dirty}
      data-live-busy={pending}
      className="mt-5 space-y-4"
    >
      <input type="hidden" name="id" value={coupon?.id ?? ""} />
      <input
        type="hidden"
        name="updated_at"
        value={state.savedAt ?? coupon?.updated_at ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="admin-label">
          Código
          <input
            name="code"
            required
            minLength={3}
            maxLength={30}
            defaultValue={coupon?.code}
            placeholder="Ex.: COSMIC10"
            autoCapitalize="characters"
            className="admin-input mt-2 uppercase"
          />
        </label>
        <label className="admin-label">
          Tipo
          <select
            name="kind"
            defaultValue={coupon?.kind ?? "percent"}
            className="admin-input mt-2"
          >
            <option value="percent">Percentual (%)</option>
            <option value="fixed">Valor em reais (R$)</option>
          </select>
        </label>
        <label className="admin-label">
          Desconto
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={coupon ? String(coupon.amount).replace(".", ",") : ""}
            placeholder="Ex.: 10"
            className="admin-input mt-2"
          />
        </label>
        <label className="admin-label">
          Compra mínima (R$)
          <input
            name="min_order"
            inputMode="decimal"
            required
            defaultValue={String(coupon?.min_order ?? 0).replace(".", ",")}
            className="admin-input mt-2"
          />
        </label>
        <label className="admin-label">
          Limite total de usos
          <input
            name="max_uses"
            type="number"
            min={1}
            max={1000000}
            defaultValue={coupon?.max_uses ?? ""}
            placeholder="Sem limite"
            className="admin-input mt-2"
          />
        </label>
        <label className="admin-label">
          Usos por cliente
          <input
            name="per_user_limit"
            type="number"
            min={1}
            max={1000}
            required
            defaultValue={coupon?.per_user_limit ?? 1}
            className="admin-input mt-2"
          />
        </label>
        <label className="admin-label">
          Início (Brasília, UTC−3)
          <input
            name="starts_at"
            type="datetime-local"
            defaultValue={couponDateInput(coupon?.starts_at ?? null)}
            className="admin-input mt-2"
          />
        </label>
        <label className="admin-label">
          Fim (Brasília, UTC−3)
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={couponDateInput(coupon?.ends_at ?? null)}
            className="admin-input mt-2"
          />
        </label>
      </div>
      <label className="admin-label" htmlFor={`coupon-scope-${id}`}>
        Aplicar desconto em
      </label>
      <select
        id={`coupon-scope-${id}`}
        name="scope"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className="admin-input"
      >
        <option value="all">Todos os produtos</option>
        <option value="game">Produtos de um jogo</option>
        <option value="product">Um produto específico</option>
      </select>
      {scope === "game" && (
        <select
          name="game_id"
          required
          aria-label="Jogo do cupom"
          defaultValue={coupon?.game_id ?? ""}
          className="admin-input"
        >
          <option value="">Selecione o jogo</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
      {scope === "product" && (
        <select
          name="product_id"
          required
          aria-label="Produto do cupom"
          defaultValue={coupon?.product_id ?? ""}
          className="admin-input"
        >
          <option value="">Selecione o produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {scope === "all" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            name="include_combos"
            type="checkbox"
            defaultChecked={coupon?.include_combos}
          />
          Permitir também em combos
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={coupon?.is_active ?? false}
        />
        Cupom ativo
      </label>
      <p className="text-xs leading-6 text-zinc-500">
        Um cupom por pedido. O mínimo considera o subtotal da compra; o desconto
        afeta apenas os itens elegíveis. Combos são excluídos nos cupons de jogo
        ou produto. O valor final mínimo é R$ 0,01. Pedidos gerados contam como
        uso; cancelar um pedido libera esse uso.
      </p>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="admin-notice">
          {state.success}
        </p>
      )}
      <button disabled={pending} className="btn-primary">
        {pending ? "Salvando…" : coupon ? "Salvar cupom" : "Criar cupom"}
      </button>
    </form>
  );
}
export default function CouponManager({
  coupons,
  games,
  products,
}: {
  coupons: Coupon[];
  games: Choice[];
  products: Choice[];
}) {
  const [search, setSearch] = useState("");
  const filtered = coupons.filter((c) =>
    c.code.includes(search.trim().toUpperCase()),
  );
  return (
    <>
      <details className="admin-form-details mt-6">
        <summary>
          + Criar cupom <span>⌄</span>
        </summary>
        <CouponEditor games={games} products={products} />
      </details>
      <input
        type="search"
        aria-label="Buscar cupom"
        placeholder="Buscar pelo código…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="admin-input mt-6"
      />
      <div className="mt-4 space-y-3">
        {filtered.map((c) => (
          <details key={c.id} className="admin-item-details">
            <summary>
              <span className="min-w-0">
                <strong className="block break-all">{c.code}</strong>
                <small className="text-zinc-400">
                  {c.kind === "percent" ? `${c.amount}%` : money(c.amount)} ·{" "}
                  {c.is_active ? "Ativo" : "Pausado"} · {c.uses ?? 0}
                  {c.max_uses ? `/${c.max_uses}` : ""} usos
                </small>
              </span>
              <span className="text-xs text-violet-300">Editar ⌄</span>
            </summary>
            <CouponEditor
              key={`${c.id}-${c.updated_at}`}
              coupon={c}
              games={games}
              products={products}
            />
          </details>
        ))}
      </div>
      {!filtered.length && (
        <p className="admin-empty mt-4">Nenhum cupom encontrado.</p>
      )}
    </>
  );
}
