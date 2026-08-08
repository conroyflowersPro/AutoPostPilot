/**
 * SupabaseEvidenceAdapter — read-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvidenceSourceAdapter, NormalizedEvidence } from "../types";

export class SupabaseEvidenceAdapter implements EvidenceSourceAdapter {
  readonly source = "X_API" as const;
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly defaultAccountId?: string
  ) {}
  async estimateCount(): Promise<number | null> {
    const accountId = this.defaultAccountId;
    if (!accountId) return null;
    const { count } = await this.supabase
      .from("account_activities")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId);
    return count;
  }
  async *iterateEvidence(options?: {
    accountId?: string;
    pageSize?: number;
  }): AsyncGenerator<NormalizedEvidence[], void, unknown> {
    const accountId = options?.accountId || this.defaultAccountId;
    if (!accountId) throw new Error("accountId required");
    const pageSize = options?.pageSize ?? 200;
    let offset = 0;
    for (;;) {
      const { data, error } = await this.supabase
        .from("account_activities")
        .select(
          "id, x_post_id, published_at, origin, action_type, post_type, text_body, meta"
        )
        .eq("account_id", accountId)
        .order("published_at", { ascending: true, nullsFirst: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      const batch: NormalizedEvidence[] = data.map((row: Record<string, unknown>) => {
        const pt = String(row.post_type || row.action_type || "").toUpperCase();
        const isReply = pt.includes("REPLY");
        const isQuote = pt.includes("QUOTE");
        const isRepost = pt.includes("REPOST") || pt.includes("RETWEET");
        const isOriginal =
          !isReply && !isQuote && !isRepost && row.origin !== "X_MENTION";
        const meta = (row.meta || {}) as Record<string, unknown>;
        const toBag = (raw: Record<string, unknown>) => {
          const out: Record<
            string,
            { presence: "MISSING" | "PRESENT_ZERO" | "PRESENT_NON_ZERO"; value: number | null }
          > = {};
          for (const [k, v] of Object.entries(raw || {})) {
            const n = typeof v === "number" ? v : Number(v);
            if (!Number.isFinite(n))
              out[k] = { presence: "MISSING", value: null };
            else
              out[k] = {
                presence: n === 0 ? "PRESENT_ZERO" : "PRESENT_NON_ZERO",
                value: n,
              };
          }
          return out;
        };
        const publicMetrics = toBag(
          (meta.public_metrics || {}) as Record<string, unknown>
        );
        return {
          source: "X_API" as const,
          sourceRecordId: String(row.id),
          postId: String(row.x_post_id || row.id),
          publishedAt: (row.published_at as string) || null,
          activityType: String(row.action_type || row.origin || "UNKNOWN"),
          postType: isOriginal
            ? "ORIGINAL"
            : isQuote
              ? "QUOTE"
              : isReply
                ? "REPLY"
                : isRepost
                  ? "REPOST"
                  : pt || "UNKNOWN",
          isOriginal,
          isQuote,
          isReply,
          isRepost,
          textPresence: Boolean(
            typeof row.text_body === "string" && row.text_body.trim()
          ),
          mediaPresence: false,
          publicMetrics,
          organicMetrics: toBag(
            (meta.organic_metrics || {}) as Record<string, unknown>
          ),
          nonPublicMetrics: toBag(
            (meta.non_public_metrics || {}) as Record<string, unknown>
          ),
          snapshotTimestamp: null,
          snapshotCount: 0,
          metricAvailability: {
            public: Object.keys(publicMetrics).length > 0,
            organic: Boolean(meta.organic_metrics),
            nonPublic: Boolean(meta.non_public_metrics),
          },
        };
      });
      yield batch;
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
}
