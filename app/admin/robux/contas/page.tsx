import { readAccountPolicy } from "@/lib/robux-accounts/policy";
import AccountPolicyForm from "./AccountPolicyForm";
import { getRequestTime } from "@/lib/store-service-server";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  accountSettings,
  readCatalog,
  catalogFresh,
} from "@/lib/robux-accounts/service";
import { calculateCosmicPrice } from "@/lib/providers/byrobux/accounts-parser";
import { money, localDate } from "@/lib/catalog";
import { saveAccountSettings, refreshAccountCatalog } from "./actions";
import PendingButton from "@/app/admin/components/PendingButton";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  let settings, state, policy;
  try {
    [settings, state, policy] = await Promise.all([accountSettings(), readCatalog(), readAccountPolicy()]);
  } catch {
    return (
      <main className="admin-page">
        <h1 className="admin-title">Contas com Robux</h1>
        <p className="admin-error mt-5">
          Confira as migrations 202610090001_robux_accounts.sql e
          202610090002_robux_account_delivery_policy.sql e
          202610100001_robux_account_minimum_k.sql. O Quick Buy continua com suas configurações próprias.
        </p>
      </main>
    );
  }
  const now = await getRequestTime();
  const { page: raw } = await searchParams,
    pages = Math.max(1, Math.ceil(state.offers.length / 50));
  const page = Math.max(1, Math.min(pages, Number(raw) || 1));
  const { data: orders } = await createAdminClient()
    .from("orders")
    .select(
      "id,order_code,total,status,robux_account_orders(masked_id,robux,availability,acquired_at)",
    )
    .eq("order_type", "robux_account")
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <main className="admin-page">
      <Link href="/admin/robux" className="text-sm text-violet-300">
        ← Robux
      </Link>
      <p className="eyebrow mt-5">CATÁLOGO PÚBLICO · AQUISIÇÃO MANUAL</p>
      <h1 className="admin-title">Contas com Robux</h1>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="admin-panel">
          <p className="text-zinc-400">Sincronização</p>
          <strong className="mt-2 block">
            {state.lease_until && Date.parse(state.lease_until) > now
              ? "Em andamento"
              : state.last_error
                ? "Atualização parcial/falha · dados anteriores preservados"
                : catalogFresh(state)
                  ? "Funcionando"
                  : "Aguardando atualização"}
          </strong>
        </div>
        <div className="admin-panel">
          <p className="text-zinc-400">Cotações / contas</p>
          <strong className="mt-2 block">
            {state.quotes.length} /{" "}
            {state.offers.reduce((n, o) => n + (o.publicCount ?? 1), 0)} contas
            ({state.offers.length} ofertas únicas)
          </strong>
        </div>
        <div className="admin-panel">
          <p className="text-zinc-400">Robux encontrados</p>
          <strong className="mt-2 block">
            {state.offers
              .reduce((n, o) => n + o.robux * (o.publicCount ?? 1), 0)
              .toLocaleString("pt-BR")}
          </strong>
        </div>
      </section>
      <section className="admin-panel mt-5">
        <p>
          Última atualização com dados válidos:{" "}
          {state.last_success_at
            ? localDate(state.last_success_at)
            : "Ainda não realizada"}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Última sincronização completa:{" "}
          {state.last_complete_at
            ? localDate(state.last_complete_at)
            : "Ainda não realizada"}{" "}
          · Última tentativa:{" "}
          {state.last_attempt_at ? localDate(state.last_attempt_at) : "—"} ·
          Próxima consulta permitida: {localDate(state.next_attempt_at)}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Atualização sob demanda, a cada 90 segundos durante uso da página.
          Cache acima de 10 minutos bloqueia novas compras. A reserva local não
          reserva no fornecedor.
        </p>
        {state.last_error && (
          <p className="admin-error mt-4">{state.last_error}</p>
        )}
        {state.diagnostics.length > 0 && (
          <details className="mt-3 text-sm">
            <summary>
              Diagnóstico de ofertas ignoradas ({state.diagnostics.length})
            </summary>
            {state.diagnostics.slice(0, 30).map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </details>
        )}
        <form action={refreshAccountCatalog} className="mt-4">
          <PendingButton>Consultar catálogo</PendingButton>
        </form>
      </section>
      <form action={saveAccountSettings} className="admin-panel mt-5 max-w-xl">
        <h2 className="text-lg font-black">Preço das contas</h2>
        <p className="mt-2 text-sm text-zinc-400">
          K Cosmic é o maior entre o mínimo configurado e o K fornecedor mais
          o acréscimo. Esta regra vale para novas compras de contas.
        </p>
        <label className="mt-4 block">
          K Cosmic mínimo (R$ por 1.000 Robux)
          <input
            name="min_cosmic_k"
            type="number"
            min="0"
            max="10000"
            step="0.01"
            defaultValue={settings.min_cosmic_k}
            required
            className="mt-2 block w-full rounded-lg border border-white/10 bg-[#111122] p-3"
          />
        </label>
        <label className="mt-4 block">
          Acréscimo sobre o K fornecedor (R$ por 1.000 Robux)
          <input
            name="margin"
            type="number"
            min="0"
            max="10000"
            step="0.01"
            defaultValue={settings.margin_per_thousand}
            required
            className="mt-2 block w-full rounded-lg border border-white/10 bg-[#111122] p-3"
          />
        </label>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {settings.min_cosmic_k > settings.margin_per_thousand
            ? `Com os valores salvos, o K Cosmic fica em ${money(settings.min_cosmic_k)} enquanto o K fornecedor for até ${money(settings.min_cosmic_k - settings.margin_per_thousand)}. Acima disso, soma ${money(settings.margin_per_thousand)} ao K fornecedor.`
            : `Com os valores salvos, o K Cosmic acompanha o K fornecedor com acréscimo de ${money(settings.margin_per_thousand)}.`}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Quando o mínimo é aplicado, a diferença sobre o custo por 1K pode ser
          maior que o acréscimo configurado. Game Pass e pedidos já criados
          mantêm suas configurações e valores.
        </p>
        <label className="my-4 flex gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
          />{" "}
          Aceitar novas compras de contas
        </label>
        <PendingButton>Salvar configuração</PendingButton>
      </form>
      <section className="admin-panel mt-5">
        <details><summary className="cursor-pointer text-lg font-black">Política de reembolso das contas</summary><p className="mt-3 text-sm text-zinc-400">O cliente lê este texto antes do Pix. <Link href="/reembolso/contas" className="text-violet-300 underline">Ver página pública</Link></p><AccountPolicyForm body={policy.body} version={policy.version} /></details>
      </section>
      <section className="admin-panel mt-5">
        <h2 className="text-lg font-black">
          Ofertas encontradas · página {page} de {pages}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-zinc-400">
                <th className="p-2">ID mascarado</th>
                <th className="p-2">Robux</th>
                <th className="p-2">K fornecedor</th>
                <th className="p-2">Custo</th>
                <th className="p-2">K Cosmic / venda</th>
                <th className="p-2">Cotação</th>
              </tr>
            </thead>
            <tbody>
              {state.offers.slice((page - 1) * 50, page * 50).map((o) => {
                const price = calculateCosmicPrice(
                  o.robux,
                  o.supplierK,
                  settings.margin_per_thousand,
                  settings.min_cosmic_k,
                );
                return (
                  <tr className="border-t border-white/10" key={o.id}>
                    <td className="p-2 font-mono">
                      {o.maskedId}
                      {(o.publicCount ?? 1) > 1 && (
                        <span className="block text-xs text-amber-200">
                          {o.publicCount} linhas agrupadas
                        </span>
                      )}
                    </td>
                    <td className="p-2">{o.robux.toLocaleString("pt-BR")}</td>
                    <td className="p-2">{money(o.supplierK)}</td>
                    <td className="p-2">{money(o.supplierPrice)}</td>
                    <td className="p-2">
                      {money(price.cosmicK)} / {money(price.price)}
                    </td>
                    <td className="p-2">
                      <a
                        className="text-violet-300"
                        href={o.quoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir cotação
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-4">
          {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
          {page < pages && <Link href={`?page=${page + 1}`}>Próxima</Link>}
        </div>
      </section>
      <section className="admin-panel mt-5">
        <h2 className="text-lg font-black">Últimos 50 pedidos de contas</h2>
        <div className="mt-4 space-y-3">
          {(orders ?? []).map((o) => (
            <Link
              className="block rounded-xl border border-white/10 p-3"
              key={o.id}
              href={`/admin/pedidos/${o.id}`}
            >
              {o.order_code} · {money(o.total)} · {o.status}
            </Link>
          ))}
          {!orders?.length && (
            <p className="text-zinc-400">Nenhum pedido de conta.</p>
          )}
        </div>
      </section>
    </main>
  );
}
