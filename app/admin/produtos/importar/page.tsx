import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import Importer from "./Importer";
export default async function ImportPage() {
  await requireAdmin();
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <Link href="/admin/produtos" className="text-sm text-violet-300">
        ← Produtos
      </Link>
      <h1 className="admin-title mt-4">Importar produtos</h1>
      <p className="admin-description">
        Cadastre vários itens por planilha, com prévia antes de salvar.
      </p>
      <Importer />
    </main>
  );
}
