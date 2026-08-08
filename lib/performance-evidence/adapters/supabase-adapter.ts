/**
 * SupabaseEvidenceAdapter — read-only.
 * v5.6.2: attaches x_metric_snapshots counts per x_post_id (temporal evidence).
 * Activity meta metrics remain "current cache"; snapshotCount is temporal layer.
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

  /** Build x_post_id → snapshot count map (paginated; no full RAM dump of metrics). */
  private async loadSnapshotCounts(
    accountId: string
  ): Promise<Map<string, { count: number; latestAt: string | null }>> {
    const map = new Map<string, { count: number; latestAt: string | null }>();
    const pageSize = 1000;
    let offset = 0;
    for (;;) {
      const { data, error } = await this.supabase
        .from("x_metric_snapshots")
        .select("x_post_id, snapshot_at")
        .eq("account_id", accountId)
        .order("snapshot_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(`x_metric_snapshots: ${error.message}`);
      if (!data?.length) break;
      for (const row of data) {
        const pid = String(row.x_post_id || "");
        if (!pid) continue;
        const prev = map.get(pid) || { count: 0, latestAt: null };
        prev.count += 1;
        const at = (row.snapshot_at as string) || null;
        if (at && (!prev.latestAt || at > prev.latestAt)) prev.latestAt = at;
        map.set(pid, prev);
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return map;
  }

  async *iterateEvidence(options?: {
    accountId?: string;
    pageSize?: number;
  }): AsyncGenerator<NormalizedEvidence[], void, unknown> {
    const accountId = options?.accountId || this.defaultAccountId;
    if (!accountId) throw new Error("accountId required");
    const pageSize = options?.pageSize ?? 200;

    const snapshotMap = await this.loadSnapshotCounts(accountId);

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

      const batch: NormalizedEvidence[] = data.map(
        (row: Record<string, unknown>) => {
          const pt = String(row.post_type || row.action_type || "").toUpperCase();
          const isReply = pt.includes("REPLY");
          const isQuote = pt.includes("QUOTE");
          const isRepost = pt.includes("REPOST") || pt.includes("RETWEET");
          const isMention =
            row.origin === "X_MENTION" || pt.includes("MENTION");
          const isOriginal =
            !isReply && !isQuote && !isRepost && !isMention;
          const meta = (row.meta || {}) as Record<string, unknown>;
          const toBag = (raw: Record<string, unknown>) => {
            const out: Record<
              string,
              {
                presence: "MISSING" | "PRESENT_ZERO" | "PRESENT_NON_ZERO";
                value: number | null;
              }
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
          const postId = String(row.x_post_id || row.id);
          const snap = snapshotMap.get(postId);

          return {
            source: "X_API" as const,
            sourceRecordId: String(row.id),
            postId,
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
                    : isMention
                      ? "MENTION"
                      : pt || "UNKNOWN",
            isOriginal,
            isQuote,
            isReply,
            isRepost,
            textPresence: Boolean(
              typeof row.text_body === "string" && row.text_body.trim()
            ),
            mediaPresence: false,
            // Current/activity-cache metrics (not a substitute for temporal history)
            publicMetrics,
            organicMetrics: toBag(
              (meta.organic_metrics || {}) as Record<string, unknown>
            ),
            nonPublicMetrics: toBag(
              (meta.non_public_metrics || {}) as Record<string, unknown>
            ),
            snapshotTimestamp: snap?.latestAt ?? null,
            snapshotCount: snap?.count ?? 0,
            metricAvailability: {
              public: Object.keys(publicMetrics).length > 0,
              organic: Boolean(meta.organic_metrics),
              nonPublic: Boolean(meta.non_public_metrics),
            },
          };
        }
      );
      yield batch;
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
}
