/**
 * 14-Day Learning Batch orchestrator (structure + free local steps).
 * Paid xAI only when caller sets usePaidAI=true after explicit user action.
 * Does not wipe historical evidence.
 */

import {
  createAudienceSnapshot,
  buildAudienceIntelligenceForPlanner,
  formatAudienceIntelligenceForPlanner,
  type AudienceSnapshot,
  type AudienceIntelligenceForPlanner,
} from "./audience-snapshot";
import {
  updatePatternsFromBatch,
  formatPerformanceIntelligenceForPlanner,
  seedBaselineCandidates,
  featureKeyFromParts,
  type PerformancePattern,
  type BatchPerformanceSummary,
} from "./performance-patterns";
import { extractFeatures } from "./features";

export type LearningBatchRecord = {
  batch_id: string;
  period_start: string | null;
  period_end: string | null;
  source: string;
  imported_at: string;
  evidence_type: "learning_batch_14d";
  status: "validated_sources" | "processed" | "failed";
  file_hashes: string[];
  notes?: string;
};

export type PublishedMetricRow = {
  postId?: string | null;
  contentSnippet: string;
  status?: string;
  followersGained?: number;
  profileVisits?: number;
  bookmarks?: number;
  replies?: number;
  likes?: number;
  impressions?: number;
  origin?: string;
};

export type FourteenDayBatchInput = {
  batch_id?: string;
  period_start?: string | null;
  period_end?: string | null;
  publishedMetrics?: PublishedMetricRow[];
  audience?: {
    interests?: string[];
    topicCategories?: string[];
    sentiment?: string;
    composition?: AudienceSnapshot["composition"];
    quality?: AudienceSnapshot["quality"];
    affinity?: AudienceSnapshot["affinity"];
  };
  priorAudienceSnapshots?: AudienceSnapshot[];
  priorPerformancePatterns?: PerformancePattern[];
  seedBaselineIfEmpty?: boolean;
  file_hashes?: string[];
  usePaidAI?: boolean;
};

export type FourteenDayBatchResult = {
  batch: LearningBatchRecord;
  audience_snapshot: AudienceSnapshot | null;
  audience_intelligence: AudienceIntelligenceForPlanner;
  audience_planner_block: string;
  performance_patterns: PerformancePattern[];
  performance_planner_block: string;
  report: {
    period: string;
    audience: {
      snapshot_count: number;
      movement_summary: string[];
      confidence: string;
    };
    performance: {
      published: number;
      candidates: number;
      supported: number;
      validated: number;
      weakened: number;
    };
    revenue: string;
    planner: string;
  };
};

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `h${Math.abs(h)}`;
}

export function runFourteenDayBatch(
  input: FourteenDayBatchInput
): FourteenDayBatchResult {
  const batch_id =
    input.batch_id ||
    `batch-14d-${(input.period_end || new Date().toISOString().slice(0, 10)).replace(/-/g, "")}`;

  const hashes = input.file_hashes || [];
  const batch: LearningBatchRecord = {
    batch_id,
    period_start: input.period_start || null,
    period_end: input.period_end || null,
    source: "user_14d_import",
    imported_at: new Date().toISOString(),
    evidence_type: "learning_batch_14d",
    status: "processed",
    file_hashes: hashes,
  };

  const priorSnaps = [...(input.priorAudienceSnapshots || [])];
  let newSnap: AudienceSnapshot | null = null;
  if (input.audience) {
    newSnap = createAudienceSnapshot({
      batch_id,
      period_start: input.period_start,
      period_end: input.period_end,
      interests: input.audience.interests,
      topicCategories: input.audience.topicCategories,
      sentiment: input.audience.sentiment,
      composition: input.audience.composition,
      quality: input.audience.quality,
      affinity: input.audience.affinity,
      coverage_note: "14d batch audience snapshot",
    });
    const sig = simpleHash(
      JSON.stringify({
        i: newSnap.interests,
        p: newSnap.period_end,
        s: newSnap.sentiment,
      })
    );
    const dup = priorSnaps.some(
      (s) =>
        simpleHash(
          JSON.stringify({
            i: s.interests,
            p: s.period_end,
            s: s.sentiment,
          })
        ) === sig
    );
    if (!dup) priorSnaps.push(newSnap);
    else newSnap = null;
  }

  const audience_intelligence = buildAudienceIntelligenceForPlanner(priorSnaps);
  const audience_planner_block =
    formatAudienceIntelligenceForPlanner(audience_intelligence);

  const published = (input.publishedMetrics || []).filter((r) => {
    const st = (r.status || "published").toLowerCase();
    return st === "published" || st === "public" || !r.status;
  });

  const featureAgg = new Map<
    string,
    BatchPerformanceSummary["feature_hits"][0]
  >();
  for (const row of published) {
    const feat = extractFeatures(row.contentSnippet || "");
    if (feat.actionType === "REPOST" || feat.isReply) continue;
    const key = featureKeyFromParts({
      topic: feat.topicGuess,
      media: feat.mediaPresence,
      experience: feat.experienceUsage || "unknown",
      length: feat.lengthBucket,
    });
    const prev = featureAgg.get(key) || {
      feature_key: key,
      feature_summary: `${feat.topicGuess} · ${feat.lengthBucket}${feat.mediaPresence ? " · media" : ""}`,
      followersGained: 0,
      profileVisits: 0,
      bookmarks: 0,
      replies: 0,
      likes: 0,
      impressions: 0,
      sample_count: 0,
    };
    prev.followersGained += Number(row.followersGained) || 0;
    prev.profileVisits += Number(row.profileVisits) || 0;
    prev.bookmarks += Number(row.bookmarks) || 0;
    prev.replies += Number(row.replies) || 0;
    prev.likes += Number(row.likes) || 0;
    prev.impressions += Number(row.impressions) || 0;
    prev.sample_count += 1;
    featureAgg.set(key, prev);
  }

  const batchSummary: BatchPerformanceSummary = {
    batch_id,
    published_count: published.length,
    feature_hits: Array.from(featureAgg.values()),
  };

  let patterns = [...(input.priorPerformancePatterns || [])];
  if (patterns.length === 0 && input.seedBaselineIfEmpty !== false) {
    patterns = seedBaselineCandidates("baseline-v1");
  }
  if (published.length > 0) {
    patterns = updatePatternsFromBatch(patterns, batchSummary);
  }

  const performance_planner_block =
    formatPerformanceIntelligenceForPlanner(patterns);

  const report = {
    period: `${batch.period_start || "?"} ~ ${batch.period_end || "?"}`,
    audience: {
      snapshot_count: priorSnaps.length,
      movement_summary: audience_intelligence.movement.map(
        (m) => `${m.signal}: ${m.status}`
      ),
      confidence: audience_intelligence.current_state.confidence,
    },
    performance: {
      published: published.length,
      candidates: patterns.filter((p) => p.status === "CANDIDATE").length,
      supported: patterns.filter((p) => p.status === "SUPPORTED_CANDIDATE")
        .length,
      validated: patterns.filter((p) => p.status === "VALIDATED").length,
      weakened: patterns.filter((p) => p.status === "WEAKENED").length,
    },
    revenue: "NO NEW REVENUE EVIDENCE",
    planner: "Audience + Performance intelligence ready for next planning cycle",
  };

  return {
    batch,
    audience_snapshot: newSnap,
    audience_intelligence,
    audience_planner_block,
    performance_patterns: patterns,
    performance_planner_block,
    report,
  };
}
