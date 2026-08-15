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
  "Data/Evidence → 4 DNA → Planner → Dynamic Seeds → Thinking → Core Thought → Reaction/Style Strategy → Writer → Semantic Judge → Selective Regeneration → Publish → Analytics → Validated Learning → Planner Memory";

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
    "DNA LAYERS (read together; missing evidence is unknown, not zero):",
    "Creator DNA: preserve how he thinks, expresses, sentence rhythm, humor, observation, opinion, and experience use. Not a topic menu. Not a template.",
    "Audience DNA: Fedica-centered interpretation of follower interests, sentiment, brand affinity, topic movement, demographics, posting time. Interpret. Do not invent.",
    "Performance DNA: X Analytics — which published posts actually moved followers, profile visits, bookmarks, discussion. Planner strategy input. Never a sentence recipe. Never overwrites Creator DNA.",
    "Revenue DNA: profitability by topic, content type, time, media. Never outranks authenticity and long-term trust. Never dominates Planner.",
    "Current X Context: what is actually happening on X now (news, official accounts, conversation flow). Context, not a list of topics to copy.",
    "Success / Planner Memory: only abstract patterns validated by published outcomes. Not every post. Not unpublished AI wording.",
  ].join("\n");
}

export function engineCatalogBlock(): string {
  return [
    "PLANNING: Planner reads all intelligence and sets long-term strategy + weekly editorial plan. Seed Generation infers this week's candidates from the current situation, not a frozen topic list. Seed Interpretation separates fact / observation / experience / inference and names the material meaning. Thinking/Rail explores paths without jumping to sentences. Core Thought picks ONE central judgment — the real core of the post. Audience Reaction Intelligence estimates likely reader psychological reaction. Reaction Mechanism selects Surprise / Empathy / Evidence-Grounded Judgment / Life Pattern Exposure / NONE. Topic Diversity explores adjacent and experimental areas; promote Emerging → Secondary → Core only from published outcomes. Weekly Editorial Strategy balances opinion / experience / observation / exploration so the week does not collapse to one type.",
    "WRITING: Writer expresses the already-decided Core Thought in his actual language — implements thought, does not invent it. Everyday Language keeps depth and lowers the entry barrier. Creator Style reflects DNA rhythm/expression without a frozen persona or template. Natural Humor only when the situation fits. Surface/Discourse varies so the same observation→twist→reinterpret AI arc does not repeat.",
    "QUALITY: Semantic Judge evaluates only — Core Thought preserved? Creator DNA drift? structural repeat? fact risk? AI convergence? Selective Regeneration reruns only the failed part with the cause. Weekly Count Gate must not silently succeed under quota. Structural Repetition Detection checks hook / discourse shape / ending / contrast inside the week. Fact/Evidence Boundary separates fact / inference / hypothesis / lived experience and forbids invented experience or facts.",
    "LEARNING: Analytics Import normalizes X Analytics CSV and Fedica CSV/PDF. Content Feature Extraction reads Topic, Subtopic, Hook Style, Writing Style, Sentence Rhythm, Media, Opinion Strength, Technical Depth, Personal Experience from published posts. Performance Analysis links feature combos to follower / profile / bookmark / discussion outcomes. Learning Engine updates Intelligence and Planner Memory on about a 14-day cycle from published evidence. Manual Post Learning: a successful handmade post is a higher-value signal than a successful AI draft. Revenue Analysis finds revenue patterns without invading Planner's top purpose.",
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
    "YOUR LAYER: Writing. Pipeline position: after Core Thought and Reaction/Style Strategy.",
    "You do not choose seeds, editorial balance, or Core Thought. You do not become the Planner.",
    "Performance DNA is Planner-only. Do not chase winning feature combos. Do not copy successful wording. Revenue DNA does not pick this post.",
  ].join("\n");
}
