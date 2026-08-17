/**
 * Edge lockstep of lib/intelligence/agent-seung.ts (Edge cannot import lib/).
 */
export const AGENT_SEUNG_NAME = "Agent승";
export const AGENT_SEUNG_NAME_EN = "AgentSeung";

export const AGENT_SEUNG_OPERATING_STRUCTURE = [
  `${AGENT_SEUNG_NAME} runs the week. Seed Generator only collects candidates.`,
  "Jobs: choose seeds (결 / 알맹이 / 확장) · RETURN|BRIDGE|REACH · theory for writing · 말투/structure Writer instructions · seven-day schedule and its batches.",
  "Seed evidence: 30-day X Analytics; 14-day X sync fills holes in that window. Analytics is primary.",
  "Data is not a scoreboard for which theory converts. Use it to keep card diversity, fit the seed, and block frequent repeating patterns (complexity / emergence).",
  "Writing theories live in xAI Collections. Retrieve, reinterpret, mix at most two (three is exception), emit one Writer instruction. Do not dump the library.",
  "Writer writes body only from that instruction. Planner is absorbed — do not wait for a separate Planner strategy job.",
].join("\n");

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

export type TheoryChunk = {
  chunk_id: string;
  chunk_content: string;
  score: number;
  file_id?: string;
};

/** One hybrid search. No Grok tool loop. No-op without XAI_THEORY_COLLECTION_ID. */
export async function searchWritingTheories(
  query: string,
  opts?: { xaiKey?: string; collectionId?: string; limit?: number },
): Promise<TheoryChunk[]> {
  const key = String(opts?.xaiKey || "").trim();
  const collectionId = String(
    opts?.collectionId ||
      (typeof Deno !== "undefined" ? Deno.env.get("XAI_THEORY_COLLECTION_ID") : "") ||
      "",
  ).trim();
  if (!key || !collectionId || !String(query || "").trim()) return [];
  const limit = Math.min(AGENT_SEUNG_RAG.maxChunks, Math.max(1, opts?.limit || AGENT_SEUNG_RAG.maxChunks));
  const res = await fetch(AGENT_SEUNG_RAG.searchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: String(query).slice(0, 500),
      source: { collection_ids: [collectionId] },
      retrieval_mode: { type: AGENT_SEUNG_RAG.retrievalMode },
      limit,
    }),
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  const matches = Array.isArray(body?.matches) ? body.matches : [];
  return matches.slice(0, limit).map((m: any) => ({
    chunk_id: String(m.chunk_id || ""),
    chunk_content: String(m.chunk_content || "").slice(0, 1200),
    score: Number(m.score) || 0,
    file_id: m.file_id ? String(m.file_id) : undefined,
  }));
}
