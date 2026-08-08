import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  getOAuthConfig,
} from "@/lib/x/oauth";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL("/login", process.env.URL || "https://autopostpilot.netlify.app")
      );
    }

    const { clientId, redirectUri } = getOAuthConfig();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    const res = NextResponse.redirect(authorizeUrl);
    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600,
    };
    res.cookies.set("x_oauth_verifier", codeVerifier, cookieOpts);
    res.cookies.set("x_oauth_state", state, cookieOpts);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth start failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
