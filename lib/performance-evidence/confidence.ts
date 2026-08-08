/**
 * Evidence confidence helpers — tiers, not complex numeric scores
 */
import type {
  ConfidenceTier,
  EvidenceSourceId,
  TemporalEvidenceTier,
} from "./contract-v1";

export type EvidenceConfidence = {
  source: ConfidenceTier;
  metric: ConfidenceTier;
  temporal: ConfidenceTier;
  feature: ConfidenceTier;
  temporalTier: TemporalEvidenceTier;
};

export function defaultHistoricalApiConfidence(): EvidenceConfidence {
  return {
    source: "HIGH",
    metric: "MEDIUM",
    temporal: "LOW",
    feature: "UNKNOWN",
    temporalTier: "HISTORICAL_CUMULATIVE",
  };
}

export function sourceConfidence(source: EvidenceSourceId): ConfidenceTier {
  switch (source) {
    case "X_API":
      return "HIGH";
    case "X_ARCHIVE":
      return "MEDIUM";
    case "X_ANALYTICS":
      return "HIGH";
    case "FEDICA":
      return "MEDIUM";
    case "X_MONETIZATION":
      return "HIGH";
    default:
      return "UNKNOWN";
  }
}
