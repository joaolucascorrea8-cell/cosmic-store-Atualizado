import FloatingChat from "./FloatingChat";
import { createClient } from "@/lib/supabase/server";

export default async function FloatingChatServer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: unread }, { data: admin }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,title,body,link,created_at")
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  return <FloatingChat
    initialNotifications={unread ?? []}
    userId={user.id}
    isAdmin={Boolean(admin && ["owner", "admin"].includes(admin.role))}
  />;
}
