/**
 * performance-dna-contract-v1
 * Structure only. No learning execution. No universal scalar score.
 */
export const PERFORMANCE_DNA_CONTRACT_VERSION = "performance-dna-contract-v1";
export const CONTENT_EVIDENCE_VERSION = "content-evidence-v1";
export const PERFORMANCE_OUTCOME_VERSION = "performance-outcome-v1";

/** Four DNA boundaries — no fifth DNA */
export const DNA_MODELS = [
  "CREATOR_DNA",
  "AUDIENCE_DNA",
  "PERFORMANCE_DNA",
  "REVENUE_DNA",
] as const;
export type DnaModel = (typeof DNA_MODELS)[number];

export type EvidenceSourceId =
  | "X_API"
  | "X_ARCHIVE"
  | "X_ANALYTICS"
  | "FEDICA"
  | "X_MONETIZATION"
  | "UNKNOWN";

/** Performance analysis populations — never merge REPLY into publishing success */
export type PerformancePopulation =
  | "ORIGINAL"
  | "QUOTE"
  | "CREATOR_PUBLISHING"
  | "REPLY"
  | "REPOST"
  | "MENTION";

export const PUBLISHING_POPULATIONS: PerformancePopulation[] = [
  "ORIGINAL",
  "QUOTE",
  "CREATOR_PUBLISHING",
];

/** Historical vs future longitudinal evidence tiers */
export type TemporalEvidenceTier =
  | "HISTORICAL_CUMULATIVE"
  | "LONGITUDINAL_AGE_BUCKET"
  | "UNKNOWN";

export type AgeBucket = "EARLY" | "DAY" | "MULTI_DAY" | "MATURE" | "UNKNOWN";

/** Age bucket semantics (not fixed wall-clock cron) */
export const AGE_BUCKET_HOURS: Record<
  Exclude<AgeBucket, "UNKNOWN">,
  { minH: number; maxH: number | null }
> = {
  EARLY: { minH: 0, maxH: 12 },
  DAY: { minH: 12, maxH: 36 },
  MULTI_DAY: { minH: 36, maxH: 96 },
  MATURE: { minH: 96, maxH: null },
};

export type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type CandidateState =
  | "OBSERVATION"
  | "CANDIDATE"
  | "STRONG_CANDIDATE"
  | "VALIDATED";

/** Global metric preference (long-term importance) — not a content score */
export const GLOBAL_METRIC_PRIORITY = [
  "followers_gained",
  "profile_visits",
  "revenue",
  "bookmarks",
  "replies",
  "reposts",
  "quotes",
  "likes",
  "impressions",
] as const;

/** Canonical outcome axes — multi-dimensional, never single scalar truth */
export type OutcomeAxis =
  | "REACH"
  | "UTILITY"
  | "DISCUSSION"
  | "PROFILE_CURIOSITY"
  | "FOLLOWER_CONVERSION"
  | "REVENUE";

export const OUTCOME_AXES_V1: OutcomeAxis[] = [
  "REACH",
  "UTILITY",
  "DISCUSSION",
  "PROFILE_CURIOSITY",
];

/** Axes that must not be fabricated when data absent */
export const OPTIONAL_OUTCOME_AXES: OutcomeAxis[] = [
  "FOLLOWER_CONVERSION",
  "REVENUE",
  "PROFILE_CURIOSITY",
];

export type ProvenanceKind =
  | "FIRSTHAND"
  | "SECONDHAND"
  | "INTERPRETATION_ONLY"
  | "UNKNOWN";

export type ProvenanceSubtype =
  | "USED"
  | "OBSERVED"
  | "INVESTIGATED"
  | "INCIDENT"
  | "MILESTONE"
  | null;

/** Universal scalar performance score is forbidden as canonical truth */
export const UNIVERSAL_SCALAR_SCORE_FORBIDDEN = true as const;

export type ArchitectureContractSummary = {
  version: typeof PERFORMANCE_DNA_CONTRACT_VERSION;
  contentEvidenceVersion: typeof CONTENT_EVIDENCE_VERSION;
  outcomeVersion: typeof PERFORMANCE_OUTCOME_VERSION;
  dnaModels: readonly DnaModel[];
  universalScalarScoreForbidden: true;
  publishingPopulations: PerformancePopulation[];
  outcomeAxesV1: OutcomeAxis[];
  ageBuckets: AgeBucket[];
  archiveAdapterSlot: "XArchiveAdapter → NormalizedEvidence → analyzers";
};
