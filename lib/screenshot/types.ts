/**
 * Screenshot Signal → Concrete Topic Candidate types
 * Fedica keyword ≠ writing prompt; ≠ post quota beyond 1/day.
 */
export type RelativeWeight = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
export type ContextSufficiency = "READY" | "NEEDS_CONTEXT" | "LOW_CONFIDENCE" | "REJECTED";
export type PlanningSource = "SCREENSHOT_DERIVED" | "STRATEGIC";

export type RankedKeyword = {
  keyword: string;
  visualRank: number;
  relativeWeight: RelativeWeight;
  rawText?: string;
  confidence?: number;
};

export type SemanticCluster = {
  id: string;
  label: string;
  keywords: string[];
  topWeight: RelativeWeight;
};

export type ConcreteTopicCandidate = {
  id: string;
  source: "FEDICA_SCREENSHOT";
  source_keywords: string[];
  semantic_cluster: string;
  audience_signal_strength: RelativeWeight;
  concrete_subject: string;
  context: string;
  why_now: string;
  creator_relevance: string;
  proposed_angle: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  context_sufficiency: ContextSufficiency;
  relative_rank?: number;
};

export type PostBrief = {
  source: PlanningSource;
  source_keywords?: string[];
  source_cluster?: string;
  audience_signal_rank?: number;
  concrete_subject: string;
  why_this_topic: string;
  context: string;
  creator_angle: string;
  audience_connection: string;
  core_point: string;
  known_facts: string[];
  do_not_invent: string[];
  writing_mode: string;
  media_suggestion?: string;
  selection_reason?: string;
};

export type PlannedSlot = {
  slotId: string;
  primaryTopic: string;
  angle: string;
  contentType: string;
  targetLength: "short" | "medium" | "long";
  actionType: "ORIGINAL";
  planning_source: PlanningSource;
  audienceLinked: boolean;
  postBrief?: PostBrief;
  lafc?: {
    competition: string;
    venue: string;
    attendance: "직관" | "비직관";
    matchPhase: string;
  } | null;
};
