/**
 * Runtime Creator DNA for Planner — from existing Historical/Archive learning artifacts.
 * Weekly-plan generate path uses supabase/functions/weekly-plan/engine-dna.ts (Edge cannot import lib/).
 * Keep WHO/WHY/NOT THIS in sync with that file. That block is the operator's will.
 * Does NOT invent new DNA. Does NOT mix REPLY/REPOST into Publishing voice.
 * Source of truth offline: creator_intelligence/Creator_DNA_Historical_v1.1.json (v1.3.1)
 */

export const CREATOR_DNA_RUNTIME_VERSION = "creator-dna-runtime-v1.6-see-think-speak";

/** Compact planner-facing block when DB creator_dna row is empty */
export function buildCreatorDnaPlannerBlock(): {
  block: string;
  source: "runtime_snapshot";
  version: string;
  confidence: "MEDIUM";
} {
  const lines: string[] = [
    `${CREATOR_DNA_RUNTIME_VERSION}`,
    "PURPOSE: Preserve how this person sees, thinks, and expresses. Not a content menu. Not a new personality. Over time readers should still meet the same one person's thought and voice.",
    "HOLDS: sentence rhythm and structure, 말투, humor, how he gives an opinion, storytelling, what he keeps noticing, how he observes, how he brings in lived experience.",
    "NOT A TEMPLATE: Creator DNA is not a content template and not a 문체 copier. Forbidden freezes: always write short; always add a twist; this topic uses this 말투.",
    "USE (planner + writer, every new situation): What would he notice first? How far to assert, and where to leave the reader's judgment? Would he use humor here? How would he interpret this experience in his own language?",
    "CLOCK: Change slowly. Update only from USER_DIRECT originals, his edits, repeated judgment patterns, and validated performance. AP_PIPELINE drafts must not rewrite Creator DNA.",
    "JOBS: identity preservation · thought direction · expression adjustment · anti-uniformity · long-term consistency.",
    "WHO: Korean-language creator living in California; Tesla multi-vehicle owner. Personal-interest originals (FSD/product, gaming, LAFC) are the center of the 3-day plan. Mass public daily life is at most one slot per day. Daily life is US/CA, not Korea civic housing.",
    "WHY WRITE: new readers first · inform/explain · share experience (capped) · light opinion · social reply",
    "PUBLISHING DNA: two-speed mix. 해요/존칭 and 음슴 are both publishing surfaces. The planner chooses per slot. No frozen 해요/음슴 mix ratio. Editorial mode is not a 말투 table. Across the 3-day set, endings must not collapse to one register.",
    "REPLY DNA (SEPARATE): short, communicative; ㅋㅋ when thread is funny; relationship maintenance — NEVER average into Publishing voice.",
    "NOT THIS: stock daytrade primary · single global tone · REPOST text as writing voice · personal experience mandatory on every post · content template · 문체 copier",
    "REPOST: manual by Creator only; system may store/learn metadata; no auto-repost; REPOST text excluded from Writing DNA",
    "ARTICLES: quality-first; not default weekly pipeline",
    "PRIVACY SURFACE: 2026-03 account events = meaningful but CREATOR_MENTION_ONLY — never proactive default topic",
    "CONTENT STANCE: personal Tesla/FSD/product observation is the main mix. Do not default to Elon/ticker/Robotaxi news. Not short-term stock price chatter",
    "SAFETY: never invent firsthand driving tests; Level1 fact / Level2 opinion only without evidence; authenticity ≥80",
  ];

  return {
    block: lines.join("\n"),
    source: "runtime_snapshot",
    version: CREATOR_DNA_RUNTIME_VERSION,
    confidence: "MEDIUM",
  };
}

export function isEmptyDnaBlock(block: string): boolean {
  const s = (block || "").toLowerCase();
  return (
    !block ||
    s.includes("use system creator dna") ||
    s.includes("(use system") ||
    s.startsWith("(no ")
  );
}
