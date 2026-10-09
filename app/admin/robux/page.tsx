import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { getRobuxSettings } from "@/lib/robux-settings";
import { getByRobuxBalance, getByRobuxRates } from "@/lib/byrobux";
import RobuxSettingsForm from "./RobuxSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminRobuxPage() {
  await requireAdmin();
  const settings = await getRobuxSettings();
  let connection:
    | { ok: true; rate: number; balance: number; maintenance: boolean }
    | { ok: false; message: string };
  try {
    const [rates, balance] = await Promise.all([
      getByRobuxRates(),
      getByRobuxBalance(),
    ]);
    connection = {
      ok: true,
      rate: Number(rates.robuxRateBrlPerThousand),
      balance: Number(balance.balanceBrl),
      maintenance: Boolean(rates.catalogMaintenance),
    };
  } catch (error) {
    connection = {
      ok: false,
      message:
        error instanceof Error ? error.message : "Não foi possível consultar a API.",
    };
  }

  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <p className="eyebrow">Integração</p>
      <h1 className="admin-title">Robux · ByRobux</h1>
      <p className="admin-description max-w-3xl">
        Controle preço, margem, limite de segurança e tutorial. A API Key fica somente nas variáveis de ambiente do servidor.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="admin-panel">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">API</p>
          <strong className={`mt-2 block text-xl ${connection.ok ? "text-emerald-300" : "text-red-300"}`}>
            {connection.ok ? "Conectada" : "Não conectada"}
          </strong>
        </div>
        <div className="admin-panel">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">K fornecedor</p>
          <strong className="mt-2 block text-xl">
            {connection.ok ? `R$ ${connection.rate.toFixed(2).replace(".", ",")}` : "—"}
          </strong>
        </div>
        <div className="admin-panel">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Saldo ByRobux</p>
          <strong className="mt-2 block text-xl">
            {connection.ok ? connection.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          </strong>
        </div>
      </section>
      {!connection.ok && (
        <p className="admin-error mt-4">
          {connection.message} Configure <code>BYROBUX_API_KEY</code> na Vercel e no seu <code>.env.local</code>.
        </p>
      )}
      {connection.ok && connection.maintenance && (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">A API informou manutenção do catálogo.</p>
      )}

      <Link href="/admin/robux/contas" className="mt-5 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold">Contas com Robux · catálogo e pedidos</Link>

      <RobuxSettingsForm settings={settings} />

      <section className="admin-panel mt-6 max-w-4xl">
        <h2 className="text-lg font-black">Como a confirmação funciona</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
          <li>O cliente escolhe os Robux, valida o GamePass e paga por Pix.</li>
          <li>Você confere o comprovante e marca o pagamento como confirmado.</li>
          <li>No pedido, a Cosmic mostra saldo, custo e margem atual da ByRobux.</li>
          <li>Você clica em “Comprar e entregar”. A partir daí a API executa e o status é acompanhado automaticamente.</li>
        </ol>
      </section>
    </main>
  );
}
