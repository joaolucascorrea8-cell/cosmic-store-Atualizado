import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (guildId && botToken && providerToken && discordIdentity?.id) {
    await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordIdentity.id}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: providerToken }),
    }).catch(() => undefined);
  }

  if (next?.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
