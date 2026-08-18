/**
 * ORDER 2 — COLLECTION_READY_HOOK
 *
 * Insertion point (must stay here):
 *   Agent승 THINK → Core Thought 확정 → COLLECTION_READY_HOOK → Agent승 WRITE
 *
 * This order: no xAI Collection API, no fake cards, no Topic→card map.
 * Collection-less WRITE must succeed. Future Collection order plugs in here
 * without tearing down Generation Runtime.
 */
import type { SemanticSeedPacket } from "./semantic-seed-packet.ts";

export const COLLECTION_READY_HOOK_POINT = "after_core_thought_before_write" as const;
export const COLLECTION_API_CALLS_THIS_ORDER = 0 as const;
export const COLLECTION_READY_HOOK_NOOP = true as const;

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
  skipped: true;
  api_calls: 0;
  reason: "order2_collection_noop";
  meaning: CollectionReadyMeaning;
  collection_block: string;
};

function keep(v: unknown, max = 180): string | undefined {
  const t = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return t.length >= 2 ? t : undefined;
}

/** Accessible meaning for a later Collection order. Empty fields are omitted, not invented. */
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

/**
 * No-op hook. Does not call searchAgentSeungTheories.
 * Future order may retrieve cards from `meaning` after a real Core Thought exists.
 */
export function runCollectionReadyHook(input: {
  seed_packet?: SemanticSeedPacket | null;
  core_thought?: string | null;
}): CollectionReadyHookResult {
  const meaning = collectionReadyMeaning(input.seed_packet, input.core_thought);
  return {
    insertion_point: COLLECTION_READY_HOOK_POINT,
    skipped: true,
    api_calls: 0,
    reason: "order2_collection_noop",
    meaning,
    collection_block:
      "COLLECTION: none this run. Write without cards. Zero cards is normal. Do not invent force.",
  };
}
