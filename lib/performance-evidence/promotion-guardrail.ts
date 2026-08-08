/**
 * Candidate → Validated promotion guardrails (contract, not learning run)
 */
import type {
  CandidateState,
  ConfidenceTier,
  EvidenceSourceId,
  OutcomeAxis,
  PerformancePopulation,
  TemporalEvidenceTier,
} from "./contract-v1";
import { PUBLISHING_POPULATIONS } from "./contract-v1";
import { isPresentationOnly, type ContentEvidence } from "./content-evidence";

export type PatternPromotionInput = {
  population: PerformancePopulation;
  contentEvidence?: ContentEvidence | null;
  outcomeAxes: OutcomeAxis[];
  sampleSize: number;
  temporalSpreadDays: number | null;
  evidenceSources: EvidenceSourceId[];
  temporalTiers: TemporalEvidenceTier[];
  evidenceConfidence: ConfidenceTier;
  knownConfounders: string[];
  surfaceOnly?: boolean;
};

export type PromotionDecision = {
  allowed: boolean;
  maxState: CandidateState;
  reasons: string[];
};

export function evaluatePromotion(
  input: PatternPromotionInput
): PromotionDecision {
  const reasons: string[] = [];

  if (!PUBLISHING_POPULATIONS.includes(input.population)) {
    reasons.push(
      `Population ${input.population} cannot validate Creator Publishing patterns (REPLY/REPOST/MENTION excluded)`
    );
    return { allowed: false, maxState: "OBSERVATION", reasons };
  }

  const surfaceOnly =
    input.surfaceOnly === true ||
    (input.contentEvidence
      ? isPresentationOnly(input.contentEvidence)
      : false);

  if (surfaceOnly) {
    reasons.push(
      "Presentation-only (surface) correlation cannot become VALIDATED"
    );
    return { allowed: false, maxState: "OBSERVATION", reasons };
  }

  if (!input.outcomeAxes.length) {
    reasons.push("Outcome axis required");
    return { allowed: false, maxState: "OBSERVATION", reasons };
  }

  if (input.sampleSize < 5) {
    reasons.push("Sample size too small for validation");
    return { allowed: false, maxState: "CANDIDATE", reasons };
  }

  const onlyHistorical =
    input.temporalTiers.length > 0 &&
    input.temporalTiers.every((t) => t === "HISTORICAL_CUMULATIVE");

  if (onlyHistorical && input.evidenceConfidence === "HIGH") {
    reasons.push(
      "Historical single-snapshot-only evidence should not claim HIGH confidence without longitudinal/archive support"
    );
  }

  if (onlyHistorical) {
    reasons.push(
      "Historical cumulative only — max STRONG_CANDIDATE until future cycles/archive/longitudinal support"
    );
    return {
      allowed: false,
      maxState: "STRONG_CANDIDATE",
      reasons,
    };
  }

  reasons.push(
    "Structural checks passed — VALIDATED still requires separate human approval"
  );
  return { allowed: true, maxState: "VALIDATED", reasons };
}
