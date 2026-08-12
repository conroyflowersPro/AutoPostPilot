/**
 * ORDER 0A HOTFIX 3 — Strict count integrity + Planner canonical target consumption.
 */

import {
  buildCanonicalTarget,
  type CanonicalTarget,
  type CanonicalTargetSource,
} from "./canonical-target";

export type { CanonicalTarget, CanonicalTargetSource };
export { buildCanonicalTarget };

export type StageCounts = {
  expected_count: number;
  received_count: number;
  accepted_count: number;
  rejected_count: number;
  retried_count: number;
  persisted_count: number;
  displayed_count?: number;
  delta?: number;
};

export type RunStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILURE";

export type GenerationRunReport = {
  run_id: string;
  status: RunStatus;
  canonical_requested_slots: number;
  canonical_minimum: number;
  canonical_maximum: number;
  canonical_source: CanonicalTargetSource;
  planner_base_required_slots: number | null;
  planner_final_target: number | null;
  ui_requested_slots: number;
  requested_slots: number;
  planned_slots: number;
  expanded_candidates: number;
  selected_slots: number;
  initial_generation_valid: number;
  generated_attempts: number;
  valid_drafts: number;
  rejected_drafts: number;
  duplicate_rejections: number;
  judge_rejections: number;
  judge_rejections_total: number;
  hard_rejections: number;
  soft_rejections: number;
  regenerated_after_judge: number;
  recovered_after_judge: number;
  unresolved_after_judge: number;
  parser_failures: number;
  generation_failures: number;
  retry_attempts: number;
  recovered_slots: number;
  persistence_failures: number;
  valid_before_persist: number;
  persisted_success: number;
  claimed_persisted_count: number;
  actual_persisted_count: number;
  query_returned_count: number;
  actual_visible_count: number;
  hidden_count: number;
  hidden_reasons: string[];
  unresolved_slots: number;
  final_db_count: number;
  final_visible_count: number;
  failure_stage?: string;
  failure_reasons: string[];
  stages: Record<string, Partial<StageCounts>>;
  unresolved_reasons: string[];
  complete: boolean;
  count_ok: boolean;
};

export function newRunId(): string {
  return `grun_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyStage(expected = 0): StageCounts {
  return {
    expected_count: expected,
    received_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    retried_count: 0,
    persisted_count: 0,
  };
}

export function countIntegrityOk(requested: number, finalValid: number): {
  ok: boolean;
  reason: string;
} {
  if (requested <= 0) return { ok: false, reason: "INVALID_REQUESTED" };
  if (finalValid < requested) return { ok: false, reason: "BELOW_REQUESTED" };
  if (finalValid > requested + 1) return { ok: false, reason: "ABOVE_REQUESTED_PLUS_ONE" };
  return { ok: true, reason: "OK" };
}

/** @deprecated use buildCanonicalTarget */
export function resolveCanonicalTarget(input: {
  planner_final_slots?: number | null;
  planner_base_required?: number | null;
  total_planned?: number | null;
  ui_requested_slots: number;
  count_ok?: boolean | null;
}): {
  canonical_requested_slots: number;
  canonical_source: CanonicalTargetSource;
} {
  const t = buildCanonicalTarget({
    planner_final_slots: input.planner_final_slots,
    planner_base_required: input.planner_base_required,
    total_planned: input.total_planned,
    count_ok: input.count_ok,
    request_fallback_slots: input.ui_requested_slots,
  });
  return {
    canonical_requested_slots: t.canonical_minimum,
    canonical_source: t.target_source,
  };
}

export function shortfall(canonical: number, current: number): number {
  return Math.max(0, canonical - Math.max(0, current));
}

export function evaluateStrictSuccess(input: {
  canonical: number;
  valid: number;
  actual_persisted: number;
  actual_visible: number;
}): {
  status: RunStatus;
  count_ok: boolean;
  complete: boolean;
  failure_stage?: string;
  failure_reasons: string[];
} {
  const N = input.canonical;
  const reasons: string[] = [];
  let failure_stage: string | undefined;
  if (input.valid < N) {
    reasons.push(`VALID_BELOW:${input.valid}<${N}`);
    failure_stage = failure_stage || "generation";
  }
  if (input.actual_persisted < N) {
    reasons.push(`PERSISTED_BELOW:${input.actual_persisted}<${N}`);
    failure_stage = failure_stage || "persistence";
  }
  if (input.actual_visible < N) {
    reasons.push(`VISIBLE_BELOW:${input.actual_visible}<${N}`);
    failure_stage = failure_stage || "queue";
  }
  if (reasons.length === 0) {
    return { status: "SUCCESS", count_ok: true, complete: true, failure_reasons: [] };
  }
  const anyProgress =
    input.valid > 0 || input.actual_persisted > 0 || input.actual_visible > 0;
  return {
    status: anyProgress ? "PARTIAL_FAILURE" : "FAILURE",
    count_ok: false,
    complete: false,
    failure_stage,
    failure_reasons: reasons,
  };
}

export function finalizeRunReport(
  partial: Omit<
    GenerationRunReport,
    "complete" | "count_ok" | "requested_slots" | "status" | "failure_reasons"
  > & {
    complete?: boolean;
    count_ok?: boolean;
    requested_slots?: number;
    status?: RunStatus;
    failure_reasons?: string[];
  }
): GenerationRunReport {
  const min = partial.canonical_minimum ?? partial.canonical_requested_slots;
  const strict = evaluateStrictSuccess({
    canonical: min,
    valid: partial.valid_drafts,
    actual_persisted: partial.actual_persisted_count,
    actual_visible: partial.actual_visible_count,
  });
  return {
    ...partial,
    canonical_requested_slots: min,
    canonical_minimum: min,
    canonical_maximum: partial.canonical_maximum ?? min + 1,
    requested_slots: min,
    status: strict.status,
    complete: strict.complete,
    count_ok: strict.count_ok,
    failure_stage: strict.failure_stage || partial.failure_stage,
    failure_reasons: [...(partial.failure_reasons || []), ...strict.failure_reasons],
  };
}
