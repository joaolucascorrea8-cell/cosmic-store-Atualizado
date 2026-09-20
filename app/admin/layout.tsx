import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Verifica a identidade no servidor
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Usuário não autenticado
  if (authError || !user) {
    redirect("/login");
  }

  // Consulta a permissão administrativa
  const { data: admin, error: adminError } =
    await supabase
      .from("admins")
      .select("role")
      .eq("user_id", user.id)
      .single();

  // Usuário sem permissão ou erro na consulta
  if (
    adminError ||
    !admin ||
    !["owner", "admin"].includes(admin.role)
  ) {
    redirect("/");
  }

  // Acesso autorizado
  return <>{children}</>;
}