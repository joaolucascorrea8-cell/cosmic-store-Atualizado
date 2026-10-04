import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/catalog";
import ReportExport from "./ReportExport";
type Line = { name: string; game?: string; units: number; revenue: number };
type Report = {
  orders: number;
  revenue: number;
  discount: number;
  average: number;
  deliveryHours: number | null;
  cancelled: number;
  products: Line[];
  games: Line[];
  days: { day: string; orders: number; revenue: number }[];
  coupons: {
    code: string;
    orders: number;
    discount: number;
    revenue: number;
  }[];
};
function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    new Date(s + "T12:00:00Z").toISOString().startsWith(s)
  );
}
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const from = params.de || today.slice(0, 8) + "01",
    to = params.ate || today;
  let error = "",
    report: Report | null = null;
  try {
    if (!validDate(from) || !validDate(to))
      throw new Error("Confira as datas.");
    const start = new Date(from + "T00:00:00-03:00"),
      end = new Date(new Date(to + "T00:00:00-03:00").getTime() + 86400000);
    if (end <= start || end.getTime() - start.getTime() > 366 * 86400000)
      throw new Error("Selecione de 1 a 366 dias.");
    const r = await createAdminClient().rpc("ops_report", {
      p_from: start.toISOString(),
      p_to: end.toISOString(),
    });
    if (r.error) throw new Error("Não foi possível consultar os relatórios.");
    report = r.data as Report;
  } catch (e) {
    error = e instanceof Error ? e.message : "Período inválido.";
  }
  const { data: interest, error: interestError } =
    await createAdminClient().rpc("ops_interest");
  const popular = (interest ?? []) as {
    id: string;
    name: string;
    favorite: number;
    restock: number;
  }[];
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <h1 className="admin-title">Relatórios da loja</h1>
      <p className="admin-description">
        Pagamentos confirmados no período, em horário de Brasília. Valores
        representam receita, sem cálculo de lucro.
      </p>
      <form className="admin-panel mt-6 flex flex-wrap items-end gap-3">
        <label className="admin-label">
          De
          <input
            className="admin-input mt-2"
            type="date"
            name="de"
            defaultValue={from}
          />
        </label>
        <label className="admin-label">
          Até
          <input
            className="admin-input mt-2"
            type="date"
            name="ate"
            defaultValue={to}
          />
        </label>
        <button className="btn-primary">Consultar</button>
      </form>
      {error && (
        <p className="admin-error mt-5" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="admin-stats mt-5">
            {[
              ["Receita recebida", money(report.revenue)],
              ["Pedidos pagos", report.orders],
              ["Ticket médio", money(report.average)],
              ["Descontos concedidos", money(report.discount)],
              [
                "Entrega média",
                report.deliveryHours === null
                  ? "Sem entregas"
                  : `${Number(report.deliveryHours).toLocaleString("pt-BR")} h`,
              ],
              ["Cancelados", report.cancelled],
            ].map(([label, value]) => (
              <div className="admin-stat admin-stat-money" key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Cancelados considera pedidos criados no período. Entrega média
            considera os pedidos pagos no período e já entregues. Pedidos
            cancelados ficam fora da receita.
          </p>
          <div className="mt-6 space-y-5">
            <section className="admin-panel">
              <h2 className="text-lg font-bold">
                Receita por dia de pagamento
              </h2>
              <div className="mt-4 space-y-2">
                {report.days.map((d) => (
                  <div
                    key={d.day}
                    className="grid items-center gap-3 text-sm sm:grid-cols-[100px_1fr_110px]"
                  >
                    <span className="text-zinc-400">
                      {d.day.split("-").reverse().join("/")}
                    </span>
                    <div className="h-2 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-violet-500"
                        style={{
                          width: `${(100 * Number(d.revenue)) / Math.max(...report!.days.map((x) => Number(x.revenue)), 1)}%`,
                        }}
                      />
                    </div>
                    <strong className="sm:text-right">
                      {money(d.revenue)}
                    </strong>
                  </div>
                ))}
                {!report.days.length && (
                  <p className="text-sm text-zinc-400">
                    Nenhum pagamento neste período.
                  </p>
                )}
              </div>
            </section>
            {[
              ["Produtos e combos", report.products],
              ["Jogos", report.games],
            ].map(([title, items]) => (
              <section className="admin-panel" key={String(title)}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">{String(title)}</h2>
                  {title === "Produtos e combos" && (
                    <ReportExport
                      period={from + "-" + to}
                      rows={[
                        ["Produto", "Jogo", "Unidades", "Receita rateada"],
                        ...report!.products.map((r) => [
                          r.name,
                          r.game,
                          r.units,
                          Number(r.revenue).toFixed(2).replace(".", ","),
                        ]),
                      ]}
                    />
                  )}
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-zinc-400">
                        <th className="p-2">Item</th>
                        <th className="p-2">Unidades</th>
                        <th className="p-2">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(items as Line[]).map((r, i) => (
                        <tr className="border-t border-white/10" key={i}>
                          <td className="p-2">
                            {r.name}
                            {r.game && (
                              <small className="block text-zinc-400">
                                {r.game}
                              </small>
                            )}
                          </td>
                          <td className="p-2">{r.units}</td>
                          <td className="whitespace-nowrap p-2">
                            {money(r.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  Descontos são distribuídos proporcionalmente pelos itens.
                  Combos aparecem separados para evitar contar os componentes
                  duas vezes.
                </p>
              </section>
            ))}
            <section className="admin-panel">
              <h2 className="text-lg font-bold">Cupons nos pedidos pagos</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-zinc-400">
                      <th className="p-2">Cupom</th>
                      <th className="p-2">Pedidos</th>
                      <th className="p-2">Desconto</th>
                      <th className="p-2">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.coupons.map((c) => (
                      <tr key={c.code} className="border-t border-white/10">
                        <td className="p-2 font-bold">{c.code}</td>
                        <td className="p-2">{c.orders}</td>
                        <td className="p-2">{money(c.discount)}</td>
                        <td className="p-2">{money(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.coupons.length && (
                <p className="mt-3 text-sm text-zinc-400">
                  Nenhum cupom usado nos pagamentos deste período.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <section className="admin-panel mt-5">
        <h2 className="text-lg font-bold">Interesse atual dos clientes</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Favoritos e avisos de reposição ativos, independentemente do período
          de vendas.
        </p>
        {interestError ? (
          <p className="admin-error mt-3">
            Não foi possível consultar o interesse.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {popular.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap justify-between gap-3 border-t border-white/10 py-3 text-sm"
              >
                <strong>{p.name}</strong>
                <span className="text-zinc-400">
                  {p.favorite} favoritos · {p.restock} aguardando reposição
                </span>
              </div>
            ))}
            {!popular.length && (
              <p className="text-sm text-zinc-400">
                Ainda não há preferências registradas.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
