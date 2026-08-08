/**
 * Official X API client boundary.
 * Phase 1A correction: request public_metrics + non_public_metrics + organic_metrics
 * when supported; never invent zeros; classify limits only after live response.
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

/** Preserve only keys present in the API response — never coerce missing → 0 */
export type MetricBag = Record<string, number>;

export type XTimelinePost = {
  id: string;
  text: string;
  createdAt: string;
  lang?: string | null;
  conversationId?: string | null;
  inReplyToUserId?: string | null;
  authorId?: string | null;
  referencedTweets?: { type: string; id: string }[];
  publicMetrics?: MetricBag | null;
  nonPublicMetrics?: MetricBag | null;
  organicMetrics?: MetricBag | null;
  entities?: Record<string, unknown> | null;
  attachments?: { media_keys?: string[] } | null;
  contextAnnotations?: unknown[] | null;
  raw?: Record<string, unknown>;
};

export type XMentionPost = XTimelinePost & {
  authorId: string;
};

export type CollectionEndReason =
  | "END_OF_AVAILABLE_HISTORY"
  | "API_ENDPOINT_LIMIT"
  | "RATE_LIMIT"
  | "PERMISSION_LIMIT"
  | "ERROR"
  | "MAX_PAGES_SAFETY"
  | "EMPTY_PAGE";

export type TimelineResult = {
  posts: XTimelinePost[];
  nextToken?: string;
  rateLimited?: boolean;
  error?: string;
  status?: number;
  fieldsMode?: "full_metrics" | "public_only" | "minimal";
  metricFieldEvidence?: {
    requested: string;
    rejected?: boolean;
    errorCode?: string | number;
    errorMessage?: string;
  };
};

export type XClient = {
  getMe(): Promise<XUserProfile>;
  getUserTimeline(params: {
    userId: string;
    sinceId?: string;
    untilId?: string;
    maxResults?: number;
    paginationToken?: string;
    preferPrivateMetrics?: boolean;
  }): Promise<TimelineResult>;
  getMentions(params: {
    userId: string;
    sinceId?: string;
    maxResults?: number;
    paginationToken?: string;
  }): Promise<TimelineResult & { posts: XMentionPost[] }>;
};

export class XClientNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ||
        "X API user credentials are not configured. Connect X OAuth before collection."
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
  scopes: string | null;
};

export const TWEET_FIELDS_FULL_METRICS =
  "created_at,public_metrics,non_public_metrics,organic_metrics,referenced_tweets,text,lang,conversation_id,in_reply_to_user_id,author_id,entities,attachments,context_annotations";

export const TWEET_FIELDS_PUBLIC_ONLY =
  "created_at,public_metrics,referenced_tweets,text,lang,conversation_id,in_reply_to_user_id,author_id,entities,attachments,context_annotations";

export const TWEET_FIELDS_MINIMAL =
  "created_at,public_metrics,referenced_tweets,text";

function pickNumericBag(obj: unknown): MetricBag | null {
  if (!obj || typeof obj !== "object") return null;
  const out: MetricBag = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "number" && !Number.isNaN(v)) {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

async function loadConnection(): Promise<ConnectionRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("account_connections")
    .select(
      "id, x_user_id, handle, access_token, refresh_token, token_expires_at, scopes"
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
  if (expiresAt > Date.now() + 60_000) return conn.access_token;

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

function mapTweet(t: Record<string, unknown>): XTimelinePost {
  const publicMetrics = pickNumericBag(t.public_metrics);
  const nonPublicMetrics = pickNumericBag(t.non_public_metrics);
  const organicMetrics = pickNumericBag(t.organic_metrics);

  return {
    id: String(t.id),
    text: String(t.text || ""),
    createdAt: String(t.created_at || ""),
    lang: (t.lang as string) ?? null,
    conversationId: (t.conversation_id as string) ?? null,
    inReplyToUserId: (t.in_reply_to_user_id as string) ?? null,
    authorId: (t.author_id as string) ?? null,
    referencedTweets: t.referenced_tweets as
      | { type: string; id: string }[]
      | undefined,
    publicMetrics,
    nonPublicMetrics,
    organicMetrics,
    entities: (t.entities as Record<string, unknown>) ?? null,
    attachments: (t.attachments as { media_keys?: string[] }) ?? null,
    contextAnnotations: (t.context_annotations as unknown[]) ?? null,
    raw: {
      id: t.id,
      created_at: t.created_at,
      lang: t.lang,
      conversation_id: t.conversation_id,
      in_reply_to_user_id: t.in_reply_to_user_id,
      author_id: t.author_id,
      referenced_tweets: t.referenced_tweets,
      public_metrics: t.public_metrics ?? null,
      non_public_metrics: t.non_public_metrics ?? null,
      organic_metrics: t.organic_metrics ?? null,
      attachments: t.attachments,
      context_annotations: t.context_annotations,
    },
  };
}

async function fetchTimelineOnce(
  token: string,
  userId: string,
  params: {
    sinceId?: string;
    untilId?: string;
    maxResults?: number;
    paginationToken?: string;
  },
  tweetFields: string
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  rateLimited: boolean;
}> {
  const q = new URLSearchParams({
    max_results: String(Math.min(params.maxResults || 100, 100)),
    "tweet.fields": tweetFields,
  });
  if (params.sinceId) q.set("since_id", params.sinceId);
  if (params.untilId) q.set("until_id", params.untilId);
  if (params.paginationToken) q.set("pagination_token", params.paginationToken);

  const res = await fetch(
    `https://api.x.com/2/users/${userId}/tweets?${q}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    data,
    rateLimited: res.status === 429,
  };
}

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
      const preferPrivate = params.preferPrivateMetrics !== false;

      if (preferPrivate) {
        const full = await fetchTimelineOnce(
          token,
          params.userId,
          params,
          TWEET_FIELDS_FULL_METRICS
        );
        if (full.rateLimited) {
          return {
            posts: [],
            rateLimited: true,
            status: 429,
            error: full.data?.detail || full.data?.title || "rate_limit",
            fieldsMode: "full_metrics",
            metricFieldEvidence: {
              requested: TWEET_FIELDS_FULL_METRICS,
              rejected: false,
              errorMessage: "rate_limit",
            },
          };
        }
        if (full.ok) {
          const posts = (full.data.data || []).map(mapTweet);
          return {
            posts,
            nextToken: full.data.meta?.next_token,
            status: full.status,
            fieldsMode: "full_metrics",
            metricFieldEvidence: {
              requested: TWEET_FIELDS_FULL_METRICS,
              rejected: false,
            },
          };
        }

        const errMsg =
          full.data?.detail ||
          full.data?.title ||
          full.data?.errors?.[0]?.message ||
          `timeline ${full.status}`;
        const errCode =
          full.data?.errors?.[0]?.code ?? full.data?.type ?? full.status;

        const pub = await fetchTimelineOnce(
          token,
          params.userId,
          params,
          TWEET_FIELDS_PUBLIC_ONLY
        );
        if (pub.ok) {
          return {
            posts: (pub.data.data || []).map(mapTweet),
            nextToken: pub.data.meta?.next_token,
            status: pub.status,
            fieldsMode: "public_only",
            metricFieldEvidence: {
              requested: TWEET_FIELDS_FULL_METRICS,
              rejected: true,
              errorCode: errCode,
              errorMessage: String(errMsg),
            },
            error: `private_metrics_rejected: ${errMsg}`,
          };
        }

        const min = await fetchTimelineOnce(
          token,
          params.userId,
          params,
          TWEET_FIELDS_MINIMAL
        );
        if (min.ok) {
          return {
            posts: (min.data.data || []).map(mapTweet),
            nextToken: min.data.meta?.next_token,
            status: min.status,
            fieldsMode: "minimal",
            metricFieldEvidence: {
              requested: TWEET_FIELDS_FULL_METRICS,
              rejected: true,
              errorCode: errCode,
              errorMessage: String(errMsg),
            },
            error: `fallback_minimal: ${errMsg}`,
          };
        }

        return {
          posts: [],
          status: full.status,
          error: String(errMsg),
          fieldsMode: "full_metrics",
          metricFieldEvidence: {
            requested: TWEET_FIELDS_FULL_METRICS,
            rejected: true,
            errorCode: errCode,
            errorMessage: String(errMsg),
          },
        };
      }

      const pub = await fetchTimelineOnce(
        token,
        params.userId,
        params,
        TWEET_FIELDS_PUBLIC_ONLY
      );
      if (pub.rateLimited) {
        return {
          posts: [],
          rateLimited: true,
          status: 429,
          error: "rate_limit",
          fieldsMode: "public_only",
        };
      }
      if (!pub.ok) {
        return {
          posts: [],
          status: pub.status,
          error:
            pub.data?.detail || pub.data?.title || `timeline ${pub.status}`,
          fieldsMode: "public_only",
        };
      }
      return {
        posts: (pub.data.data || []).map(mapTweet),
        nextToken: pub.data.meta?.next_token,
        status: pub.status,
        fieldsMode: "public_only",
      };
    },

    async getMentions(params) {
      const q = new URLSearchParams({
        max_results: String(Math.min(params.maxResults || 100, 100)),
        "tweet.fields": TWEET_FIELDS_PUBLIC_ONLY,
      });
      if (params.sinceId) q.set("since_id", params.sinceId);
      if (params.paginationToken)
        q.set("pagination_token", params.paginationToken);

      const res = await fetch(
        `https://api.x.com/2/users/${params.userId}/mentions?${q}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        return {
          posts: [],
          rateLimited: true,
          status: 429,
          error: data.detail || data.title || "rate_limit",
          fieldsMode: "public_only",
        };
      }
      if (!res.ok) {
        return {
          posts: [],
          status: res.status,
          error: data.detail || data.title || `mentions ${res.status}`,
          fieldsMode: "public_only",
        };
      }

      const posts: XMentionPost[] = (data.data || []).map(
        (t: Record<string, unknown>) => {
          const m = mapTweet(t);
          return {
            ...m,
            authorId: m.authorId || String(t.author_id || "unknown"),
          };
        }
      );
      return {
        posts,
        nextToken: data.meta?.next_token,
        status: res.status,
        fieldsMode: "public_only",
      };
    },
  };
}

export async function getXConnectionMeta(): Promise<{
  connected: boolean;
  connectionId?: string;
  xUserId?: string | null;
  handle?: string | null;
  scopes?: string | null;
  tokenPresent: boolean;
  tokenExpiresAt?: string | null;
} | null> {
  const conn = await loadConnection();
  if (!conn) {
    return { connected: false, tokenPresent: false };
  }
  return {
    connected: Boolean(conn.access_token),
    connectionId: conn.id,
    xUserId: conn.x_user_id,
    handle: conn.handle,
    scopes: conn.scopes,
    tokenPresent: Boolean(conn.access_token),
    tokenExpiresAt: conn.token_expires_at,
  };
}
