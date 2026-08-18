/**
 * Operator architecture lock (v11.4.8).
 * No engine replaces the Creator. Roles do not mix.
 * Keep conceptual sync with lib/intelligence/engine-architecture.ts (Edge cannot import lib/).
 */
export const ENGINE_ARCHITECTURE_VERSION = "engine-architecture-v1-role-lock";
export const ARCHITECTURE_NO_ENGINE_REPLACES_CREATOR = true as const;
export const ARCHITECTURE_JUDGE_DOES_NOT_WRITE = true as const;
export const ARCHITECTURE_PERFORMANCE_DOES_NOT_OVERWRITE_CREATOR_DNA = true as const;
export const ARCHITECTURE_REVENUE_DOES_NOT_DOMINATE = true as const;
export const ARCHITECTURE_WRITER_IS_NOT_PLANNER = true as const;
export const ARCHITECTURE_POST_IS_NOT_WEEKLY = true as const;

export const ARCHITECTURE_PIPELINE =
  "Data/Evidence → Audience DNA (X status) → Creator DNA (RETURN/BRIDGE/REACH + type) → Weekly Agent승 place/time/Seeds → Seed Pool(explore to locked count + buffer) → Post Agent승 thinks then writes → Semantic Judge final validate → reject returns that slot to Post Agent승 → Publish → Analytics → Validated Learning → Planner Memory";

export function architecturePrincipleBlock(): string {
  return [
    `ARCHITECTURE ${ENGINE_ARCHITECTURE_VERSION}`,
    "PRINCIPLE: No engine replaces the Creator. Each engine has one job. Roles do not mix.",
    `PIPELINE: ${ARCHITECTURE_PIPELINE}`,
    "FORBIDDEN MIXES: Writer must not become Planner. Post Agent승 must not become Weekly Agent승. Performance DNA must not overwrite Creator DNA. Revenue DNA must not dominate strategy. Judge must not rewrite. Unpublished AI drafts must not train Planner Memory.",
  ].join("\n");
}

export function dnaLayerBlock(): string {
  return [
    "DNA LAYERS (read together; missing evidence is UNKNOWN, not zero). Layers stay. Creator DNA judges AP slots from Audience X status. Planner places clock and Seeds:",
    "Creator DNA: who this person is — how he thinks, expresses, observes. Not overwritten by audience or performance.",
    "Audience DNA: X Analytics primary, Fedica auxiliary. What readers react to now and where interest is moving. Not follow-the-followers. Must not overwrite Creator DNA.",
    "Performance DNA: validated feature↔outcome from published posts + Analytics only. Not a winning-post wording store. Planner uses it to try or reduce patterns, never to copy sentences.",
    "Revenue DNA: durable revenue relationships. Never outranks authenticity, audience quality, trust. Empty revenue is UNKNOWN, not a success pattern.",
    "Current X Context: currentness around Creator and Audience on X now. Not a news feed. Not copied into a post prompt.",
    "Success / Planner Memory: abstract patterns validated by Publishing + Analytics. Generated drafts are hypotheses. Must be read on the next seven-day generate.",
  ].join("\n");
}

export function engineCatalogBlock(): string {
  return [
    "SEED: Seed Generator collects last-7-day Korean public posts (replies >= 20; impressions >= 50k only if that pool is short) as one scene + one observation. It does not judge RETURN/BRIDGE/REACH or types. PLANNING: Weekly Agent승 judges RETURN/BRIDGE/REACH and types. REACH is 1 per day, max 2. Consecutive slots must not share a situation cluster. FSD/driving scenes are at most 2 per day. Weekly Agent승 infers each slot date/time from evidence (min 2h gap is a constraint, not a 14:00 grid) and allocates Seeds. Recent-flow lived material is Analytics originals plus sync-gap originals. USER_DIRECT and AP_PIPELINE stay separate. Post Agent승 receives the assigned Seed + slot intent.",
    "WRITING: Thought first, style follows. Post Agent승 closes ONE central judgment on this Seed then writes the final post. No separate Writer re-interprets the thought. Collection is after Core Thought. Everyday language, 말투, humor, Mechanism, and Rail must not choose the thought. Do not invent identity. Do not invent lived experience.",
    "QUALITY: Semantic Judge sees only the completed post and decides final publishability. It does not select Seeds, redesign strategy, or write. Reject returns that slot to Post Agent승. Do not rebuild the weekly plan. Week count is Judge: N Judge-PASS saved posts for N planned slots.",
    "LEARNING: Closed loop — Publish → Analytics Import → Feature Extraction → Performance/Revenue Analysis → Learning → DNA/Memory Update → next seven-day Planner reads → new Planning. Analytics Import takes X Analytics first into a canonical model (Fedica is an adapter). Features are learned, not sentences. Manual published success is a stronger Creator Signal than an AI draft. One-off success stays hypothesis. Learning that the Planner does not read is not a closed loop.",
  ].join("\n");
}

/** Full lock for Planner (quota + seed). */
export function plannerArchitectureLock(): string {
  return [architecturePrincipleBlock(), dnaLayerBlock(), engineCatalogBlock()].join("\n");
}

/** Writer-layer slice. Do not dump Performance DNA into the writer. */
export function writerArchitectureLock(): string {
  return [
    architecturePrincipleBlock(),
    "YOUR LAYER: Post Agent승. THIS CALL: POST. Thought first, then write the final post yourself. Collection after Core Thought. Delivery engines are not inputs that pick the thought.",
    "You do not choose Seeds, editorial balance, or seven-day strategy. You do not become the Planner. You do not become Weekly Agent승. You understand the assigned Seed + slot intent, close the thought, and write.",
    "Performance DNA is Planner-only. Performance DNA is weekly-only. Do not chase winning feature combos. Do not copy successful wording. Revenue DNA does not pick this post.",
  ].join("\n");
}
