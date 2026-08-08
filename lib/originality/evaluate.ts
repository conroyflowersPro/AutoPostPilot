import {
  OriginalityInput,
  OriginalityResult,
  OriginalityLevel,
} from "./types";

/**
 * Evaluate Creator-specific originality WITHOUT inventing facts.
 * Hierarchy: Truth → Authenticity Hard Gate → Knowledge Boundary → Originality → Growth → Revenue
 */
export function evaluateCreatorOriginality(input: OriginalityInput): OriginalityResult {
  const reasons: string[] = [];
  const risks: string[] = [];
  const dimensions: OriginalityResult["dimensions"] = {};

  const text = (input.draftText || "").trim();
  const evidence = input.evidence || [];
  const hasEvidence = evidence.some((e) => e.kind !== "none");

  const personalClaimHints =
    /내가|저는|직접|어제|오늘 운전|경험했|테스트했|느꼈|내 차|내 FSD|우리 집/i.test(text);
  const authenticity_override =
    personalClaimHints && !input.hasVerifiedEpisode && !hasEvidence;

  if (authenticity_override) {
    risks.push("Personal claim language without verified evidence — authenticity hard gate blocks invention");
  }

  let genericness = 3;
  if (input.isNewsSummaryOnly) {
    genericness = 8;
    reasons.push("Reads primarily as news summary");
  }
  if (input.isParaphraseOfExternal) {
    genericness = Math.max(genericness, 7);
    reasons.push("Likely paraphrase of external post");
  }
  if (/흥미롭|interesting|how do you feel|어떻게 생각/i.test(text) && text.length < 120) {
    genericness = Math.max(genericness, 7);
    reasons.push("Thin engagement-style commentary");
  }
  dimensions.genericness = genericness;
  dimensions.summary_only_risk = input.isNewsSummaryOnly ? 8 : genericness > 6 ? 6 : 2;

  let creator_specificity = 4;
  if (input.hasVerifiedEpisode) {
    creator_specificity += 3;
    reasons.push("Verified historical episode available");
  }
  if (input.hasCurrentOpinion) {
    creator_specificity += 2;
    reasons.push("Grounded in current Creator opinion");
  }
  if (input.hasCreatorObservation) {
    creator_specificity += 2;
    reasons.push("Creator-specific observation signal");
  }
  if (authenticity_override) {
    creator_specificity = Math.min(creator_specificity, 3);
  }
  dimensions.creator_specificity = Math.min(10, creator_specificity);

  dimensions.personal_evidence = input.hasVerifiedEpisode || hasEvidence ? 7 : authenticity_override ? 1 : 3;
  dimensions.opinion_specificity = input.hasCurrentOpinion ? 7 : 3;
  dimensions.context_added = input.hasCreatorObservation || input.hasVerifiedEpisode ? 6 : 3;
  dimensions.interpretation_value = input.hasCurrentOpinion || input.hasVerifiedEpisode ? 6 : 3;
  dimensions.expertise_value = 4;
  dimensions.creative_value = 3;
  dimensions.external_dependency = input.isParaphraseOfExternal || input.isNewsSummaryOnly ? 7 : 3;

  const positive =
    (dimensions.creator_specificity || 0) +
    (dimensions.personal_evidence || 0) +
    (dimensions.opinion_specificity || 0) +
    (dimensions.context_added || 0) +
    (dimensions.interpretation_value || 0);
  const negative =
    (dimensions.genericness || 0) +
    (dimensions.summary_only_risk || 0) +
    (dimensions.external_dependency || 0);

  const net = positive - negative * 0.6;

  let originality_level: OriginalityLevel = "MEDIUM";
  if (authenticity_override || net < 8) originality_level = "LOW";
  else if (net >= 18) originality_level = "HIGH";
  else originality_level = "MEDIUM";

  if (originality_level === "LOW" && !reasons.includes("Weak Creator-specific contribution")) {
    reasons.push("Weak Creator-specific contribution");
  }
  if (originality_level === "HIGH") {
    reasons.push("Strong Creator-specific signals with evidence");
  }

  let recommended_action = input.actionType;
  if (input.actionType === "ORIGINAL" && originality_level === "LOW" && input.isParaphraseOfExternal) {
    recommended_action = "REPOST";
    reasons.push("Prefer REPOST when little meaningful Creator add-on");
  } else if (input.actionType === "QUOTE" && originality_level === "HIGH" && input.hasCurrentOpinion) {
    recommended_action = "QUOTE";
    reasons.push("QUOTE supported by verified commentary potential");
  }

  if (input.topicClusterOverlap === "STRONG") {
    risks.push("Strong topic overlap with recent actual/planned content");
  }

  return {
    originality_level,
    originality_reasons: reasons,
    originality_risks: risks,
    dimensions,
    recommended_action,
    authenticity_override,
  };
}

export const ORIGINALITY_SYSTEM_FRAGMENT = `
CREATOR-SPECIFIC ORIGINALITY (subordinate to authenticity):
- ORIGINAL means meaningful Creator contribution, NOT merely new AI wording.
- Prefer verified episode, current opinion, real observation, expertise, or interpretation.
- NEVER invent experiences, tests, emotions, ownership, locations, or beliefs to raise originality.
- If the Creator has nothing meaningful to add, prefer Quote/Repost/Skip over forced Original.
- Hierarchy: Factual truth → Authenticity Hard Gate → Knowledge Boundary → Creator-specific Originality → Growth → Revenue.
`.trim();
