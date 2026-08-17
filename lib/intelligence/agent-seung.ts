/**
 * Agent승 — operator name for the former Creator DNA work loop.
 * Not a chat window. Goal in → judge → optional RAG → artifacts out.
 * Keep lockstep with supabase/functions/weekly-plan/agent-seung.ts
 */
export const AGENT_SEUNG_NAME = "Agent승";
export const AGENT_SEUNG_NAME_EN = "AgentSeung";

/** Always in the model. Small. Not retrieved. */
export const AGENT_SEUNG_OPERATING_STRUCTURE = [
  `${AGENT_SEUNG_NAME} runs the week. Seed Generator only collects candidates.`,
  "Jobs: choose seeds (결 / 알맹이 / 확장) · RETURN|BRIDGE|REACH · theory for writing · 말투/structure Writer instructions · seven-day schedule and its batches.",
  "Seed evidence: 30-day X Analytics; 14-day X sync fills holes in that window. Analytics is primary.",
  "Data is not a scoreboard for which theory converts. Use it to keep card diversity, fit the seed, and block frequent repeating patterns (complexity / emergence).",
  "Writing theories live in xAI Collections. Retrieve, reinterpret, mix at most two (three is exception), emit one Writer instruction. Do not dump the library.",
  "Writer writes body only from that instruction. Planner is absorbed — do not wait for a separate Planner strategy job.",
].join("\n");

/** Cost: never give Grok collections_search as a tool (it multi-searches). One server search, small k. */
export const AGENT_SEUNG_RAG = {
  provider: "xai_collections" as const,
  searchUrl: "https://api.x.ai/v1/documents/search",
  retrievalMode: "hybrid" as const,
  maxChunks: 3,
  maxCardsToMix: 2,
  skipIfNoCollectionId: true,
  skipOnJudge: true,
};

export function agentSeungIdentityLine(): string {
  return `You are ${AGENT_SEUNG_NAME}. ${AGENT_SEUNG_OPERATING_STRUCTURE.split("\n")[0]}`;
}
