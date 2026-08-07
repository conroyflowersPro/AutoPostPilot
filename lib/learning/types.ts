/** Growth Intelligence Engine v4 — normalized models */

export type MetricOrigin = "ai" | "manual" | "unknown";

export type ContentFeatures = {
  lengthBucket: "short" | "medium" | "long";
  charCount: number;
  hasQuestion: boolean;
  hasMediaLink: boolean;
  isReply: boolean;
  isEnglish: boolean;
  isKorean: boolean;
  hasNumbers: boolean;
  hasEmoji: boolean;
  hasCta: boolean;
  topicGuess: string;
};

export type NormalizedPostMetrics = {
  postId: string | null;
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
  shares: number;
  detailExpands: number;
  urlClicks: number;
  hashtagClicks: number;
  permalinkClicks: number;
  engagements: number;
  revenue: number;
  engagementRate: number | null;
  origin: MetricOrigin;
  features?: ContentFeatures;
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

export type PerformanceDnaPayload = {
  whyPatterns: string[];
  topStructures: string[];
  lengthWins: string[];
  topicWins: string[];
  summaryKo: string;
};

export type RevenueDnaPayload = {
  revenueByTopic: string[];
  notes: string[];
  summaryKo: string;
};

/**
 * Success signal priority (v4):
 * Followers > Profile > Revenue > Bookmarks > Replies > Reposts > Quotes > Likes > Impressions
 */
export const METRIC_WEIGHTS = {
  followersGained: 40,
  profileVisits: 18,
  revenue: 15,
  bookmarks: 10,
  replies: 7,
  reposts: 5,
  quotes: 2,
  likes: 2,
  impressions: 1,
  detailExpands: 3,
  shares: 2,
} as const;
