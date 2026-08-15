/**
 * Runtime Performance DNA for Planner — from INITIAL BASELINE v1 only.
 * Baseline status: EXISTS / PREVIOUSLY RUN (STOP_FOR_HUMAN_REVIEW).
 * All patterns remain CANDIDATE — none auto-promoted to VALIDATED.
 * Does NOT re-run baseline. Does NOT use 12-row organic sample as full DNA.
 * Does NOT treat impressions-only as success. missing ≠ 0.
 */

export const PERFORMANCE_DNA_RUNTIME_VERSION =
  "performance-dna-runtime-v1.6-x-window";

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
    "INTERPRET: Followers Gained → Profile Visits → Revenue → Bookmarks → Replies → Reposts → Quotes → Likes → Impressions. Not a wording store. Must not overwrite Creator DNA.",
    "EVIDENCE BASIS: Phase1A public_metrics samples + observed published posts (not full 3009 correlation job)",
    "METRIC POLICY: public_metrics usable as weak signal; non_public/organic often PARTIAL — missing ≠ 0",
    "SUCCESS PRIORITY (strategy): reader participation first. Audience is readers — not followers and not a Tesla club. X-algorithm order: replies > bookmarks > quotes > reposts. Followers are a lagging result, not a strategy rank. Likes and impressions are mix/spacing only.",
    "WORDING: low entry barrier is wording AND the range of wording. Prefer words general readers and X catch, without distorting the claim. FORBIDDEN jargon in posts: 레이어, 레이어2, L2, 스택, 프로토콜, 메커니즘. Everyday substitutions belong in the finished post, never as this week's seed concrete_subject.",
    "TENSION: lived experience can show what is urgent. Showing how it resolved can make the post informative. Close the thought this seed earns. Do not ask a question to make a reply slot.",
    "MIX: do not write only keep-worthy/archive posts. Diversity across the week is how bookmarks are sought.",
    "NEW READERS: one mass-public daily-life slot per day. Infer the situation from place bounds. Personal-interest originals fill the rest. Tesla/Elon ticker/Robotaxi-news are not the default seed subject.",
    "PLACE: Creator lives in California (America/Los_Angeles). Write Korean. Daily situations are US/CA life he actually lives — infer them, do not copy a situation menu from this prompt. Do not invent Korea-only civic or housing life the creator does not live.",
    "MASS CAP: at most one mass-public daily-life original per day. Personal-interest originals fill the rest. Keep EXPERIENCE when evidence exists. Do not invent lived episodes.",
    "OON FOR YOU: originals only; new situation inside 48 hours. The unfinished situation can be the reply space. Do not install an engagement-bait question.",
    "LENGTH: not a mode quota. Length follows the closed thought until it is complete. Mechanism and Rail are optional delivery. Mix lengths across the 3-day set. Do not collapse to one sentence because a slot is informational. Do not pad. No thesis tail.",
    "X WEIGHTS: they multiply predicted action probabilities for this Home-timeline viewer, not raw like/reply counts. Do not treat a report-vs-like weight ratio as 'N likes cancelled'. Do not put weight numbers into post prose.",
    "COPY-LINK/DM: those weights are P(this viewer copies or DMs after seeing the post in Home). Author copying an original and DMing an account does not add rank. Direct navigation (DM/groupchat link) has no ranking impact. Same recipient is irrelevant because that send is not in the ranking sum. Do not write for that action.",
    "SPACING (strategy only): first original 14:00 America/Los_Angeles. Planner even-spreads inside the For You window 14:00–22:00 PT. Same-author originals in one refresh are decayed; candidates drop after 48 hours. Do not stack originals. Do not write the last sentence for the algorithm.",
    "CANDIDATE associations (do NOT treat as proven rules; VALIDATED = 0):",
    "1) Lived Korea/US comparison from actual travel → this window strongest original follower conversion. One post = hypothesis. Never clone.",
    "2) Lived in-car FSD incident + original clip → follows + profile + bookmarks + replies together. Cite the episode.",
    "3) In-car product friction traced → high bookmarks and profile, almost no follows. Save ≠ follow this window.",
    "4) Pointing to a community how-to → profile/bookmarks/replies, 0 follows. Not a seed clone.",
    "5) Honest late-night own-fault scene → profile curiosity without bookmarks or follows.",
    "6) Ultra-short originals: 32 posts, 0 follows this window. Replies keep relationships (321 posts, 0 bookmarks) and are not original seeds.",
    "OPERATOR WINDOW 2026-08-01..2026-08-15 (CANDIDATE): X Analytics content + overview + video export. Lived patterns only — never clone a post.",
    "LAYER SPLIT: overview follows 72 vs content follows 26; overview impressions 79900 vs content 287597. missing ≠ 0. Do not average.",
    "Revenue START 42.29 USD 2026-08-01..2026-08-15 (X Payouts). Next payout 2026-08-28. Account-level, not per-post. Video Estimated Revenue 0 is not this payout. Clips not monetized. Library IDs did not join content posts. Do not tweet the number. Do not raise daily quota from this one window.",
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
