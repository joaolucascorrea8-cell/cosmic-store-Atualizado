import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?auth_error=callback`
    );
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?auth_error=callback`
    );
  }

  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const providerToken = data.session?.provider_token;
  const discordIdentity = data.user?.identities?.find((identity) => identity.provider === "discord");
  const discordId = discordIdentity?.id;

  if (discordId && data.user?.id) {
    const admin = createAdminClient();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ auth_provider: "discord", discord_id: discordId })
      .eq("id", data.user.id);
    if (profileError) {
      console.error("[Discord OAuth] Não foi possível salvar o discord_id:", profileError.message);
    }
  }

  if (guildId && botToken && providerToken && discordId) {
    const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: providerToken }),
    }).catch((guildError: unknown) => {
      console.error("[Discord OAuth] Falha de conexão ao adicionar usuário ao servidor:", guildError);
      return null;
    });
    if (guildResponse && !guildResponse.ok && guildResponse.status !== 204) {
      console.error(`[Discord OAuth] Discord recusou entrada no servidor (${guildResponse.status}):`, (await guildResponse.text()).slice(0, 500));
    }
  } else if (discordId) {
    console.error("[Discord OAuth] Entrada automática não executada. Confira DISCORD_GUILD_ID, DISCORD_BOT_TOKEN e o escopo guilds.join.");
  }

  if (next?.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
