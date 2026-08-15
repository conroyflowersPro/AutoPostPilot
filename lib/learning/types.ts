/** Growth Intelligence Engine v4 + strategy features v5.4 */

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
  actionType?: "ORIGINAL" | "QUOTE" | "REPOST" | "REPLY" | "UNKNOWN";
  subtopic?: string;
  strategicAngle?: string;
  hookStyle?: string;
  writingApproach?: string;
  experienceUsage?: string;
  opinionStrength?: string;
  observationLevel?: string;
  technicalDepth?: string;
  emotionalLevel?: string;
  predictionLevel?: string;
  questionUsage?: boolean;
  ctaUsage?: boolean;
  mediaType?: string;
  mediaPresence?: boolean;
  discourseShape?: string;
  personalStoryLevel?: string;
  targetGrowthObjective?: string;
  strategySource?: "hypothesis" | "observed" | "unknown";
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
  strategyWins: string[];
  actionTypeWins: string[];
  summaryKo: string;
};

export type RevenueDnaPayload = {
  revenueByTopic: string[];
  notes: string[];
  summaryKo: string;
};

export const METRIC_WEIGHTS = {
  /** Performance DNA interpret order: Followers Gained → Profile Visits → Revenue → Bookmarks → Replies → Reposts → Quotes → Likes → Impressions */
  followersGained: 50,
  profileVisits: 40,
  revenue: 30,
  bookmarks: 24,
  replies: 20,
  reposts: 12,
  quotes: 12,
  detailExpands: 8,
  shares: 2,
  likes: 2,
  impressions: 1,
} as const;
