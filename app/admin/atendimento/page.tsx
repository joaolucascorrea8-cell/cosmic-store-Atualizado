import { requireAdmin } from "@/lib/require-admin";
import { getStoreService } from "@/lib/store-service-server";
import ServiceForm from "./ServiceForm";
export default async function ServicePage() {
  await requireAdmin();
  const settings = await getStoreService();
  return (
    <main id="conteudo-principal" tabIndex={-1} className="admin-page">
      <p className="eyebrow">Organização da equipe</p>
      <h1 className="admin-title">Atendimento e entrega</h1>
      <p className="admin-description">
        Defina expectativas claras para os clientes antes da compra.
      </p>
      {settings ? (
        <ServiceForm settings={settings} />
      ) : (
        <p className="admin-error mt-6">
          Não foi possível carregar as configurações. Confira a atualização SQL.
        </p>
      )}
    </main>
  );
}
