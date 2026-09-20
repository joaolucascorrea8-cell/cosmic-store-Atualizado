import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // Aceita exclusivamente tokens de recuperação.
  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(
      new URL("/forgot-password?error=invalid", url.origin)
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/forgot-password?error=expired", url.origin)
    );
  }

  // O Supabase validou o token e criou a sessão.
  return NextResponse.redirect(
    new URL("/reset-password", url.origin)
  );
}