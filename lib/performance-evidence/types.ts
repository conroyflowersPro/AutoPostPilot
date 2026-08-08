/**
 * Source-independent Performance Evidence model.
 * Analyzers depend only on these types — never on Supabase rows or Archive JSON shapes.
 * Missing metric ≠ 0. PRESENT_ZERO and MISSING are distinct.
 */

export type EvidenceSource =
  | "X_API"
  | "X_ARCHIVE"
  | "X_ANALYTICS"
  | "FEDICA"
  | "X_MONETIZATION"
  | "UNKNOWN";

export type MetricPresence = "PRESENT_NON_ZERO" | "PRESENT_ZERO" | "MISSING";

export type MetricFamily = "public" | "organic" | "non_public";

/** Single numeric metric observation with explicit presence state */
export type MetricValue = {
  presence: MetricPresence;
  value: number | null; // null only when MISSING
};

export type MetricBag = Record<string, MetricValue>;

/**
 * Normalized evidence record produced by any EvidenceSourceAdapter.
 * Source-specific fields must not leak into analyzers.
 */
export type NormalizedEvidence = {
  source: EvidenceSource;
  sourceRecordId: string;
  postId: string;
  publishedAt: string | null; // ISO
  activityType: string; // e.g. POST, MENTION, …
  postType: string; // ORIGINAL | QUOTE | REPLY | REPOST | MENTION | UNKNOWN
  isOriginal: boolean;
  isQuote: boolean;
  isReply: boolean;
  isRepost: boolean;
  textPresence: boolean;
  mediaPresence: boolean;
  publicMetrics: MetricBag;
  organicMetrics: MetricBag;
  nonPublicMetrics: MetricBag;
  snapshotTimestamp: string | null;
  snapshotCount: number; // how many snapshots known for this post (adapter may fill 1+)
  metricAvailability: {
    public: boolean;
    organic: boolean;
    nonPublic: boolean;
  };
  /** Optional contract-v1 extensions — backward compatible */
  evidenceTier?: "HISTORICAL_CUMULATIVE" | "LONGITUDINAL_AGE_BUCKET" | "UNKNOWN";
  ageBucket?: "EARLY" | "DAY" | "MULTI_DAY" | "MATURE" | "UNKNOWN";
  generationSource?: "MANUAL" | "SYSTEM_ASSISTED" | "UNKNOWN";
};

export type Population =
  | "ALL"
  | "CREATOR_PUBLISHING" // ORIGINAL + QUOTE
  | "ORIGINAL"
  | "QUOTE"
  | "REPLY"
  | "REPOST"
  | "MENTION"
  | "SOCIAL_INTERACTION"; // REPLY (alias)

export type MetricCoverage = {
  metricKey: string;
  family: MetricFamily;
  population: Population;
  eligible: number;
  present: number; // PRESENT_ZERO + PRESENT_NON_ZERO
  missing: number;
  zero: number; // PRESENT_ZERO only
  nonZero: number; // PRESENT_NON_ZERO only
  coveragePct: number | null; // present / eligible * 100; null if eligible=0
};

export type FamilyCoverage = {
  family: MetricFamily;
  population: Population;
  eligible: number;
  usable: number; // at least one metric present in family
  coveragePct: number | null;
  earliestUsable: string | null;
  latestUsable: string | null;
  status: "AVAILABLE" | "PARTIAL" | "NOT_AVAILABLE" | "NOT_COLLECTED";
};

export type DistributionStats = {
  metricKey: string;
  population: Population;
  count: number; // non-missing only
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  max: number | null;
  mean: number | null;
  std: number | null;
  skewness: number | null;
};

export type CorrelationPair = {
  metricA: string;
  metricB: string;
  population: Population;
  sampleSize: number;
  pearson: number | null;
  spearman: number | null;
};

export type MonthlyBucket = {
  yearMonth: string; // YYYY-MM
  total: number;
  original: number;
  quote: number;
  reply: number;
  repost: number;
  other: number;
  withPublicMetrics: number;
  withOrganicMetrics: number;
  withNonPublicMetrics: number;
};

export type SnapshotStats = {
  totalSnapshots: number;
  postsWithAtLeastOne: number;
  postsWithMultiple: number;
  avgSnapshotsPerPost: number | null;
  medianSnapshotsPerPost: number | null;
  maxSnapshotsPerPost: number;
  byPostType: Record<string, number>;
};

export type ActivityCounts = {
  total: number;
  byPostType: Record<string, number>;
  byActivityType: Record<string, number>;
  creatorPublishing: number; // ORIGINAL + QUOTE
  socialInteraction: number; // REPLY
  redistribution: number; // REPOST
  unknown: number;
};

export type DataQualityIssue = {
  code: string;
  severity: "info" | "warn" | "critical";
  message: string;
  count?: number;
};

export type PerformanceVerdict =
  | "A_SUFFICIENT_HISTORICAL_PUBLIC"
  | "B_PARTIAL_HISTORICAL"
  | "C_INSUFFICIENT_HISTORICAL"
  | "D_DEEP_METRICS_LIMITED";

export type DiagnosticReport = {
  generatedAt: string;
  accountId: string | null;
  sourceUsed: EvidenceSource[];
  inventory: {
    totalNormalizedRecords: number;
    earliestPublishedAt: string | null;
    latestPublishedAt: string | null;
  };
  activityCounts: ActivityCounts;
  publicMetricCoverage: MetricCoverage[];
  creatorPublishingCoverage: MetricCoverage[];
  familyCoverage: FamilyCoverage[];
  snapshotStats: SnapshotStats | null;
  distributions: DistributionStats[];
  correlations: CorrelationPair[];
  monthly: MonthlyBucket[];
  dataQuality: DataQualityIssue[];
  verdicts: PerformanceVerdict[];
  verdictRationale: string[];
  recommendedNextSteps: string[];
  architectureNote: string;
};

/** Adapter contract — analyzers never call Supabase/ZIP directly */
export interface EvidenceSourceAdapter {
  readonly source: EvidenceSource;
  /**
   * Stream or chunk normalized evidence.
   * Implementations must not load entire large sources into RAM when avoidable.
   */
  iterateEvidence(
    options?: { accountId?: string; pageSize?: number }
  ): AsyncGenerator<NormalizedEvidence[], void, unknown>;
  /** Optional: total estimate without full scan */
  estimateCount?(options?: { accountId?: string }): Promise<number | null>;
}
