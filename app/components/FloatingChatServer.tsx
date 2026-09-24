import FloatingChat from "./FloatingChat";
import { createClient } from "@/lib/supabase/server";

export default async function FloatingChatServer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: unread }, { data: admin }] = await Promise.all([
    supabase.from("notifications").select("link").eq("user_id", user.id).is("read_at", null),
    supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  const links = unread ?? [];
  const support = links.filter((item) => item.link?.startsWith("/suporte")).length;
  const orders = links.filter((item) => item.link?.startsWith("/pedidos")).length;
  const total = links.length;

  return <FloatingChat
    initialCounts={{ total, support, orders, other: Math.max(0, total - support - orders) }}
    userId={user.id}
    isAdmin={Boolean(admin && ["owner", "admin"].includes(admin.role))}
  />;
}
