import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProfileForm from "./ProfileForm";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/conta");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, avatar_url, auth_provider")
    .eq("id", user.id)
    .maybeSingle();

  const metadataNickname = String(
    user.user_metadata?.preferred_username
      ?? user.user_metadata?.user_name
      ?? user.user_metadata?.nickname
      ?? user.email?.split("@")[0]
      ?? "cliente"
  ).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 15);

  const fallbackNickname = `${metadataNickname.length >= 3 ? metadataNickname : "cliente"}_${user.id.slice(0, 6)}`;
  const provider = profile?.auth_provider
    ?? String(user.app_metadata?.provider ?? "email");

  return (
    <>
      <SiteHeader />
      <main className="shell min-h-[calc(100vh-160px)] py-12">
        <div className="max-w-2xl">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-violet-400">Sua conta</span>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Meu perfil</h1>
          <p className="mt-3 text-zinc-400">Escolha como você aparecerá nos chats e nos feedbacks da Cosmic Store.</p>

          <ProfileForm
            userId={user.id}
            email={user.email ?? "E-mail não disponibilizado"}
            initialNickname={profile?.nickname ?? fallbackNickname}
            initialAvatarUrl={profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null}
            provider={provider}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

