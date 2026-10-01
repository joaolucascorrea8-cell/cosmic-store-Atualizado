import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/safe-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeInternalPath(searchParams.get("next"));
  const oauthProvider =
    searchParams.get("provider") === "discord"
      ? "discord"
      : searchParams.get("provider") === "google"
        ? "google"
        : null;
  const loginErrorUrl = (code: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("auth_error", code);
    if (next !== "/") url.searchParams.set("next", next);
    return url;
  };

  const providerError = searchParams.get("error");
  const providerErrorCode = searchParams.get("error_code");
  if (providerError || providerErrorCode) {
    const cancelled =
      providerError === "access_denied" ||
      providerErrorCode === "access_denied";
    return NextResponse.redirect(
      loginErrorUrl(cancelled ? "oauth_cancelled" : "oauth_callback"),
    );
  }

  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(loginErrorUrl("oauth_callback"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "[Auth callback] Falha ao trocar código por sessão:",
      error.message,
    );
    return NextResponse.redirect(loginErrorUrl("oauth_callback"));
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const providerToken = data.session?.provider_token;
  const discordIdentity = data.user?.identities?.find(
    (identity) => identity.provider === "discord",
  );
  const discordId = discordIdentity?.id;

  if (oauthProvider === "discord" && discordId && data.user?.id) {
    const admin = createAdminClient();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ discord_id: discordId })
      .eq("id", data.user.id);
    if (profileError)
      console.error(
        "[Discord OAuth] Não foi possível salvar o discord_id:",
        profileError.message,
      );
  }

  if (
    oauthProvider === "discord" &&
    guildId &&
    botToken &&
    providerToken &&
    discordId
  ) {
    const guildResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: providerToken }),
      },
    ).catch((guildError: unknown) => {
      console.error(
        "[Discord OAuth] Falha de conexão ao adicionar usuário ao servidor:",
        guildError,
      );
      return null;
    });
    if (guildResponse && !guildResponse.ok && guildResponse.status !== 204) {
      console.error(
        `[Discord OAuth] Discord recusou entrada no servidor (${guildResponse.status}):`,
        (await guildResponse.text()).slice(0, 500),
      );
    }
  } else if (oauthProvider === "discord" && discordId) {
    console.error(
      "[Discord OAuth] Entrada automática não executada. Confira DISCORD_GUILD_ID, DISCORD_BOT_TOKEN e o escopo guilds.join.",
    );
  }

  let destination = next;
  if (data.user?.id) {
    const { data: profile, error: onboardingError } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    if (onboardingError) {
      console.error(
        "[Auth OAuth] Não foi possível consultar o onboarding:",
        onboardingError.message,
      );
    } else if (profile?.onboarding_completed !== true) {
      destination = `/conta?next=${encodeURIComponent(next)}`;
    }
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
