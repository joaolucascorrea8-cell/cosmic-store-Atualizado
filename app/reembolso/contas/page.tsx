import Link from "next/link";
import LegalPage from "@/app/components/LegalPage";
import CopyButton from "@/app/components/CopyButton";
import { readAccountPolicy } from "@/lib/robux-accounts/policy";
import { localDate } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Contas com Robux · Entrega e reembolso",
  alternates: { canonical: "/reembolso/contas" },
};
export default async function AccountRefundPage() {
  let policy = null;
  try {
    policy = await readAccountPolicy();
  } catch {
    /* Checkout remains blocked if policy is unavailable. */
  }
  return (
    <LegalPage
      eyebrow="Contas com Robux"
      title="Entrega e reembolso"
      intro="Leia as condições da compra da sua conta. A política apresentada antes do Pix fica registrada no pedido para você consultar depois."
      updatedAt={policy ? localDate(policy.updated_at) : "consulte o suporte"}
    >
      {policy ? (
        <>
          <section className="whitespace-pre-wrap">{policy.body}</section>
          <CopyButton value={policy.body} label="Copiar política" />
        </>
      ) : (
        <p>
          Não foi possível carregar a política neste momento. Aguarde uma nova
          atualização ou fale com o suporte antes de comprar.
        </p>
      )}
      <section className="rounded-2xl border border-white/10 p-5">
        <h2>Precisa relatar um problema?</h2>
        <p>
          Abra seu pedido e utilize o botão de suporte. Se não conseguir entrar
          na conta recebida ou o saldo estiver diferente, informe o ocorrido e
          preserve a gravação do primeiro acesso com segurança. O atendimento
          permanece disponível após os primeiros 10 minutos.
        </p>
        <Link
          className="mt-4 inline-block font-bold text-violet-300"
          href="/suporte"
        >
          Abrir suporte →
        </Link>
      </section>
      <p>
        <Link href="/reembolso" className="text-violet-300 underline">
          Política geral da loja
        </Link>{" "}
        ·{" "}
        <Link href="/robux/contas" className="text-violet-300 underline">
          Voltar às contas
        </Link>
      </p>
    </LegalPage>
  );
}
