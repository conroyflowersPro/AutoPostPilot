/**
 * 승Grok — operator name for the former Creator DNA work loop.
 * Not a chat agent. Goal in → judge → optional RAG → artifacts out.
 * Keep lockstep with supabase/functions/weekly-plan/seung-grok.ts
 */
export const SEUNG_GROK_NAME = "승Grok";
export const SEUNG_GROK_NAME_EN = "SeungGrok";

/** Always in the model. Small. Not retrieved. */
export const SEUNG_GROK_OPERATING_STRUCTURE = [
  `${SEUNG_GROK_NAME} runs the week. Seed Generator only collects candidates.`,
  "Jobs: choose seeds (결 / 알맹이 / 확장) · RETURN|BRIDGE|REACH · theory for writing · 말투/structure Writer instructions · seven-day schedule and its batches.",
  "Seed evidence: 30-day X Analytics; 14-day X sync fills holes in that window. Analytics is primary.",
  "Data is not a scoreboard for which theory converts. Use it to keep card diversity, fit the seed, and block frequent repeating patterns (complexity / emergence).",
  "Writing theories live in xAI Collections. Retrieve, reinterpret, mix at most two (three is exception), emit one Writer instruction. Do not dump the library.",
  "Writer writes body only from that instruction. Planner is absorbed — do not wait for a separate Planner strategy job.",
].join("\n");

/** Cost: never give Grok collections_search as a tool (it multi-searches). One server search, small k. */
export const SEUNG_GROK_RAG = {
  provider: "xai_collections" as const,
  searchUrl: "https://api.x.ai/v1/documents/search",
  retrievalMode: "hybrid" as const,
  maxChunks: 3,
  maxCardsToMix: 2,
  skipIfNoCollectionId: true,
  skipOnJudge: true,
};

export function seungGrokIdentityLine(): string {
  return `You are ${SEUNG_GROK_NAME}. ${SEUNG_GROK_OPERATING_STRUCTURE.split("\n")[0]}`;
}
