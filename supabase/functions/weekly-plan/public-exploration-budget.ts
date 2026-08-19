/**
 * Public X Seed Pool is independent of lived / USER_DIRECT evidence.
 * Lived count is EXPERIENCE grounding supply, never a reason to search less on X.
 *
 * Target is dynamic: week slots + expected drop + diversity + already burned seeds.
 * Not requiredSlots+10. Not a frozen 100.
 */
import { isLivedSelfSeed } from "./seed-ownership.ts";
import { MAX_WEEKLY_SLOTS, MIN_WEEKLY_SLOTS } from "./quota-inference.ts";

/** 1.25x (칸+10 on 39) is too tight for Judge / unfit / diversity / Agent승 choice. */
export const PUBLIC_EXPLORATION_MIN_MULTIPLIER = 1.75;
export const PUBLIC_EXPLORATION_MAX_MULTIPLIER = 2.25;
/** Ceiling tracks the week bound, not a magic 100. */
export const PUBLIC_EXPLORATION_CAP = MAX_WEEKLY_SLOTS * 2;

export type PublicExplorationSeed = {
  owner?: string;
  seed_source?: string;
  primary_source?: string;
  source?: string;
  cluster?: string;
  seed_id?: string;
};

export type PublicExplorationInput = {
  requiredSlots: number;
  gated?: PublicExplorationSeed[];
  rejectedPublicSeedIds?: string[];
  abandonedPublicSeedIds?: string[];
  judgeRejectCount?: number;
  seedUnfitCount?: number;
};

export type PublicExplorationBudget = {
  horizonSlots: number;
  multiplier: number;
  diversityExtra: number;
  burned: number;
  target: number;
  have: number;
  remaining: number;
};

export function isPublicExplorationSeed(seed: PublicExplorationSeed | null | undefined): boolean {
  return !isLivedSelfSeed(seed as Record<string, unknown>);
}

export function publicExplorationHave(gated: PublicExplorationSeed[] | undefined | null): number {
  return (gated || []).filter((seed) => isPublicExplorationSeed(seed)).length;
}

function uniqueCount(ids: Array<string | undefined>): number {
  const seen = new Set<string>();
  for (const id of ids) {
    const key = String(id || "").trim();
    if (key) seen.add(key);
  }
  return seen.size;
}

function uniquePublicClusters(gated: PublicExplorationSeed[]): number {
  const seen = new Set<string>();
  for (const seed of gated) {
    if (!isPublicExplorationSeed(seed)) continue;
    const cluster = String(seed.cluster || "").trim().toUpperCase();
    if (cluster && cluster !== "HELD") seen.add(cluster);
  }
  return seen.size;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * How many public X seeds the week still needs to explore.
 * Lived / USER_DIRECT packets in `gated` do not count toward have or shrink target.
 */
export function publicExplorationBudget(input: PublicExplorationInput): PublicExplorationBudget {
  const required = Math.max(0, Math.round(Number(input.requiredSlots) || 0));
  const horizonSlots = required > 0 ? required : MIN_WEEKLY_SLOTS;
  const gated = Array.isArray(input.gated) ? input.gated : [];
  const have = publicExplorationHave(gated);
  const burned = uniqueCount([
    ...(input.rejectedPublicSeedIds || []),
    ...(input.abandonedPublicSeedIds || []),
  ]);
  const judge = Math.max(0, Math.round(Number(input.judgeRejectCount) || 0));
  const unfit = Math.max(0, Math.round(Number(input.seedUnfitCount) || 0));
  const observedLoss = burned + judge + unfit;
  const denom = Math.max(have + observedLoss, horizonSlots, 1);
  const observedRate = clamp(observedLoss / denom, 0.2, 0.55);
  const multiplier = clamp(
    1 / (1 - observedRate),
    PUBLIC_EXPLORATION_MIN_MULTIPLIER,
    PUBLIC_EXPLORATION_MAX_MULTIPLIER,
  );
  const clusters = uniquePublicClusters(gated);
  const diversityExtra = clusters < 5 ? (5 - clusters) * 3 : 0;
  const raw = Math.ceil(horizonSlots * multiplier) + diversityExtra + burned;
  const floor = Math.ceil(horizonSlots * PUBLIC_EXPLORATION_MIN_MULTIPLIER);
  const target = clamp(raw, floor, PUBLIC_EXPLORATION_CAP);
  const remaining = Math.max(0, target - have);
  return {
    horizonSlots,
    multiplier,
    diversityExtra,
    burned,
    target,
    have,
    remaining,
  };
}

export function publicExplorationRoundBudget(remaining: number, hardCap: number): number {
  const fill = Math.ceil(Math.max(0, remaining) / 3);
  return Math.min(hardCap, Math.max(16, fill));
}
