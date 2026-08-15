/**
 * More inferred posts/seeds must not make a single Edge call fatter.
 * Operational bound is 8 originals/day × 7 = 56. Each expand/Planner/write request stays small;
 * the client only increases how many rounds it runs.
 */
export const QUOTA_DAYS = 7;
export const QUOTA_PER_DAY_MIN = 3;
export const QUOTA_PER_DAY_MAX = 8;
export const MAX_WEEKLY_SLOTS = QUOTA_PER_DAY_MAX * QUOTA_DAYS;

/** Keep in lockstep with weekly-plan EXPAND_BATCH — one Grok call per Edge invoke. */
export const EXPAND_BATCH = 10;
export const WRITE_CHUNK = 1;

/** Grok may return fewer than EXPAND_BATCH. Budget as if ~3 usable seeds per round. */
const PESSIMISTIC_SEEDS_PER_EXPAND = 3;

export function expandRoundBudget(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  const fill = Math.ceil((slots * 1.2) / PESSIMISTIC_SEEDS_PER_EXPAND);
  return Math.min(36, Math.max(16, fill + 8));
}

export function priorSubjectCap(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.max(80, slots * 2);
}
