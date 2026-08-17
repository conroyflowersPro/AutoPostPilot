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

export const ARCHITECTURE_PIPELINE =
  "Data/Evidence → Audience DNA (X status) → Creator DNA (RETURN/BRIDGE/REACH + type) → Planner place/time/Seeds → Seed Pool(explore to locked count + buffer) → Planner allocate Seeds → Writer understands Seed + Planner Intent then creates → Semantic Judge final validate → Creator DNA reject relabel → Planner Seeds → Writer batch → Publish → Analytics → Validated Learning → Planner Memory";

export function architecturePrincipleBlock(): string {
  return [
    `ARCHITECTURE ${ENGINE_ARCHITECTURE_VERSION}`,
    "PRINCIPLE: No engine replaces the Creator. Each engine has one job. Roles do not mix.",
    `PIPELINE: ${ARCHITECTURE_PIPELINE}`,
    "FORBIDDEN MIXES: Writer must not become Planner. Performance DNA must not overwrite Creator DNA. Revenue DNA must not dominate strategy. Judge must not rewrite. Unpublished AI drafts must not train Planner Memory.",
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
    "SEED: Seed Generator explores a candidate pool sized by locked slots + week buffer. It does not strategize, rank, select, allocate, or judge final quality. PLANNING: Creator DNA judges RETURN/BRIDGE/REACH and types. REACH is 1 per day, max 2. Planner places 14:00–22:00 PT and allocates Seeds. Recent-flow lived material is Analytics originals plus sync-gap originals. Writer receives the assigned Seed + Planner Intent.",
    "WRITING: Thought first, style follows. Grok 4.6 Writer closes ONE central judgment on this Seed (would this creator hold it? is it grounded?) then writes it in his language. Everyday language, 말투, humor, Mechanism, and Rail follow only to deliver that thought. They must not choose it. Do not invent identity. Do not invent lived experience.",
    "QUALITY: Semantic Judge sees only the completed post and decides final publishability. Creator-related judgment is a Contradiction Check, not a Creator Fit / topic-similarity score. It does not select Seeds, redesign strategy, undo Planner expansion, or rewrite. Reject returns the slot to Planner; Planner reselects from the existing pool first and requests targeted Seed exploration only when needed. Week count is Judge: N Judge-PASS saved posts for N planned slots. Planner locks the plan and does not close the week.",
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
    "YOUR LAYER: Writing. Thought first, then style. You close this Seed's central thought from Seed + Creator DNA + fact/experience boundaries, then deliver it as this creator would. Delivery engines are not inputs that pick the thought.",
    "You do not choose Seeds, editorial balance, or seven-day strategy. You do not become the Planner. You understand the assigned Seed + Planner Intent and close the thought for this post.",
    "Performance DNA is Planner-only. Do not chase winning feature combos. Do not copy successful wording. Revenue DNA does not pick this post.",
  ].join("\n");
}
