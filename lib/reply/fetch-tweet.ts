/**
 * X target fetch — TARGET ONLY by default.
 * Parent/root/other replies require separate explicit calls.
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

export type RequestScope =
  | "TARGET_POST_ONLY"
  | "TARGET_REPLY_ONLY"
  | "PARENT_ONLY"
  | "ROOT_ONLY"
  | "OTHER_REACTIONS";

export type TargetFetchResult = {
  target: ThreadContext;
  request_scope: RequestScope;
  other_replies_requested: false;
  other_reply_fetch_count: 0;
  conversation_pagination_count: 0;
  x_endpoint: string;
  x_query_summary: string;
  is_reply: boolean;
  parent_id_hint?: string | null;
  conversation_id?: string | null;
};

export type OtherReactionsResult = {
  conversation_id: string;
  max_requested: number;
  replies: Array<{
    id: string;
    text: string;
    author_id?: string | null;
    created_at?: string | null;
  }>;
  request_scope: "OTHER_REACTIONS";
  other_replies_requested: true;
  other_reply_fetch_count: number;
  conversation_pagination_count: 0;
  x_endpoint: string;
  x_query_summary: string;
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

async function fetchTweetByIdOnly(
  token: string,
  id: string
): Promise<{ tweet: any; user?: any }> {
  const q = new URLSearchParams({
    ids: id,
    "tweet.fields": TWEET_FIELDS_PUBLIC_ONLY,
    expansions: "author_id",
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

  const tweet = (data.data || []).find((t: any) => String(t.id) === String(id));
  if (!tweet) throw new Error("Tweet not found or not accessible");

  const users = data.includes?.users || [];
  const user = users.find((u: any) => String(u.id) === String(tweet.author_id));
  return { tweet, user };
}

function isReplyTweet(tweet: any): boolean {
  const refs: { type: string; id: string }[] = tweet.referenced_tweets || [];
  return refs.some((r) => r.type === "replied_to") || Boolean(tweet.in_reply_to_user_id);
}

function parentIdHint(tweet: any): string | null {
  const refs: { type: string; id: string }[] = tweet.referenced_tweets || [];
  const parent = refs.find((r) => r.type === "replied_to");
  return parent?.id ? String(parent.id) : null;
}

export async function fetchTargetOnly(statusId: string): Promise<TargetFetchResult> {
  const token = await getToken();
  const { tweet, user } = await fetchTweetByIdOnly(token, statusId);
  const reply = isReplyTweet(tweet);
  const scope: RequestScope = reply ? "TARGET_REPLY_ONLY" : "TARGET_POST_ONLY";

  const target: ThreadContext = {
    target_id: String(tweet.id),
    target_text: String(tweet.text || ""),
    target_author_id: tweet.author_id ? String(tweet.author_id) : null,
    target_author_username: user?.username || null,
    created_at: tweet.created_at || null,
    conversation_id: tweet.conversation_id || null,
    parent_id: parentIdHint(tweet),
    parent_text: null,
    root_id: null,
    root_text: null,
    fetched_via: "X_API",
  };

  return {
    target,
    request_scope: scope,
    other_replies_requested: false,
    other_reply_fetch_count: 0,
    conversation_pagination_count: 0,
    x_endpoint: "GET https://api.x.com/2/tweets",
    x_query_summary: `ids=${statusId}; expansions=author_id only; no referenced_tweets; no search; no pagination`,
    is_reply: reply,
    parent_id_hint: parentIdHint(tweet),
    conversation_id: tweet.conversation_id ? String(tweet.conversation_id) : null,
  };
}

export async function fetchSingleRelated(
  statusId: string,
  kind: "parent" | "root"
): Promise<{
  text: string;
  id: string;
  author_username?: string | null;
  request_scope: RequestScope;
  other_reply_fetch_count: 0;
  x_endpoint: string;
  x_query_summary: string;
}> {
  const token = await getToken();
  const { tweet } = await fetchTweetByIdOnly(token, statusId);
  const refs: { type: string; id: string }[] = tweet.referenced_tweets || [];
  const parent = refs.find((r) => r.type === "replied_to");
  const relatedId =
    kind === "parent"
      ? parent?.id
      : parent?.id || tweet.conversation_id || null;

  if (!relatedId) {
    throw new Error(kind === "parent" ? "No parent reference on target" : "No root/parent id available");
  }

  const related = await fetchTweetByIdOnly(token, String(relatedId));
  return {
    id: String(related.tweet.id),
    text: String(related.tweet.text || ""),
    author_username: related.user?.username || null,
    request_scope: kind === "parent" ? "PARENT_ONLY" : "ROOT_ONLY",
    other_reply_fetch_count: 0,
    x_endpoint: "GET https://api.x.com/2/tweets",
    x_query_summary: `ids=${relatedId}; expansions=author_id only; single related object`,
  };
}

export async function fetchOtherReactions(
  conversationId: string,
  maxResults: 10 | 20 | 50 = 10
): Promise<OtherReactionsResult> {
  const token = await getToken();
  const capped = Math.min(Math.max(maxResults, 10), 50) as 10 | 20 | 50;

  const q = new URLSearchParams({
    query: `conversation_id:${conversationId}`,
    max_results: String(Math.min(capped, 100)),
    "tweet.fields": "created_at,author_id,text,conversation_id",
  });

  const res = await fetch(`https://api.x.com/2/tweets/search/recent?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail ||
        data.title ||
        data.errors?.[0]?.message ||
        `X search ${res.status} (other reactions may require search access)`
    );
  }

  const rows = (data.data || []).slice(0, capped).map((t: any) => ({
    id: String(t.id),
    text: String(t.text || ""),
    author_id: t.author_id ? String(t.author_id) : null,
    created_at: t.created_at || null,
  }));

  return {
    conversation_id: conversationId,
    max_requested: capped,
    replies: rows,
    request_scope: "OTHER_REACTIONS",
    other_replies_requested: true,
    other_reply_fetch_count: rows.length,
    conversation_pagination_count: 0,
    x_endpoint: "GET https://api.x.com/2/tweets/search/recent",
    x_query_summary: `conversation_id:${conversationId}; max_results=${capped}; no next_token pagination`,
  };
}

/** @deprecated Use fetchTargetOnly */
export async function fetchThreadContextByStatusId(
  statusId: string
): Promise<ThreadContext> {
  const r = await fetchTargetOnly(statusId);
  return r.target;
}
