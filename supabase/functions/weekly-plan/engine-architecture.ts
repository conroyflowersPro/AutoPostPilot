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
  "Data/Evidence → 4 DNA → Planner → Dynamic Seeds → Interpretation(boundaries) → Writer closes thought then writes (style follows) → Semantic Judge → Selective Regeneration → Publish → Analytics → Validated Learning → Planner Memory";

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
    "DNA LAYERS (read together; missing evidence is UNKNOWN, not zero). The 3-day Planner MUST read all of them:",
    "Creator DNA: who this person is — how he thinks, expresses, observes. Not overwritten by audience or performance.",
    "Audience DNA: X Analytics primary, Fedica auxiliary. What readers react to now and where interest is moving. Not follow-the-followers. Must not overwrite Creator DNA.",
    "Performance DNA: validated feature↔outcome from published posts + Analytics only. Not a winning-post wording store. Planner uses it to try or reduce patterns, never to copy sentences.",
    "Revenue DNA: durable revenue relationships. Never outranks authenticity, audience quality, trust. Empty revenue is UNKNOWN, not a success pattern.",
    "Current X Context: currentness around Creator and Audience on X now. Not a news feed. Not copied into a post prompt.",
    "Success / Planner Memory: abstract patterns validated by Publishing + Analytics. Generated drafts are hypotheses. Must be read on the next 3-day generate.",
  ].join("\n");
}

export function engineCatalogBlock(): string {
  return [
    "PLANNING: Planner reads all intelligence and sets long-term strategy + 3-day editorial plan. Seed Generation infers this window's candidates from the current situation, not a frozen topic list. Seed Interpretation separates fact / observation / experience / inference and prepares material — it does not close the post's thought. Thinking Rail and Reaction Mechanism are delivery priors after a thought exists, not templates that pick the thought. Topic Diversity explores adjacent and experimental areas; promote Emerging → Secondary → Core only from published outcomes. Editorial Strategy balances opinion / experience / observation / exploration so the window does not collapse to one type.",
    "WRITING: Thought first, style follows. Grok 4.6 Writer closes ONE central judgment on this Seed (would this creator hold it? is it grounded?) then writes it in his language. Everyday language, 말투, humor, Mechanism, and Rail follow only to deliver that thought. They must not choose it. Do not invent identity. Do not invent lived experience.",
    "QUALITY: Semantic Judge evaluates only — Core Thought preserved? Creator DNA drift? structural repeat? fact risk? AI convergence? Selective Regeneration reruns only the failed part with the cause. Weekly Count Gate must not silently succeed under quota. Structural Repetition Detection checks hook / discourse shape / ending / contrast inside the week. Fact/Evidence Boundary separates fact / inference / hypothesis / lived experience and forbids invented experience or facts.",
    "LEARNING: Closed loop — Publish → Analytics Import → Feature Extraction → Performance/Revenue Analysis → Learning → DNA/Memory Update → next 3-day Planner reads → new Planning. Analytics Import takes X Analytics first into a canonical model (Fedica is an adapter). Features are learned, not sentences. Manual published success is a stronger Creator Signal than an AI draft. One-off success stays hypothesis. Learning that the Planner does not read is not a closed loop.",
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
    "YOUR LAYER: Writing. Thought first, then style. You close this Seed's central thought, then deliver it as this creator would.",
    "You do not choose seeds, editorial balance, or 3-day strategy. You do not become the Planner. You DO close the thought for this Seed.",
    "Performance DNA is Planner-only. Do not chase winning feature combos. Do not copy successful wording. Revenue DNA does not pick this post.",
  ].join("\n");
}
