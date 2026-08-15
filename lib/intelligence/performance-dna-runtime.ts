/**
 * Runtime Performance DNA for Planner — from INITIAL BASELINE v1 only.
 * Baseline status: EXISTS / PREVIOUSLY RUN (STOP_FOR_HUMAN_REVIEW).
 * All patterns remain CANDIDATE — none auto-promoted to VALIDATED.
 * Does NOT re-run baseline. Does NOT use 12-row organic sample as full DNA.
 * Does NOT treat impressions-only as success. missing ≠ 0.
 */

export const PERFORMANCE_DNA_RUNTIME_VERSION =
  "performance-dna-runtime-v1.5-ca-mass";

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
    "WORDING: low entry barrier is wording AND the range of wording. Prefer words general readers and X catch, without distorting the claim. FORBIDDEN jargon in posts: 레이어, 레이어2, L2, 스택, 프로토콜, 메커니즘. Say 알림이 겹친다 / 화면이 가린다.",
    "TENSION: lived experience can show what is urgent. Showing how it resolved can make the post informative. Do not hard-assert the creator's opinion. Stop after the observation. Do not ask a question to make a reply slot.",
    "MIX: do not write only keep-worthy/archive posts. Diversity across the week is how bookmarks are sought.",
    "NEW READERS: one mass-public daily-life slot per day (daily AI, phone/alerts, road/parking without a brand, living costs, queues, weather/out). Personal-interest originals fill the rest. Tesla/Elon ticker/Robotaxi-news are not the default seed subject.",
    "PLACE: Creator lives in California (America/Los_Angeles). Write Korean. Daily situations are US/CA (street parking, freeway, drive-through, DMV/TSA lines, rent/tips/USD subscriptions, June gloom). FORBIDDEN as invented default: Korea-only civic life (이중주차, 관리사무소, 주민센터, 배민, 따릉이, 전세/청약).",
    "MASS CAP: at most one mass-public daily-life original per day. Personal-interest originals fill the rest. Keep EXPERIENCE when evidence exists. Do not invent lived episodes.",
    "OON FOR YOU: originals only; new situation inside 48 hours. The unfinished situation is the reply space. Do not end with a question.",
    "LENGTH: not a mode quota. Follow the selected reader-entry move and thought order until the observation is complete. Mix lengths across the 3-day set. Do not collapse to one sentence because a slot is informational. Do not pad. No thesis tail.",
    "X WEIGHTS: they multiply predicted action probabilities for this Home-timeline viewer, not raw like/reply counts. Do not treat a report-vs-like weight ratio as 'N likes cancelled'. Do not put weight numbers into post prose.",
    "COPY-LINK/DM: those weights are P(this viewer copies or DMs after seeing the post in Home). Author copying an original and DMing an account does not add rank. Direct navigation (DM/groupchat link) has no ranking impact. Same recipient is irrelevant because that send is not in the ranking sum. Do not write for that action.",
    "SPACING (strategy only): first original 14:00 America/Los_Angeles. Planner even-spreads inside the For You window 14:00–22:00 PT. Same-author originals in one refresh are decayed; candidates drop after 48 hours. Do not stack originals. Do not write the last sentence for the algorithm.",
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
