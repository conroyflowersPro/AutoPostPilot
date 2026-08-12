/**
 * ORDER 0A / HOTFIX — 7-Day Generation Count Integrity
 * Canonical weekly target = Planner final allocation (not UI 7×6).
 */

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

export type CanonicalTargetSource =
  | "planner_final_slots"
  | "planner_base_required"
  | "planner_total_planned_if_complete"
  | "ui_fallback";

export type GenerationRunReport = {
  run_id: string;
  canonical_requested_slots: number;
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
  query_returned_count: number;
  unresolved_slots: number;
  final_db_count: number;
  final_visible_count: number;
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
  const finalSlots = Number(input.planner_final_slots);
  if (Number.isFinite(finalSlots) && finalSlots > 0) {
    return { canonical_requested_slots: finalSlots, canonical_source: "planner_final_slots" };
  }
  const base = Number(input.planner_base_required);
  if (Number.isFinite(base) && base > 0) {
    return { canonical_requested_slots: base, canonical_source: "planner_base_required" };
  }
  const planned = Number(input.total_planned);
  if (input.count_ok === true && Number.isFinite(planned) && planned > 0) {
    return {
      canonical_requested_slots: planned,
      canonical_source: "planner_total_planned_if_complete",
    };
  }
  const ui = Math.max(1, Number(input.ui_requested_slots) || 1);
  return { canonical_requested_slots: ui, canonical_source: "ui_fallback" };
}

export function shortfall(canonical: number, current: number): number {
  return Math.max(0, canonical - Math.max(0, current));
}

export function finalizeRunReport(
  partial: Omit<GenerationRunReport, "complete" | "count_ok" | "requested_slots"> & {
    complete?: boolean;
    count_ok?: boolean;
    requested_slots?: number;
  }
): GenerationRunReport {
  const requested = partial.canonical_requested_slots;
  const integrity = countIntegrityOk(requested, partial.valid_drafts);
  return {
    ...partial,
    requested_slots: requested,
    complete: partial.unresolved_slots === 0 && integrity.ok,
    count_ok: integrity.ok,
  };
}
