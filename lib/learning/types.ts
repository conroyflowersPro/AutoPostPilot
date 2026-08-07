/** Weekly Learning Engine v3 — normalized models */

export type MetricOrigin = "ai" | "manual" | "unknown";

export type NormalizedPostMetrics = {
  contentSnippet: string;
  publishedAt: string | null;
  followersGained: number;
  profileVisits: number;
  bookmarks: number;
  replies: number;
  reposts: number;
  likes: number;
  impressions: number;
  quotes: number;
  engagementRate: number | null;
  origin: MetricOrigin;
  raw?: Record<string, unknown>;
};

export type ScoredPostMetrics = NormalizedPostMetrics & {
  weightedScore: number;
  isSuccess: boolean;
};

export type PlannerMemoryPayload = {
  patterns: string[];
  summaryKo: string;
  successCount: number;
  analyzedCount: number;
};

export type CreatorDnaPayload = {
  writingRhythm: string;
  tone: string;
  hookStyle: string;
  observationStyle: string;
  analysisStyle: string;
  humorStyle: string;
  topicPreference: string[];
  successfulStructures: string[];
  summaryKo: string;
};

export type AudienceDnaPayload = {
  interestGraph: string[];
  sentiment: string;
  topicMovement: string[];
  followerInterests: string[];
  summaryKo: string;
};

/** Success signal weights — impressions never dominate */
export const METRIC_WEIGHTS = {
  followersGained: 40,
  profileVisits: 20,
  bookmarks: 15,
  replies: 10,
  reposts: 7,
  likes: 5,
  impressions: 2,
  quotes: 1,
} as const;
