/** Creator-specific originality evaluation (lightweight decision support).
 * Authenticity Hard Gate always outranks originality.
 */

export type OriginalityLevel = "LOW" | "MEDIUM" | "HIGH";

export type OriginalityDimension =
  | "creator_specificity"
  | "personal_evidence"
  | "opinion_specificity"
  | "context_added"
  | "interpretation_value"
  | "expertise_value"
  | "creative_value"
  | "external_dependency"
  | "genericness"
  | "summary_only_risk";

export type EvidenceRef = {
  kind: "episode" | "current_opinion" | "self_report" | "historical_fact" | "media" | "none";
  id?: string;
  note?: string;
};

export type OriginalityInput = {
  draftText: string;
  actionType: "ORIGINAL" | "QUOTE" | "REPOST" | "SKIP";
  evidence: EvidenceRef[];
  hasVerifiedEpisode?: boolean;
  hasCurrentOpinion?: boolean;
  hasCreatorObservation?: boolean;
  isNewsSummaryOnly?: boolean;
  isParaphraseOfExternal?: boolean;
  topicClusterOverlap?: "NONE" | "RELATED" | "STRONG";
};

export type OriginalityResult = {
  originality_level: OriginalityLevel;
  originality_reasons: string[];
  originality_risks: string[];
  dimensions: Partial<Record<OriginalityDimension, number>>;
  recommended_action?: "ORIGINAL" | "QUOTE" | "REPOST" | "SKIP";
  authenticity_override: boolean;
};
