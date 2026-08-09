/**
 * Performance DNA — cumulative evidence + candidate lifecycle
 * Never auto-VALIDATED from a single batch or impressions-only.
 * AI drafts never enter this path (caller must pass published-only).
 */

export type PatternStatus =
  | "CANDIDATE"
  | "SUPPORTED_CANDIDATE"
  | "VALIDATED"
  | "WEAKENED"
  | "REJECTED"
  | "RETIRED"
  | "HISTORICAL";

export type PatternConfidence = "HIGH" | "MEDIUM" | "LOW";

export type PerformancePattern = {
  pattern_id: string;
  feature_key: string;
  feature_summary: string;
  status: PatternStatus;
  confidence: PatternConfidence;
  support_batches: string[];
  weaken_batches: string[];
  first_seen_batch: string;
  last_seen_batch: string;
  priority_metric_hits: {
    followersGained: number;
    profileVisits: number;
    bookmarks: number;
    replies: number;
  };
  impressions_only: boolean;
  sample_count: number;
  provenance: "published_only";
  notes?: string;
};

export type BatchPerformanceSummary = {
  batch_id: string;
  published_count: number;
  feature_hits: Array<{
    feature_key: string;
    feature_summary: string;
    followersGained: number;
    profileVisits: number;
    bookmarks: number;
    replies: number;
    likes: number;
    impressions: number;
    sample_count: number;
  }>;
};

export function isPrioritySuccess(m: {
  followersGained: number;
  profileVisits: number;
  bookmarks: number;
  replies: number;
  likes: number;
  impressions: number;
}): { ok: boolean; impressions_only: boolean } {
  const primary =
    m.followersGained > 0 ||
    m.profileVisits > 0 ||
    m.bookmarks >= 3 ||
    m.replies >= 2;
  const impressions_only =
    !primary && m.impressions > 0 && m.followersGained === 0;
  return { ok: primary, impressions_only };
}

export function featureKeyFromParts(parts: {
  topic?: string;
  media?: boolean;
  experience?: string;
  length?: string;
}): string {
  return [
    parts.topic || "topic?",
    parts.media ? "media" : "nomedia",
    parts.experience || "exp?",
    parts.length || "len?",
  ].join("|");
}

export function updatePatternsFromBatch(
  existing: PerformancePattern[],
  batch: BatchPerformanceSummary
): PerformancePattern[] {
  const map = new Map(existing.map((p) => [p.pattern_id, { ...p }]));

  for (const hit of batch.feature_hits) {
    const { ok, impressions_only } = isPrioritySuccess(hit);
    if (impressions_only || !ok) continue;
    const id = `perf-${hit.feature_key}`;
    const prev = map.get(id);
    if (!prev) {
      map.set(id, {
        pattern_id: id,
        feature_key: hit.feature_key,
        feature_summary: hit.feature_summary,
        status: "CANDIDATE",
        confidence: "LOW",
        support_batches: [batch.batch_id],
        weaken_batches: [],
        first_seen_batch: batch.batch_id,
        last_seen_batch: batch.batch_id,
        priority_metric_hits: {
          followersGained: hit.followersGained,
          profileVisits: hit.profileVisits,
          bookmarks: hit.bookmarks,
          replies: hit.replies,
        },
        impressions_only: false,
        sample_count: hit.sample_count,
        provenance: "published_only",
        notes: "New candidate — not validated",
      });
      continue;
    }
    prev.support_batches = Array.from(
      new Set([...prev.support_batches, batch.batch_id])
    );
    prev.last_seen_batch = batch.batch_id;
    prev.sample_count += hit.sample_count;
    prev.priority_metric_hits.followersGained += hit.followersGained;
    prev.priority_metric_hits.profileVisits += hit.profileVisits;
    prev.priority_metric_hits.bookmarks += hit.bookmarks;
    prev.priority_metric_hits.replies += hit.replies;

    const supports = prev.support_batches.length;
    if (prev.status === "CANDIDATE" && supports >= 2) {
      prev.status = "SUPPORTED_CANDIDATE";
      prev.confidence = "MEDIUM";
      prev.notes = "Supported across ≥2 batches — still not validated";
    } else if (
      prev.status === "SUPPORTED_CANDIDATE" &&
      supports >= 3 &&
      prev.priority_metric_hits.followersGained +
        prev.priority_metric_hits.profileVisits >
        0
    ) {
      prev.status = "VALIDATED";
      prev.confidence = "MEDIUM";
      prev.notes = "Validated after ≥3 supporting batches (revalidatable)";
    } else if (prev.status === "WEAKENED" && supports >= 2) {
      prev.status = "SUPPORTED_CANDIDATE";
      prev.confidence = "LOW";
      prev.notes = "Recovering support after weaken";
    }
  }

  for (const p of map.values()) {
    if (
      (p.status === "VALIDATED" || p.status === "SUPPORTED_CANDIDATE") &&
      !p.support_batches.includes(batch.batch_id) &&
      p.last_seen_batch !== batch.batch_id
    ) {
      if (batch.published_count >= 5) {
        p.weaken_batches = Array.from(
          new Set([...p.weaken_batches, batch.batch_id])
        );
        if (p.weaken_batches.length >= 2 && p.status === "VALIDATED") {
          p.status = "WEAKENED";
          p.confidence = "LOW";
          p.notes =
            "Weakened after consecutive batches without priority support";
        }
      }
    }
  }

  return Array.from(map.values());
}

export function formatPerformanceIntelligenceForPlanner(
  patterns: PerformancePattern[]
): string {
  const validated = patterns.filter((p) => p.status === "VALIDATED");
  const supported = patterns.filter((p) => p.status === "SUPPORTED_CANDIDATE");
  const candidates = patterns.filter((p) => p.status === "CANDIDATE");
  const lines = [
    "PERFORMANCE DNA (published evidence only)",
    `Validated: ${validated.length} · Supported candidates: ${supported.length} · Candidates: ${candidates.length}`,
    "VALIDATED (stronger advisory — not content formulas):",
    ...(validated.length
      ? validated.slice(0, 5).map(
          (p) =>
            `- [${p.confidence}] ${p.feature_summary} (batches: ${p.support_batches.length})`
        )
      : ["- (none yet)"]),
    "SUPPORTED / CANDIDATE (weaker than validated — do not dominate plan):",
    ...[...supported, ...candidates].slice(0, 6).map(
      (p) => `- [${p.status}/${p.confidence}] ${p.feature_summary}`
    ),
    "Never force every post into a winning formula. Respect Creator DNA + Intent + diversity.",
    "Impressions-only patterns are excluded from success promotion.",
  ];
  return lines.join("\n");
}

export function seedBaselineCandidates(
  batch_id = "baseline-v1"
): PerformancePattern[] {
  const seeds = [
    "practical_investigation|media|exp|medium",
    "community_howto_point|media|exp|short",
    "fsd_experience_essay|nomedia|exp|long",
    "milestone_gratitude|media|exp|medium",
    "honest_incident|nomedia|exp|medium",
  ];
  return seeds.map((feature_key) => ({
    pattern_id: `perf-${feature_key}`,
    feature_key,
    feature_summary: feature_key.replace(/\|/g, " + "),
    status: "CANDIDATE" as const,
    confidence: "LOW" as const,
    support_batches: [batch_id],
    weaken_batches: [],
    first_seen_batch: batch_id,
    last_seen_batch: batch_id,
    priority_metric_hits: {
      followersGained: 0,
      profileVisits: 0,
      bookmarks: 0,
      replies: 0,
    },
    impressions_only: false,
    sample_count: 1,
    provenance: "published_only" as const,
    notes: "Seeded from INITIAL BASELINE v1 — remains CANDIDATE",
  }));
}
