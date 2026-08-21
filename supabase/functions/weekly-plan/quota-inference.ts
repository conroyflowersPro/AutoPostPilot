/**
 * Horizon bounds only. Weekly slot count is the Planner's job, not a separate
 * Quota xAI call. Seed Generator receives requested_seed_count from Planner.
 */
export const QUOTA_DAYS = 7;
/** Personal @Seung4680 lock: 11/15/19 PT only — 3 originals per day. */
export const QUOTA_PER_DAY_MAX = 3;
export const QUOTA_PER_DAY_MIN = 3;
export const MIN_WEEKLY_SLOTS = QUOTA_PER_DAY_MIN * QUOTA_DAYS;
export const MAX_WEEKLY_SLOTS = QUOTA_PER_DAY_MAX * QUOTA_DAYS;
/** @deprecated Not the public X exploration target. Lived must not fill this. See publicExplorationBudget. */
export const SEED_POOL_BUFFER = 10;
