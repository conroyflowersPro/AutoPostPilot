/**
 * Fetch a single tweet + minimal parent/root context via X API.
 * Must only be called after requireExplicitApiConsent.
 */

import { createClient } from "@/lib/supabase/server";
import { getOAuthConfig, refreshAccessToken } from "@/lib/x/oauth";
import { TWEET_FIELDS_PUBLIC_ONLY } from "@/lib/x/client";
import type { ThreadContext } from "./types";

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
    throw new Error("X not connected — Connect X first");
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

async function fetchTweetsByIds(
  token: string,
  ids: string[]
): Promise<{ byId: Record<string, any>; users: Record<string, any>; raw: any }> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 8);
  if (!unique.length) return { byId: {}, users: {}, raw: {} };

  const q = new URLSearchParams({
    ids: unique.join(","),
    "tweet.fields": TWEET_FIELDS_PUBLIC_ONLY,
    expansions: "author_id,referenced_tweets.id",
    "user.fields": "username,name",
  });

  const res = await fetch(`https://api.x.com/2/tweets?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail || data.title || data.errors?.[0]?.message || `X API ${res.status}`
    );
  }

  const byId: Record<string, any> = {};
  for (const t of data.data || []) {
    byId[String(t.id)] = t;
  }
  for (const t of data.includes?.tweets || []) {
    byId[String(t.id)] = t;
  }
  const users: Record<string, any> = {};
  for (const u of data.includes?.users || []) {
    users[String(u.id)] = u;
  }
  return { byId, users, raw: data };
}

export async function fetchThreadContextByStatusId(
  statusId: string
): Promise<ThreadContext> {
  const token = await getToken();
  const first = await fetchTweetsByIds(token, [statusId]);
  const target = first.byId?.[statusId];
  if (!target) {
    throw new Error("Tweet not found or not accessible");
  }

  const refs: { type: string; id: string }[] = target.referenced_tweets || [];
  const parentRef = refs.find((r) => r.type === "replied_to");
  const rootish = refs.find((r) => r.type === "replied_to") || refs[0];

  const extraIds = [parentRef?.id, rootish?.id].filter(Boolean) as string[];
  let parent: any = null;
  let root: any = null;

  if (extraIds.length) {
    const more = await fetchTweetsByIds(token, extraIds);
    if (parentRef?.id) parent = more.byId?.[parentRef.id] || null;
    if (rootish?.id && rootish.id !== parentRef?.id) {
      root = more.byId?.[rootish.id] || null;
    }
    Object.assign(first.byId || {}, more.byId || {});
    Object.assign(first.users || {}, more.users || {});
  }

  const author = first.users?.[String(target.author_id)];

  return {
    target_id: String(target.id),
    target_text: String(target.text || ""),
    target_author_id: target.author_id ? String(target.author_id) : null,
    target_author_username: author?.username || null,
    created_at: target.created_at || null,
    conversation_id: target.conversation_id || null,
    parent_id: parent ? String(parent.id) : parentRef?.id || null,
    parent_text: parent ? String(parent.text || "") : null,
    root_id: root ? String(root.id) : null,
    root_text: root ? String(root.text || "") : null,
    fetched_via: "X_API",
  };
}
