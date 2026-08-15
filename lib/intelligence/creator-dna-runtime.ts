/**
 * Runtime Creator DNA for Planner — from existing Historical/Archive learning artifacts.
 * Weekly-plan generate path uses supabase/functions/weekly-plan/engine-dna.ts (Edge cannot import lib/).
 * Keep WHO/WHY/NOT THIS in sync with that file. That block is the operator's will.
 * Does NOT invent new DNA. Does NOT mix REPLY/REPOST into Publishing voice.
 * Source of truth offline: creator_intelligence/Creator_DNA_Historical_v1.1.json (v1.3.1)
 */

export const CREATOR_DNA_RUNTIME_VERSION = "creator-dna-runtime-v1.5-ca-korean";

/** Compact planner-facing block when DB creator_dna row is empty */
export function buildCreatorDnaPlannerBlock(): {
  block: string;
  source: "runtime_snapshot";
  version: string;
  confidence: "MEDIUM";
} {
  const lines: string[] = [
    `${CREATOR_DNA_RUNTIME_VERSION} (Archive/Historical learning — offline validated structure)`,
    "WHO: Korean-language creator living in California; Tesla multi-vehicle owner. Lived FSD/product observation is ONE daily personal slot, not the week's center. Plural interests (gaming, daily, LAFC) retained inside that cap. Daily life is US/CA, not Korea civic housing.",
    "WHY WRITE: new readers first · inform/explain · share experience (capped) · light opinion · social reply",
    "PUBLISHING DNA: two-speed; media often; informational → polite intentional (존칭); light-opinion 음슴체 = RECENTLY_EMERGING preference (not long-archive dominant).",
    "REPLY DNA (SEPARATE): short, communicative; ㅋㅋ when thread is funny; relationship maintenance — NEVER average into Publishing voice.",
    "NOT THIS: stock daytrade primary · single global tone · REPOST text as writing voice · personal experience mandatory on every post",
    "REPOST: manual by Creator only; system may store/learn metadata; no auto-repost; REPOST text excluded from Writing DNA",
    "ARTICLES: quality-first; not default weekly pipeline",
    "PRIVACY SURFACE: 2026-03 account events = meaningful but CREATOR_MENTION_ONLY — never proactive default topic",
    "CONTENT STANCE: do not default to Elon/Tesla ticker/Robotaxi news. Personal Tesla lived stays in the 1/day cap. Not short-term stock price chatter",
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
