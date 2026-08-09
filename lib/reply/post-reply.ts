/**
 * Publish a reply via X API (not Fedica).
 * Requires tweet.write scope + explicit Creator 「게시」 action.
 */

import { createClient } from "@/lib/supabase/server";
import { getOAuthConfig, refreshAccessToken } from "@/lib/x/oauth";

type Conn = {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

async function getToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data } = await supabase
    .from("account_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", user.id)
    .eq("platform", "x")
    .maybeSingle();

  const conn = data as Conn | null;
  if (!conn?.access_token) {
    throw new Error("X not connected — Connect X first (with write permission)");
  }

  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) return conn.access_token;

  if (!conn.refresh_token) {
    throw new Error("X token expired — reconnect X");
  }

  const { clientId, clientSecret } = getOAuthConfig();
  const tokens = await refreshAccessToken({
    refreshToken: conn.refresh_token,
    clientId,
    clientSecret,
  });

  await supabase
    .from("account_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || conn.refresh_token,
      token_expires_at: new Date(
        Date.now() + (tokens.expires_in || 7200) * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("platform", "x");

  return tokens.access_token;
}

export type PostReplyResult = {
  id: string;
  text: string;
  in_reply_to_tweet_id: string;
  x_endpoint: string;
};

export async function postReplyToX(params: {
  text: string;
  inReplyToTweetId: string;
}): Promise<PostReplyResult> {
  const text = params.text.trim();
  const inReplyToTweetId = String(params.inReplyToTweetId || "").trim();

  if (!text) throw new Error("Reply text is empty");
  if (text.length > 280) {
    throw new Error(`Reply too long (${text.length}/280)`);
  }
  if (!/^\d+$/.test(inReplyToTweetId)) {
    throw new Error("Valid in_reply_to tweet id required");
  }

  const token = await getToken();
  const body = {
    text,
    reply: { in_reply_to_tweet_id: inReplyToTweetId },
  };

  const res = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.detail ||
      data.title ||
      data.errors?.[0]?.message ||
      data.error_description ||
      `X post failed (${res.status})`;
    if (res.status === 403) {
      throw new Error(
        `${msg} — If you just enabled write, reconnect X in the app (tweet.write).`
      );
    }
    throw new Error(msg);
  }

  const id = data.data?.id ? String(data.data.id) : "";
  if (!id) throw new Error("X returned success but no tweet id");

  return {
    id,
    text: data.data?.text ? String(data.data.text) : text,
    in_reply_to_tweet_id: inReplyToTweetId,
    x_endpoint: "POST https://api.x.com/2/tweets",
  };
}
