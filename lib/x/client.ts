/**
 * Official X API client boundary.
 * Uses user OAuth access token from account_connections.
 * Forbidden: scraping, browser automation, unofficial endpoints.
 */

import { createClient } from "@/lib/supabase/server";
import { getOAuthConfig, refreshAccessToken } from "@/lib/x/oauth";

export type XUserProfile = {
  id: string;
  username: string;
  name: string;
  profileImageUrl?: string;
  followersCount?: number;
  followingCount?: number;
  tweetCount?: number;
};

export type XTimelinePost = {
  id: string;
  text: string;
  createdAt: string;
  referencedTweets?: { type: string; id: string }[];
  publicMetrics?: Record<string, number>;
};

export type XClient = {
  getMe(): Promise<XUserProfile>;
  getUserTimeline(params: {
    userId: string;
    sinceId?: string;
    maxResults?: number;
    paginationToken?: string;
  }): Promise<{ posts: XTimelinePost[]; nextToken?: string }>;
};

export class XClientNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ||
        "X API user credentials are not configured. Connect X OAuth (tweet.read, users.read) before enabling Daily Sync."
    );
    this.name = "XClientNotConfiguredError";
  }
}

type ConnectionRow = {
  id: string;
  x_user_id: string | null;
  handle: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

async function loadConnection(): Promise<ConnectionRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("account_connections")
    .select(
      "id, x_user_id, handle, access_token, refresh_token, token_expires_at"
    )
    .eq("user_id", user.id)
    .eq("platform", "x")
    .maybeSingle();

  return data as ConnectionRow | null;
}

async function ensureAccessToken(conn: ConnectionRow): Promise<string> {
  if (!conn.access_token) {
    throw new XClientNotConfiguredError("No access token stored");
  }

  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;
  const stillValid = expiresAt > Date.now() + 60_000;

  if (stillValid) return conn.access_token;

  if (!conn.refresh_token) {
    throw new XClientNotConfiguredError(
      "Access token expired and no refresh token — reconnect X"
    );
  }

  const { clientId, clientSecret } = getOAuthConfig();
  const tokens = await refreshAccessToken({
    refreshToken: conn.refresh_token,
    clientId,
    clientSecret,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const expires = new Date(
    Date.now() + (tokens.expires_in || 7200) * 1000
  ).toISOString();

  if (user) {
    await supabase
      .from("account_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        token_expires_at: expires,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("platform", "x");
  }

  return tokens.access_token;
}

/** Live client when user has connected X; otherwise throws. */
export async function createXClient(): Promise<XClient> {
  const conn = await loadConnection();
  if (!conn?.access_token) {
    throw new XClientNotConfiguredError();
  }

  const token = await ensureAccessToken(conn);

  return {
    async getMe() {
      const res = await fetch(
        "https://api.x.com/2/users/me?user.fields=public_metrics,profile_image_url,name,username",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.title || `getMe ${res.status}`);
      }
      const u = data.data;
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        profileImageUrl: u.profile_image_url,
        followersCount: u.public_metrics?.followers_count,
        followingCount: u.public_metrics?.following_count,
        tweetCount: u.public_metrics?.tweet_count,
      };
    },
    async getUserTimeline(params) {
      const q = new URLSearchParams({
        max_results: String(params.maxResults || 20),
        "tweet.fields": "created_at,public_metrics,referenced_tweets,text",
      });
      if (params.sinceId) q.set("since_id", params.sinceId);
      if (params.paginationToken) q.set("pagination_token", params.paginationToken);

      const res = await fetch(
        `https://api.x.com/2/users/${params.userId}/tweets?${q}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.detail || data.title || `timeline ${res.status}`
        );
      }

      const posts: XTimelinePost[] = (data.data || []).map(
        (t: {
          id: string;
          text: string;
          created_at: string;
          referenced_tweets?: { type: string; id: string }[];
          public_metrics?: Record<string, number>;
        }) => ({
          id: t.id,
          text: t.text,
          createdAt: t.created_at,
          referencedTweets: t.referenced_tweets,
          publicMetrics: t.public_metrics,
        })
      );

      return {
        posts,
        nextToken: data.meta?.next_token,
      };
    },
  };
}
