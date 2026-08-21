/**
 * More inferred posts/seeds must not make a single Edge call fatter.
 * Operational bound is 3 originals/day × 7 = 21. Each expand/Planner/write request stays small;
 * the client only increases how many rounds it runs.
 */
export const QUOTA_DAYS = 7;
export const QUOTA_PER_DAY_MIN = 3;
export const QUOTA_PER_DAY_MAX = 3;
export const MAX_WEEKLY_SLOTS = QUOTA_PER_DAY_MAX * QUOTA_DAYS;

/** Keep in lockstep with weekly-plan EXPAND_BATCH — one Grok call per Edge invoke. */
export const EXPAND_BATCH = 10;
export const WRITE_CHUNK = 1;

/** Grok may return fewer than EXPAND_BATCH. Budget as if ~3 usable seeds per round. */
const PESSIMISTIC_SEEDS_PER_EXPAND = 3;
const PUBLIC_EXPLORATION_MIN_MULTIPLIER = 1.75;

export function expandRoundBudget(requiredSlots: number): number {
  const slots = Math.max(21, Math.round(Number(requiredSlots) || 0) || 21);
  const target = Math.ceil(slots * PUBLIC_EXPLORATION_MIN_MULTIPLIER);
  const fill = Math.ceil(target / PESSIMISTIC_SEEDS_PER_EXPAND);
  return Math.min(36, Math.max(16, fill));
}

export function priorSubjectCap(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.max(80, slots * 2);
}
