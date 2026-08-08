/**
 * Map a raw account_activities row → ChatGPT export record.
 * No Grok scores, no invented features, missing ≠ 0.
 */

export type ExportRecord = {
  x_post_id: string | null;
  published_at: string | null;
  origin: string | null;
  post_type: string;
  action_type: string | null;
  text: string | null;
  conversation_id: string | null;
  in_reply_to_user_id: string | null;
  x_author_id: string | null;
  source_post_url: string | null;
  referenced_tweets: unknown;
  media: {
    present: boolean;
    types: string[];
    count: number;
    keys: string[];
  };
  public_metrics: Record<string, number> | null;
  organic_metrics: Record<string, number> | null;
  non_public_metrics: Record<string, number> | null;
  metric_availability: {
    public: boolean;
    organic: boolean;
    non_public: boolean;
  };
  snapshot_count: number;
  latest_snapshot_at: string | null;
  lang: string | null;
  collection_source: string | null;
};

function asMetricObject(raw: unknown): Record<string, number> | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const out: Record<string, number> = {};
  let any = false;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) {
      out[k] = n;
      any = true;
    }
  }
  return any ? out : null;
}

function classifyPostType(row: Record<string, unknown>): string {
  const origin = String(row.origin || "");
  if (origin === "X_MENTION") return "MENTION";
  const pt = String(row.post_type || row.action_type || "").toUpperCase();
  if (pt.includes("REPLY")) return "REPLY";
  if (pt.includes("QUOTE")) return "QUOTE";
  if (pt.includes("REPOST") || pt.includes("RETWEET")) return "REPOST";
  if (pt.includes("MENTION")) return "MENTION";
  if (pt.includes("ORIGINAL") || pt === "POST") return "ORIGINAL";
  const meta = (row.meta || {}) as Record<string, unknown>;
  const refs = (meta.referenced_tweets || []) as Array<{ type?: string }>;
  const types = refs.map((r) => String(r.type || ""));
  if (types.includes("retweeted")) return "REPOST";
  if (types.includes("quoted")) return "QUOTE";
  if (types.includes("replied_to")) return "REPLY";
  return pt || "ORIGINAL";
}

function extractMedia(meta: Record<string, unknown>): ExportRecord["media"] {
  const attachments = meta.attachments as
    | { media_keys?: string[] }
    | null
    | undefined;
  const keys = attachments?.media_keys || [];
  const raw = meta.raw as Record<string, unknown> | null | undefined;
  const includes = (raw?.includes as Record<string, unknown>) || {};
  const mediaArr =
    (includes.media as Array<{ type?: string; media_key?: string }>) || [];
  const types = mediaArr
    .map((m) => String(m.type || "unknown"))
    .filter(Boolean);
  return {
    present: keys.length > 0 || types.length > 0,
    types: Array.from(new Set(types)),
    count: Math.max(keys.length, types.length),
    keys: keys.map(String),
  };
}

export function buildEvidenceRecord(
  row: Record<string, unknown>,
  snap?: { count: number; latestAt: string | null }
): ExportRecord {
  const meta = (row.meta || {}) as Record<string, unknown>;
  const publicM = asMetricObject(meta.public_metrics);
  const organicM = asMetricObject(meta.organic_metrics);
  const nonPublicM = asMetricObject(meta.non_public_metrics);

  return {
    x_post_id: row.x_post_id ? String(row.x_post_id) : null,
    published_at: (row.published_at as string) || null,
    origin: row.origin ? String(row.origin) : null,
    post_type: classifyPostType(row),
    action_type: row.action_type ? String(row.action_type) : null,
    text: typeof row.text_body === "string" ? row.text_body : null,
    conversation_id:
      (row.conversation_id as string) ||
      (meta.conversation_id as string) ||
      null,
    in_reply_to_user_id:
      (row.in_reply_to_user_id as string) ||
      (meta.in_reply_to_user_id as string) ||
      null,
    x_author_id: row.x_author_id ? String(row.x_author_id) : null,
    source_post_url: row.source_post_url ? String(row.source_post_url) : null,
    referenced_tweets: meta.referenced_tweets ?? null,
    media: extractMedia(meta),
    public_metrics: publicM,
    organic_metrics: organicM,
    non_public_metrics: nonPublicM,
    metric_availability: {
      public: publicM != null,
      organic: organicM != null,
      non_public: nonPublicM != null,
    },
    snapshot_count: snap?.count ?? 0,
    latest_snapshot_at: snap?.latestAt ?? null,
    lang: meta.lang ? String(meta.lang) : null,
    collection_source: row.collection_source
      ? String(row.collection_source)
      : null,
  };
}
