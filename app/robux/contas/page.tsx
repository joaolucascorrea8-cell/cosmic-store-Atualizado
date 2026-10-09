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
            pagamento, você recebe o usuário e a senha na área privada do pedido.
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
        <div className="mb-7 grid gap-3 text-sm sm:grid-cols-3">
          {["1. Escolha o saldo", "2. Confira a conta e a política", "3. Pague com Pix"].map(step => <p key={step} className="border-l-2 border-violet-500/40 pl-3 text-zinc-400">{step}</p>)}
        </div>
        <AccountCatalog />
      </main>
      <SiteFooter />
    </>
  );
}
