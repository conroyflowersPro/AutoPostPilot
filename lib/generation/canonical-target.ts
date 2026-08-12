/**
 * ORDER 0A HOTFIX 3 — Canonical weekly target object (Planner SOT only).
 * Downstream stages must consume this object; never recompute from UI constants.
 */

export type CanonicalTargetSource =
  | "planner_final_slots"
  | "planner_base_required"
  | "planner_total_planned_if_complete"
  | "ui_fallback_request_params_only";

export type CanonicalTarget = {
  planner_base_required_slots: number;
  planner_final_allocated_slots: number;
  canonical_minimum: number;
  canonical_maximum: number;
  target_source: CanonicalTargetSource;
  planner_run_id: string | null;
};

export function buildCanonicalTarget(input: {
  planner_base_required?: number | null;
  planner_final_slots?: number | null;
  total_planned?: number | null;
  count_ok?: boolean | null;
  request_fallback_slots?: number | null;
  planner_run_id?: string | null;
}): CanonicalTarget {
  const finalSlots = Number(input.planner_final_slots);
  const base = Number(input.planner_base_required);
  const planned = Number(input.total_planned);
  const fallback = Math.max(0, Number(input.request_fallback_slots) || 0);
  let source: CanonicalTargetSource;
  let minimum: number;
  if (Number.isFinite(finalSlots) && finalSlots > 0) {
    minimum = finalSlots;
    source = "planner_final_slots";
  } else if (Number.isFinite(base) && base > 0) {
    minimum = base;
    source = "planner_base_required";
  } else if (input.count_ok === true && Number.isFinite(planned) && planned > 0) {
    minimum = planned;
    source = "planner_total_planned_if_complete";
  } else {
    minimum = fallback > 0 ? fallback : 0;
    source = "ui_fallback_request_params_only";
  }
  const baseReq = Number.isFinite(base) && base > 0 ? base : minimum;
  const finalAlloc =
    Number.isFinite(finalSlots) && finalSlots > 0 ? finalSlots : minimum;
  return {
    planner_base_required_slots: baseReq,
    planner_final_allocated_slots: finalAlloc,
    canonical_minimum: minimum,
    canonical_maximum: minimum + 1,
    target_source: source,
    planner_run_id: input.planner_run_id || null,
  };
}

export function shortfallVsCanonical(target: CanonicalTarget, current: number): number {
  return Math.max(0, target.canonical_minimum - Math.max(0, current));
}

export function withinCanonicalBand(target: CanonicalTarget, count: number): boolean {
  return count >= target.canonical_minimum && count <= target.canonical_maximum;
}
