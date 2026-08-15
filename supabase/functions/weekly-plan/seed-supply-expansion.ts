/**
 * Seed supply expansion — Creator DNA reasoning primary (philosophy v1)
 * Replaces DIMENSION_REGISTRY template emission as the expansion driver.
 * Keeps expandSeedSupplyWithXai signature for thin index compatibility.
 */
import { type ConcreteSeed } from "./seed-engine.ts";
import {
  reasonCreatorSeeds,
  CREATOR_SEED_REASONING_VERSION,
  type ViralCandidate,
} from "./creator-seed-reasoning.ts";
import type { PlannerIntelligenceBlocks } from "./planner-intelligence.ts";

export const SEED_SUPPLY_HOTFIX_VERSION = "seed_supply_creator_reasoning_v1";
export { CREATOR_SEED_REASONING_VERSION };

export type XaiSeedExpansionResult = {
  seeds: ConcreteSeed[];
  attempted: boolean;
  succeeded: boolean;
  error: string | null;
  requested: number;
  returned: number;
  raw_returned: number;
  reject_reasons: Record<string, number>;
  reasoning_version?: string;
  used_creator_dna?: boolean;
  used_dimension_registry_as_seed_body?: boolean;
};

/**
 * Paid expansion: Creator + recent angles + optional viral + pattern hints.
 * Never finished posts. Never registry-as-seed-body.
 */
export async function expandSeedSupplyWithXai(args: {
  xaiKey: string;
  needed: number;
  existing: ConcreteSeed[];
  explicitCreatorIntent?: string;
  recentPublishedAngles?: string[];
  viralCandidates?: ViralCandidate[];
  performancePatternHints?: string[];
  clusterInterestWeights?: Array<{ cluster: string; n: number }>;
  registryInterestHints?: Array<{ cluster: string; dimension: string }>;
  userDirectN?: number;
  adjacentRing?: boolean;
  humorRing?: boolean;
  learning?: {
    stage?: string;
    note_ko?: string;
    seed_rule?: string;
    validated_performance_patterns?: number;
  };
  compactRetry?: boolean;
  intelligence?: PlannerIntelligenceBlocks | null;
  model?: string;
  timeoutMs?: number;
}): Promise<XaiSeedExpansionResult> {
  const res = await reasonCreatorSeeds({
    xaiKey: args.xaiKey,
    needed: args.needed,
    existing: args.existing,
    explicitCreatorIntent: args.explicitCreatorIntent,
    recentPublishedAngles: args.recentPublishedAngles,
    viralCandidates: args.viralCandidates,
    performancePatternHints: args.performancePatternHints,
    clusterInterestWeights: args.clusterInterestWeights,
    registryInterestHints: args.registryInterestHints,
    userDirectN: args.userDirectN,
    adjacentRing: args.adjacentRing,
    humorRing: args.humorRing,
    compactRetry: args.compactRetry,
    learning: args.learning,
    intelligence: args.intelligence || null,
    model: args.model,
    timeoutMs: args.timeoutMs,
  });
  return {
    seeds: res.seeds,
    attempted: res.attempted,
    succeeded: res.succeeded,
    error: res.error,
    requested: res.requested,
    returned: res.returned,
    raw_returned: res.raw_returned,
    reject_reasons: res.reject_reasons,
    reasoning_version: res.version,
    used_creator_dna: res.used_creator_dna,
    used_dimension_registry_as_seed_body: res.used_dimension_registry_as_seed_body,
  };
}
