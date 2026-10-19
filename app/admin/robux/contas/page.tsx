import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";

// O catálogo de novas contas foi removido do painel. A entrega de pedidos
// antigos continua disponível no detalhe de cada pedido.
export default async function AdminAccountsPage(): Promise<never> {
  await requireAdmin();
  redirect("/admin/robux");
}
