import { redirect } from "next/navigation";

// A venda de contas com Robux foi retirada da vitrine. Pedidos históricos
// continuam acessíveis pela área de pedidos.
export default function AccountsPage(): never {
  redirect("/robux");
}
