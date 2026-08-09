/**
 * Runtime Creator DNA for Planner — from existing Historical/Archive learning artifacts.
 * Does NOT invent new DNA. Does NOT mix REPLY/REPOST into Publishing voice.
 * Source of truth offline: creator_intelligence/Creator_DNA_Historical_v1.1.json (v1.3.1)
 */

export const CREATOR_DNA_RUNTIME_VERSION = "creator-dna-runtime-v1.3.1-snapshot";

/** Compact planner-facing block when DB creator_dna row is empty */
export function buildCreatorDnaPlannerBlock(): {
  block: string;
  source: "runtime_snapshot";
  version: string;
  confidence: "MEDIUM";
} {
  const lines: string[] = [
    `${CREATOR_DNA_RUNTIME_VERSION} (Archive/Historical learning — offline validated structure)`,
    "WHO: Korean Tesla multi-vehicle owner-creator; real-world FSD/product observation primary; plural interests (gaming, daily, LAFC) retained.",
    "WHY WRITE: inform/explain · share experience · light opinion · social reply",
    "PUBLISHING DNA: two-speed; media often; informational → polite intentional (존칭); light-opinion 음슴체 = RECENTLY_EMERGING preference (not long-archive dominant).",
    "REPLY DNA (SEPARATE): short, communicative; ㅋㅋ when thread is funny; relationship maintenance — NEVER average into Publishing voice.",
    "NOT THIS: stock daytrade primary · single global tone · REPOST text as writing voice · personal experience mandatory on every post",
    "REPOST: manual by Creator only; system may store/learn metadata; no auto-repost; REPOST text excluded from Writing DNA",
    "ARTICLES: quality-first; not default weekly pipeline",
    "PRIVACY SURFACE: 2026-03 account events = meaningful but CREATOR_MENTION_ONLY — never proactive default topic",
    "CONTENT STANCE: long-term Tesla investor / product progress; not short-term stock price chatter",
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
