import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (
    adminError ||
    !admin ||
    !["owner", "admin"].includes(admin.role)
  ) {
    throw new Error("Acesso administrativo negado.");
  }

  return user;
}