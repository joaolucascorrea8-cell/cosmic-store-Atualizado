import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import PendingButton from "@/app/admin/components/PendingButton";
import { cleanIssueMessage } from "@/lib/store-issues";
import { resolveIssue } from "./actions";
const date = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
export default async function Diagnostics({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams,
    client = createAdminClient();
  const requested = Math.max(
    1,
    Math.min(100000, parseInt(params.pagina ?? "1", 10) || 1),
  );
  const total = await client
    .from("store_issues")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);
  const page = Math.min(
    requested,
    Math.max(1, Math.ceil((total.count ?? 0) / 20)),
  );
  const [issues, deliveries, settings] = await Promise.all([
    client
      .from("store_issues")
      .select("*")
      .is("resolved_at", null)
      .order("last_seen", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
    client
      .from("notification_deliveries")
      .select("id,title,link,channel,error_message,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20),
    client.from("store_ops_settings").select("*").eq("id", true).maybeSingle(),
  ]);
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <h1 className="admin-title">Diagnóstico e backup</h1>
      <p className="admin-description">
        Acompanhe falhas registradas pela aplicação e mantenha uma cópia dos
        dados da loja.
      </p>
      <section className="admin-panel mt-6">
        <h2 className="text-lg font-bold">
          Ocorrências abertas{" "}
          <span className="text-zinc-500">({total.count ?? "—"})</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Falhas do servidor e das operações monitoradas são agrupadas.
          Problemas de rede no navegador e períodos em que o banco estiver
          indisponível devem ser investigados também nos logs da Vercel.
        </p>
        {total.error || issues.error ? (
          <p className="admin-error mt-4">
            Diagnóstico indisponível. Confira o SQL e os logs da Vercel.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {issues.data?.map((i) => (
              <article
                key={i.id}
                className="rounded-xl border border-white/10 p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <strong className="break-all text-sm">
                    {i.source} · {i.path}
                  </strong>
                  <span className="text-xs text-zinc-400">
                    {i.occurrences} ocorrência(s) · {date(i.last_seen)}
                  </span>
                </div>
                <p className="mt-3 break-words text-sm text-zinc-300">
                  {i.message}
                </p>
                <form className="mt-3" action={resolveIssue}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="last_seen" value={i.last_seen} />
                  <PendingButton className="admin-small-button">
                    Marcar como revisada
                  </PendingButton>
                </form>
              </article>
            ))}
            {!issues.data?.length && (
              <p className="text-sm text-emerald-300">
                Nenhuma ocorrência aberta registrada.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex gap-3 text-sm">
          {page > 1 && (
            <Link className="admin-small-button" href={`?pagina=${page - 1}`}>
              Anterior
            </Link>
          )}
          <span className="py-2">Página {page}</span>
          {page * 20 < (total.count ?? 0) && (
            <Link className="admin-small-button" href={`?pagina=${page + 1}`}>
              Próxima
            </Link>
          )}
        </div>
      </section>
      <section className="admin-panel mt-5">
        <h2 className="text-lg font-bold">Últimas falhas de envio</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Até 20 tentativas que falharam. O histórico permanece mesmo após um
          reenvio bem-sucedido; confira a situação atual no pedido.
        </p>
        {deliveries.error ? (
          <p className="admin-error mt-4">
            Não foi possível carregar os envios.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {deliveries.data?.map((d) => (
              <div key={d.id} className="border-t border-white/10 pt-3 text-sm">
                <strong>
                  {d.channel} · {d.title}
                </strong>
                <p className="mt-1 break-words text-zinc-400">
                  {cleanIssueMessage(d.error_message ?? "Falha no envio")}
                </p>
                <span className="mt-2 block text-xs text-zinc-500">
                  {date(d.created_at)}
                </span>
                {d.link && /^\/pedidos\/[0-9a-f-]{36}$/.test(d.link) && (
                  <Link
                    className="mt-2 inline-block text-violet-300"
                    href={`/admin${d.link}`}
                  >
                    Abrir pedido →
                  </Link>
                )}
              </div>
            ))}
            {!deliveries.data?.length && (
              <p className="text-sm text-zinc-400">
                Nenhuma falha de envio registrada.
              </p>
            )}
          </div>
        )}
      </section>
      <section className="admin-panel mt-5">
        <h2 className="text-lg font-bold">Rotina de pedidos sem comprovante</h2>
        {settings.error || !settings.data ? (
          <p className="admin-error mt-3">Configuração indisponível.</p>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            {settings.data.auto_close_enabled ? "Habilitada" : "Desligada"}.{" "}
            {settings.data.last_run_at
              ? `Última execução: ${date(settings.data.last_run_at)} · ${settings.data.last_run_count} encerrados.`
              : "Ainda não houve execução registrada."}
          </p>
        )}
        <Link
          href="/admin/atendimento"
          className="admin-small-button mt-4 inline-block"
        >
          Configurar atendimento
        </Link>
      </section>
      <section className="admin-panel mt-5">
        <h2 className="text-lg font-bold">
          Backup de código, banco e arquivos
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          O ZIP do projeto guarda o código. Clientes, pedidos, configurações e
          imagens enviados ficam no Supabase e precisam de uma cópia separada. O
          projeto agora inclui uma rotina local para exportar o banco e baixar
          todos os arquivos dos buckets, incluindo os privados.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>
            Leia <strong>BACKUP-E-RESTAURACAO.md</strong> no projeto e configure
            o arquivo local de backup.
          </li>
          <li>
            No seu computador, execute <code>npm run backup</code>.
          </li>
          <li>
            Confira a integridade com{" "}
            <code>npm run backup:verify -- caminho-da-pasta</code> e guarde a
            cópia em local privado.
          </li>
        </ol>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Esta página não executa nem armazena backups. O arquivo contém dados
          pessoais e deve ficar fora do GitHub. A restauração deve ser ensaiada
          em outro projeto, com o guia incluído.
        </p>
      </section>
    </main>
  );
}
