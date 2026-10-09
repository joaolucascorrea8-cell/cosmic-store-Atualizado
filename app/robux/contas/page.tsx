import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import Link from "next/link";
import AccountCatalog from "./AccountCatalog";
export default function AccountsPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="shell pb-16">
        <div className="catalog-page-head">
          <p className="eyebrow">COSMIC · ROBUX</p>
          <h1 className="section-title">Contas com Robux</h1>
          <p className="section-description max-w-3xl">
            Escolha uma conta pronta com saldo de Robux. Após confirmar o
            pagamento, nossa equipe prepara os dados para entrega no chat
            privado do pedido.
          </p>
        </div>
        <nav
          aria-label="Modalidade de Robux"
          className="mb-7 flex flex-wrap gap-3"
        >
          <Link
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold"
            href="/robux"
          >
            Compra de Robux · GamePass
          </Link>
          <Link
            aria-current="page"
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold"
            href="/robux/contas"
          >
            Contas com Robux
          </Link>
        </nav>
        <AccountCatalog />
      </main>
      <SiteFooter />
    </>
  );
}
