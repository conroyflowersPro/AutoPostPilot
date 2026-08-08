/**
 * Weekly Planner + Post Strategy types (v5.4.2)
 * Strategy is a HYPOTHESIS until validated by published X outcomes.
 */

export type GrowthObjective =
  | "followers"
  | "profile_visits"
  | "bookmarks"
  | "replies"
  | "authority"
  | "expansion"
  | "balanced";

export type WritingApproach =
  | "observation"
  | "opinion"
  | "personal_experience"
  | "comparison"
  | "info_interpretation"
  | "technical"
  | "prediction"
  | "question"
  | "mixed";

export type Intensity = "none" | "low" | "medium" | "high";

/** Evidence quality behind any X distribution / algorithm assumption */
export type StrategyEvidenceClass =
  | "verified"
  | "observed"
  | "hypothesis"
  | "account_validated";

/** Progressive learning confidence for strategy patterns */
export type StrategyConfidence = "observed" | "emerging" | "validated";

/** Per-slot strategic hypothesis — not a writing formula */
export type PostStrategy = {
  strategicAngle: string;
  hookStyle: string;
  writingApproach: WritingApproach;
  experienceUsage: Intensity;
  opinionStrength: Intensity;
  observationLevel: Intensity;
  technicalDepth: Intensity;
  emotionalLevel: Intensity;
  predictionLevel: Intensity;
  questionUsage: boolean;
  ctaUsage: boolean;
  targetGrowthObjective: GrowthObjective;
  mediaUsefulness: "optional" | "helpful" | "essential";
  /** Why this strategy might work — hypothesis only */
  hypothesisNote: string;
  /** Optional evidence class for any algorithm/distribution claim used */
  evidenceClass?: StrategyEvidenceClass;
};

export type ContentSlot = {
  slotId: string;
  primaryTopic: string;
  subtopic?: string;
  angle: string;
  contentType: string;
  allowedContext: string[];
  forbiddenTopics: string[];
  targetLength: "short" | "medium" | "long";
  /** Always ORIGINAL for Weekly Planner */
  actionType: "ORIGINAL";
  postStrategy?: PostStrategy;
  expansionValue?: "low" | "medium" | "high";
  creatorIntentAligned?: boolean;
};

/**
 * Product-facing weekly portfolio (not Creator identity).
 * Prefer weeklyStrategy over legacy identityStatement in UI.
 */
export type PortfolioRead = {
  /** @deprecated prefer weeklyStrategy — avoid framing as Creator identity */
  identityStatement?: string;
  /** Product label: This Week's Strategy / Weekly Portfolio */
  weeklyStrategy: string;
  expansionMoves: string[];
  diversityNotes: string;
  riskOfNarrowing: string;
  creatorIntentReflection: string;
  portfolioAdjustment?: string;
};

export type AudienceRead = {
  interestGraph?: string[];
  sentiment?: string;
  coverageNote?: string;
  performanceLean?: string;
  topicDistribution?: Record<string, number>;
  candidateHighlights?: string[];
  portfolio?: PortfolioRead;
  creatorIntent?: string;
  intentStrength?: string;
  diversityGuardApplied?: boolean;
};

export function defaultPostStrategy(partial?: Partial<PostStrategy>): PostStrategy {
  return {
    strategicAngle: partial?.strategicAngle || "observation-first",
    hookStyle: partial?.hookStyle || "direct_observation",
    writingApproach: partial?.writingApproach || "observation",
    experienceUsage: partial?.experienceUsage || "none",
    opinionStrength: partial?.opinionStrength || "low",
    observationLevel: partial?.observationLevel || "medium",
    technicalDepth: partial?.technicalDepth || "low",
    emotionalLevel: partial?.emotionalLevel || "low",
    predictionLevel: partial?.predictionLevel || "none",
    questionUsage: partial?.questionUsage ?? false,
    ctaUsage: partial?.ctaUsage ?? false,
    targetGrowthObjective: partial?.targetGrowthObjective || "balanced",
    mediaUsefulness: partial?.mediaUsefulness || "optional",
    hypothesisNote:
      partial?.hypothesisNote ||
      "Hypothesis only — validate after publish with real X metrics.",
    evidenceClass: partial?.evidenceClass || "hypothesis",
  };
}

export function normalizeIntensity(v: unknown, fallback: Intensity = "low"): Intensity {
  const s = String(v || "").toLowerCase();
  if (["none", "low", "medium", "high"].includes(s)) return s as Intensity;
  return fallback;
}

export function normalizeGrowthObjective(v: unknown): GrowthObjective {
  const s = String(v || "").toLowerCase();
  const allowed: GrowthObjective[] = [
    "followers",
    "profile_visits",
    "bookmarks",
    "replies",
    "authority",
    "expansion",
    "balanced",
  ];
  return (allowed.includes(s as GrowthObjective) ? s : "balanced") as GrowthObjective;
}

export function normalizeWritingApproach(v: unknown): WritingApproach {
  const s = String(v || "").toLowerCase();
  const allowed: WritingApproach[] = [
    "observation",
    "opinion",
    "personal_experience",
    "comparison",
    "info_interpretation",
    "technical",
    "prediction",
    "question",
    "mixed",
  ];
  return (allowed.includes(s as WritingApproach) ? s : "observation") as WritingApproach;
}
