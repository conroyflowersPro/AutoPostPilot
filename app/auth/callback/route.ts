import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth callback (PKCE)
 * Handles:
 * - Email confirmation
 * - Password recovery / reset links
 * - Magic link (if used later)
 *
 * Configure in Supabase Dashboard → Authentication → URL Configuration:
 *   Redirect URLs: https://YOUR_DOMAIN/auth/callback
 *   Site URL: https://YOUR_DOMAIN
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Supabase sometimes returns error in query
  if (errorParam) {
    const msg = encodeURIComponent(
      errorDescription || errorParam || "인증에 실패했습니다."
    );
    return NextResponse.redirect(`${origin}/login?error=${msg}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const next =
        nextParam && nextParam.startsWith("/")
          ? nextParam
          : "/auth/update-password";

      const safeNext =
        next === "/" || next === "/login"
          ? user
            ? "/"
            : "/login"
          : next;

      return NextResponse.redirect(`${origin}${safeNext}`);
    }

    const msg = encodeURIComponent(error.message || "세션 교환 실패");
    return NextResponse.redirect(`${origin}/login?error=${msg}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "유효하지 않은 인증 링크입니다. 비밀번호 찾기를 다시 시도해 주세요."
    )}`
  );
}
