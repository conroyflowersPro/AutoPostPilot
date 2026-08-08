/**
 * Offline contract self-check — no DB required.
 */
import { UNIVERSAL_SCALAR_SCORE_FORBIDDEN } from "./contract-v1";
import { emptyContentEvidence, isPresentationOnly } from "./content-evidence";
import {
  assertNoUniversalScalar,
  deriveOutcomeVector,
} from "./outcome-vector";
import { authenticityGate } from "./authenticity-gate";
import { evaluatePromotion } from "./promotion-guardrail";
import { ARCHIVE_ADAPTER_SLOT } from "./adapters/x-archive-adapter.stub";
import { defaultHistoricalApiConfidence } from "./confidence";

export type ContractCheck = { name: string; pass: boolean; detail?: string };

export function runContractSelfCheck(): ContractCheck[] {
  const checks: ContractCheck[] = [];

  checks.push({
    name: "no_universal_scalar_constant",
    pass: UNIVERSAL_SCALAR_SCORE_FORBIDDEN === true,
  });

  const vec = deriveOutcomeVector({
    publicMetrics: {
      impression_count: { presence: "PRESENT_NON_ZERO", value: 100 },
      bookmark_count: { presence: "PRESENT_ZERO", value: 0 },
      reply_count: { presence: "PRESENT_NON_ZERO", value: 2 },
    },
  });
  checks.push({
    name: "outcome_vector_no_scalar",
    pass: assertNoUniversalScalar(vec) && vec.universalScalarScore === null,
  });
  checks.push({
    name: "revenue_axis_not_zero_filled",
    pass: vec.dimensions.some(
      (d) => d.axis === "REVENUE" && d.presence === "NOT_AVAILABLE"
    ),
  });

  const ce = emptyContentEvidence();
  ce.presentation.emoji_usage = true;
  ce.presentation.hook_style = "breaking";
  checks.push({
    name: "presentation_only_detected",
    pass: isPresentationOnly(ce) === true,
  });

  const promo = evaluatePromotion({
    population: "ORIGINAL",
    contentEvidence: ce,
    outcomeAxes: ["REACH"],
    sampleSize: 50,
    temporalSpreadDays: 30,
    evidenceSources: ["X_API"],
    temporalTiers: ["HISTORICAL_CUMULATIVE"],
    evidenceConfidence: "MEDIUM",
    knownConfounders: [],
  });
  checks.push({
    name: "surface_only_cannot_validate",
    pass: promo.allowed === false && promo.maxState === "OBSERVATION",
    detail: promo.reasons.join("; "),
  });

  const replyPromo = evaluatePromotion({
    population: "REPLY",
    outcomeAxes: ["DISCUSSION"],
    sampleSize: 100,
    temporalSpreadDays: 60,
    evidenceSources: ["X_API"],
    temporalTiers: ["HISTORICAL_CUMULATIVE"],
    evidenceConfidence: "MEDIUM",
    knownConfounders: [],
  });
  checks.push({
    name: "reply_cannot_validate_publishing_pattern",
    pass: replyPromo.allowed === false,
    detail: replyPromo.reasons.join("; "),
  });

  const gate = authenticityGate({
    intendedProvenance: "FIRSTHAND",
    evidenceBacked: false,
    draftText: "내가 직접 테스트해봤는데",
  });
  checks.push({
    name: "firsthand_without_evidence_blocked",
    pass: gate.allow === false && gate.mode === "CREATOR_INPUT_REQUIRED",
  });

  const hist = defaultHistoricalApiConfidence();
  checks.push({
    name: "historical_tier_cumulative",
    pass:
      hist.temporalTier === "HISTORICAL_CUMULATIVE" && hist.temporal === "LOW",
  });

  checks.push({
    name: "archive_adapter_slot",
    pass: ARCHIVE_ADAPTER_SLOT.includes("XArchiveAdapter"),
  });

  return checks;
}

export function allContractChecksPass(): boolean {
  return runContractSelfCheck().every((c) => c.pass);
}
