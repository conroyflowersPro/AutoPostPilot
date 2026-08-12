/**
 * ORDER 0A — 7-Day Generation Count Integrity
 * Tracks expected→final counts; forbids silent success when short.
 */

export type StageCounts = {
  expected_count: number;
  received_count: number;
  accepted_count: number;
  rejected_count: number;
  retried_count: number;
  persisted_count: number;
  displayed_count?: number;
};

export type GenerationRunReport = {
  run_id: string;
  requested_slots: number;
  planned_slots: number;
  generated_attempts: number;
  valid_drafts: number;
  rejected_drafts: number;
  duplicate_rejections: number;
  judge_rejections: number;
  parser_failures: number;
  persistence_failures: number;
  unresolved_slots: number;
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
  if (finalValid < requested) {
    return { ok: false, reason: "BELOW_REQUESTED" };
  }
  if (finalValid > requested + 1) {
    return { ok: false, reason: "ABOVE_REQUESTED_PLUS_ONE" };
  }
  return { ok: true, reason: "OK" };
}

export function finalizeRunReport(
  partial: Omit<GenerationRunReport, "complete" | "count_ok"> & {
    complete?: boolean;
    count_ok?: boolean;
  }
): GenerationRunReport {
  const integrity = countIntegrityOk(partial.requested_slots, partial.valid_drafts);
  return {
    ...partial,
    complete: partial.unresolved_slots === 0 && integrity.ok,
    count_ok: integrity.ok,
  };
}
