/**
 * Horizon bounds only. Weekly slot count is the Planner's job, not a separate
 * Quota xAI call. Seed Generator receives requested_seed_count from Planner.
 */
export const QUOTA_DAYS = 7;
export const QUOTA_PER_DAY_MAX = 8;
export const QUOTA_PER_DAY_MIN = 4;
export const MIN_WEEKLY_SLOTS = QUOTA_PER_DAY_MIN * QUOTA_DAYS;
export const MAX_WEEKLY_SLOTS = QUOTA_PER_DAY_MAX * QUOTA_DAYS;
export const SEED_POOL_BUFFER = 10;
