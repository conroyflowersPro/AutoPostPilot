/**
 * COLLECTION_READY_HOOK
 *
 * Insertion point (must stay here):
 *   Agent승 THINK → Core Thought 확정 → COLLECTION_READY_HOOK → Agent승 WRITE
 *
 * One hybrid search per slot after a real Core Thought exists.
 * Candidates only (force ≤2, form ≤2). Code does not pick or mix cards.
 * Zero candidates is normal. Judge / PLAN / Seed do not call this.
 */
import type { SemanticSeedPacket } from "./semantic-seed-packet.ts";
import {
  searchAgentSeungTheories,
  theoryChunksForModel,
} from "./agent-seung.ts";

export const COLLECTION_READY_HOOK_POINT = "after_core_thought_before_write" as const;
/** Max Collection searches the hook may make per slot. Not a requirement. */
export const COLLECTION_API_CALLS_THIS_ORDER = 1 as const;
export const COLLECTION_READY_HOOK_NOOP = false as const;
export const COLLECTION_CANDIDATE_FORCE_CAP = 2 as const;
export const COLLECTION_CANDIDATE_FORM_CAP = 2 as const;

export type CollectionReadyMeaning = {
  scene?: string;
  factual_event?: string;
  change_or_delta?: string;
  contrast_or_tension?: string;
  human_relevance?: string;
  core_thought?: string;
};

export type CollectionReadyHookResult = {
  insertion_point: typeof COLLECTION_READY_HOOK_POINT;
  skipped: boolean;
  api_calls: 0 | 1;
  reason: string;
  meaning: CollectionReadyMeaning;
  collection_block: string;
};

function keep(v: unknown, max = 180): string | undefined {
  const t = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return t.length >= 2 ? t : undefined;
}

/** Accessible meaning for Collection search. Empty fields are omitted, not invented. */
export function collectionReadyMeaning(
  packet: SemanticSeedPacket | null | undefined,
  coreThought?: string | null,
): CollectionReadyMeaning {
  const p = packet || {};
  const meaning: CollectionReadyMeaning = {};
  const scene = keep(p.scene);
  const factual = keep(p.factual_event);
  const delta = keep(p.change_or_delta);
  const tension = keep(p.contrast_or_tension);
  const human = keep(p.human_relevance);
  const thought = keep(coreThought, 220);
  if (scene) meaning.scene = scene;
  if (factual) meaning.factual_event = factual;
  if (delta) meaning.change_or_delta = delta;
  if (tension) meaning.contrast_or_tension = tension;
  if (human) meaning.human_relevance = human;
  if (thought) meaning.core_thought = thought;
  return meaning;
}

const NONE_BLOCK =
  "COLLECTION: none this run. Write without cards. Zero cards is normal. Do not invent force.";

/**
 * Search after Core Thought. Does not choose cards. Does not change Core Thought.
 * Missing thought / missing secret / empty query / HTTP fail → WRITE with no cards.
 */
export async function runCollectionReadyHook(input: {
  seed_packet?: SemanticSeedPacket | null;
  core_thought?: string | null;
  xaiKey?: string | null;
}): Promise<CollectionReadyHookResult> {
  const meaning = collectionReadyMeaning(input.seed_packet, input.core_thought);
  const thought = String(input.core_thought || "").replace(/\s+/g, " ").trim();
  const base = {
    insertion_point: COLLECTION_READY_HOOK_POINT,
    meaning,
  };

  if (thought.length < 8) {
    return { ...base, skipped: true, api_calls: 0, reason: "missing_core_thought", collection_block: NONE_BLOCK };
  }

  const log = await searchAgentSeungTheories(thought, {
    xaiKey: input.xaiKey || "",
    packet: {
      scene: meaning.scene,
      factual_event: meaning.factual_event,
      change_or_delta: meaning.change_or_delta,
      contrast_or_tension: meaning.contrast_or_tension,
      human_relevance: meaning.human_relevance,
      core_thought: thought,
    },
  });

  if (log.skipped) {
    return {
      ...base,
      skipped: true,
      api_calls: 0,
      reason: log.skip_reason || "search_skipped",
      collection_block: NONE_BLOCK,
    };
  }

  return {
    ...base,
    skipped: false,
    api_calls: 1,
    reason: "candidates_ready",
    collection_block: theoryChunksForModel(log.chunks),
  };
}
