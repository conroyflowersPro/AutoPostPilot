/**
 * Initial Baseline Learning types (Phase 1)
 * Conservative: expose uncertainty, never invent missing metrics.
 */

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Availability = "AVAILABLE" | "PARTIAL" | "MISSING" | "STALE";

export type DataSourceKind =
  | "x_api"
  | "post_metrics"
  | "x_analytics_csv"
  | "fedica"
  | "monetization"
  | "seung_content"
  | "account_activities"
  | "bootstrap_historical_search"
  | "creator_self_report";

export type CoverageSlice = {
  domain: string;
  availability: Availability;
  earliest: string | null;
  latest: string | null;
  count: number | null;
  source: DataSourceKind | string;
  fieldsAvailable: string[];
  fieldsMissing: string[];
  notes: string;
  confidence: Confidence;
};

export type ActivityBucket = {
  periodStart: string;
  periodEnd: string;
  postCount: number;
  replyCount: number | null;
  label: "active" | "low_activity" | "missing_data" | "unknown";
  note: string;
};

export type BaselineTrait = {
  trait: string;
  class: "stable" | "evolving" | "provisional" | "hypothesis";
  evidence: string;
  confidence: Confidence;
};

export type CandidatePattern = {
  pattern: string;
  sampleSize: number | null;
  recency: string;
  qualityEngagementSignals: string[];
  status: "candidate" | "low_confidence" | "validated";
  confidence: Confidence;
  note: string;
};

export type InitialBaselineReport = {
  version: "Initial Baseline v1";
  generatedAt: string;
  accountHandle: string;
  scope: {
    earliestReliableData: string | null;
    latestAvailableData: string | null;
    note: string;
  };
  coverage: CoverageSlice[];
  activityPattern: ActivityBucket[];
  creatorDna: {
    stable: BaselineTrait[];
    evolving: BaselineTrait[];
    provisional: BaselineTrait[];
    summaryKo: string;
    confidence: Confidence;
  };
  topicMap: {
    topics: { topic: string; weightNote: string; confidence: Confidence }[];
    temporalNote: string;
  };
  performanceDna: {
    patterns: CandidatePattern[];
    historicalVsCurrentNote: string;
    summaryKo: string;
    confidence: Confidence;
  };
  qualityEngagement: {
    availableSignals: string[];
    notAvailableSignals: string[];
    observations: string[];
    confidence: Confidence;
  };
  manualPosts: {
    distinguishable: boolean;
    findings: string[];
    confidence: Confidence;
  };
  audienceDna: {
    availability: Availability;
    summaryKo: string;
    bestPostingTimeStatus: string;
    confidence: Confidence;
  };
  relationshipFindings: {
    availability: Availability;
    findings: string[];
    confidence: Confidence;
  };
  revenueDna: {
    availability: Availability;
    summaryKo: string;
    confidence: Confidence;
  };
  candidateSuccessPatterns: CandidatePattern[];
  validatedPatterns: CandidatePattern[];
  dataLimitations: string[];
  humanReviewQuestions: { q: string; systemAnswer: string }[];
  phaseStatus: "STOP_FOR_HUMAN_REVIEW";
  nextPhaseBlocked: true;
};
