import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  fetchXUserMe,
  getOAuthConfig,
} from "@/lib/x/oauth";

const APP_ORIGIN = process.env.URL || "https://autopostpilot.netlify.app";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${APP_ORIGIN}/?x_oauth=error&reason=${encodeURIComponent(error)}`
    );
  }

  const storedState = request.cookies.get("x_oauth_state")?.value;
  const codeVerifier = request.cookies.get("x_oauth_verifier")?.value;

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(
      `${APP_ORIGIN}/?x_oauth=error&reason=invalid_state`
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${APP_ORIGIN}/login`);
    }

    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    const me = await fetchXUserMe(tokens.access_token);
    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 7200) * 1000
    ).toISOString();

    const row = {
      user_id: user.id,
      platform: "x",
      x_user_id: me.id,
      handle: me.username,
      display_name: me.name,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt,
      scopes: tokens.scope || null,
      followers_count: me.public_metrics?.followers_count ?? null,
      following_count: me.public_metrics?.following_count ?? null,
      profile_image_url: me.profile_image_url || null,
      last_sync_status: "connected",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("account_connections")
      .upsert(row, { onConflict: "user_id,platform" });

    if (upsertError) {
      console.error("account_connections upsert", upsertError);
      return NextResponse.redirect(
        `${APP_ORIGIN}/?x_oauth=error&reason=${encodeURIComponent(upsertError.message)}`
      );
    }

    const res = NextResponse.redirect(`${APP_ORIGIN}/?x_oauth=connected`);
    res.cookies.set("x_oauth_verifier", "", { path: "/", maxAge: 0 });
    res.cookies.set("x_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "callback_failed";
    console.error("X OAuth callback", e);
    return NextResponse.redirect(
      `${APP_ORIGIN}/?x_oauth=error&reason=${encodeURIComponent(msg)}`
    );
  }
}
