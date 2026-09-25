import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safe-redirect";

function safeAuthNext(value: string | null, fallback: string) {
  if (!value) return fallback;
  if (value.startsWith("/")) return safeInternalPath(value, fallback);

  try {
    const parsed = new URL(value);
    return safeInternalPath(`${parsed.pathname}${parsed.search}${parsed.hash}`, fallback);
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?auth_error=confirm_expired", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/forgot-password?error=expired", url.origin));
    }
    return NextResponse.redirect(new URL("/login?auth_error=confirm_expired", url.origin));
  }

  if (type === "recovery") {
    const next = safeAuthNext(url.searchParams.get("next"), "/reset-password");
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const next = safeAuthNext(url.searchParams.get("next"), "/conta");
  const confirmedUrl = new URL("/auth/confirmed", url.origin);
  confirmedUrl.searchParams.set("next", next);
  return NextResponse.redirect(confirmedUrl);
}
