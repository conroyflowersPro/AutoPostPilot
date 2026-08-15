/**
 * Runtime Performance DNA for Planner — from INITIAL BASELINE v1 only.
 * Baseline status: EXISTS / PREVIOUSLY RUN (STOP_FOR_HUMAN_REVIEW).
 * All patterns remain CANDIDATE — none auto-promoted to VALIDATED.
 * Does NOT re-run baseline. Does NOT use 12-row organic sample as full DNA.
 * Does NOT treat impressions-only as success. missing ≠ 0.
 */

export const PERFORMANCE_DNA_RUNTIME_VERSION =
  "performance-dna-runtime-baseline-v1-candidates";

export function buildPerformanceDnaPlannerBlock(): {
  block: string;
  source: "baseline_candidates";
  version: string;
  confidence: "LOW_MEDIUM_CANDIDATE";
  validated_count: 0;
} {
  const lines: string[] = [
    `${PERFORMANCE_DNA_RUNTIME_VERSION}`,
    "STATUS: INITIAL BASELINE v1 previously run — candidates only; VALIDATED patterns = 0",
    "EVIDENCE BASIS: Phase1A public_metrics samples + observed published posts (not full 3009 correlation job)",
    "METRIC POLICY: public_metrics usable as weak signal; non_public/organic often PARTIAL — missing ≠ 0",
    "SUCCESS PRIORITY (strategy): reader participation first. X-algorithm order: replies > bookmarks > quotes > reposts. Followers are a lagging result, not a strategy rank. Likes and impressions are mix/spacing only.",
    "X WEIGHTS: they multiply predicted action probabilities for this viewer, not raw like/reply counts. Do not treat a report-vs-like weight ratio as 'N likes cancelled'. Do not put weight numbers into post prose.",
    "SPACING (strategy only): same-author originals in a row get decayed; For You candidates drop after 48 hours. Do not stack originals. Do not write the last sentence for the algorithm.",
    "CANDIDATE associations (do NOT treat as proven rules):",
    "1) Practical investigation + on-device video → higher bookmarks/views (CANDIDATE)",
    "2) Pointing to ultra-practical community how-to → higher likes/RTs (CANDIDATE)",
    "3) Long personal FSD experience essay → higher engagement when authentic (CANDIDATE)",
    "4) Milestone personal story + gratitude → higher replies (CANDIDATE)",
    "5) Honest incident report → higher replies (CANDIDATE)",
    "6) Ultra-short reply-only posts → weak as reach drivers (may still build relationships)",
    "OPERATOR WINDOW 2026-08-01..2026-08-14 (CANDIDATE): lived FSD+clip and in-car/in-shop friction transferred as patterns only — never clone a post.",
    "Revenue candidate 42.29 USD in 2026-08-01/15. Do not tweet the number. Do not raise daily quota from this one window.",
    "FORBIDDEN: impressions-only optimization · invent success from drafts · promote candidate→validated here · clone a winning post",
    "Planner use: soft preference only; never override Creator DNA authenticity or Creator Intent",
  ];

  return {
    block: lines.join("\n"),
    source: "baseline_candidates",
    version: PERFORMANCE_DNA_RUNTIME_VERSION,
    confidence: "LOW_MEDIUM_CANDIDATE",
    validated_count: 0,
  };
}

export function isEmptyPerformanceBlock(block: string): boolean {
  const s = (block || "").toLowerCase();
  return (
    !block ||
    s.includes("no performance dna yet") ||
    s.includes("use seeded patterns") ||
    s.startsWith("(no ")
  );
}
