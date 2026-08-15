/**
 * More inferred posts/seeds must not make a single Edge call fatter.
 * X anti-dump max is 8 originals/day × 3 = 24. Each expand/write request stays small;
 * the client only increases how many rounds it runs.
 */
export const QUOTA_DAYS = 3;
export const QUOTA_PER_DAY_MIN = 3;
export const QUOTA_PER_DAY_MAX = 8;
export const MAX_WEEKLY_SLOTS = QUOTA_PER_DAY_MAX * QUOTA_DAYS;

/** Keep in lockstep with weekly-plan EXPAND_BATCH — one Grok call per Edge invoke. */
export const EXPAND_BATCH = 6;
export const WRITE_CHUNK = 2;
export const JUDGE_BATCH = 16;

/** Grok may return fewer than EXPAND_BATCH. Budget as if ~3 usable seeds per round. */
const PESSIMISTIC_SEEDS_PER_EXPAND = 3;

export function expandRoundBudget(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  const fill = Math.ceil((slots * 1.2) / PESSIMISTIC_SEEDS_PER_EXPAND);
  return Math.min(36, Math.max(16, fill + 8));
}

export function topupRoundBudget(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.min(16, Math.max(6, Math.ceil(slots / 3)));
}

export function priorSubjectCap(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.max(80, slots * 2);
}
