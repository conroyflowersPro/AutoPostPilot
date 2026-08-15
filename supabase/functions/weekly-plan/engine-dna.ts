/**
 * Operator will lives here: Creator DNA + engine rules.
 * Not a generate-box slogan. Not something the operator retypes each week.
 * Optional topic field on /generate is a this-run overlay only.
 *
 * Keep WHO/WHY/NOT THIS in conceptual sync with lib/intelligence/creator-dna-runtime.ts
 * (Edge cannot import lib/).
 */
export const CREATOR_DNA_RUNTIME_VERSION = "creator-dna-runtime-v1.5-ca-korean";
export const PERFORMANCE_DNA_RUNTIME_VERSION = "performance-dna-runtime-v1.5-ca-mass";

type PerformanceWindow = {
  status?: string;
  validated_patterns?: number;
  window?: { from?: string; to?: string };
  payout?: { period?: string; amount_usd?: number; note?: string };
  patterns?: string[];
  forbidden?: string[];
  volume?: { originals?: number; replies?: number; note?: string };
};

function loadPerformanceWindow(): PerformanceWindow | null {
  try {
    const raw = Deno.readTextFileSync(new URL("./performance-window-candidates.json", import.meta.url));
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PerformanceWindow) : null;
  } catch {
    return null;
  }
}

export function performanceDnaBlock(): string {
  const w = loadPerformanceWindow();
  const lines = [
    `${PERFORMANCE_DNA_RUNTIME_VERSION}`,
    "STATUS: CANDIDATE window only; VALIDATED patterns = 0",
    "COLD START: missing validated patterns is expected. Still infer this week from Creator DNA + available USER_DIRECT. Do not wait for a thick evidence base. Do not refuse to emit quota or seeds.",
    "SUCCESS PRIORITY (strategy): reader participation first. Audience is readers — not followers and not a Tesla club. X-algorithm order: replies > bookmarks > quotes > reposts. Followers are a lagging result, not a strategy rank. Likes and impressions are mix/spacing only.",
    "WORDING: low entry barrier is wording AND the range of wording. Prefer words general readers and X catch, without distorting the claim. FORBIDDEN jargon in posts: 레이어, 레이어2, L2, 스택, 프로토콜, 메커니즘. Say 알림이 겹친다 / 화면이 가린다.",
    "TENSION: lived experience can show what is urgent. Showing how it resolved can make the post informative. Do not hard-assert the creator's opinion. Stop after the observation. Do not ask a question to make a reply slot.",
    "MIX: do not write only keep-worthy/archive posts. Diversity across the week is how bookmarks are sought.",
    "NEW READERS: one mass-public daily-life slot per day (daily AI, phone/alerts, road/parking without a brand, living costs, queues, weather/out). Personal-interest originals fill the rest. Tesla/Elon ticker/Robotaxi-news are not the default seed subject.",
    "PLACE: Creator lives in California (America/Los_Angeles). Write Korean. Daily situations are US/CA (street parking, freeway, drive-through, DMV/TSA lines, rent/tips/USD subscriptions, June gloom). FORBIDDEN as invented default: Korea-only civic life (이중주차, 관리사무소, 주민센터, 배민, 따릉이, 전세/청약).",
    "MASS CAP: at most one mass-public daily-life original per day. Personal-interest originals fill the rest. Keep EXPERIENCE when evidence exists. Do not invent lived episodes.",
    "OON FOR YOU: originals only; new situation inside 48 hours. The unfinished situation is the reply space. Do not end with a question.",
    "LENGTH: informative ~50-110 chars one sentence; casual ~40-80; compare/opinion ~60-130; experience ~70-160. Second sentence only to resolve tension.",
    "X WEIGHTS: they multiply predicted action probabilities for this Home-timeline viewer, not raw like/reply counts. Do not treat a report-vs-like weight ratio as 'N likes cancelled'. Do not put weight numbers into post prose.",
    "COPY-LINK/DM: those weights are P(this viewer copies or DMs after seeing the post in Home). Author copying an original and DMing an account does not add rank. Direct navigation (DM/groupchat link) has no ranking impact. Same recipient is irrelevant because that send is not in the ranking sum. Do not write for that action.",
    "SPACING (strategy only): first original 14:00 America/Los_Angeles. Planner even-spreads inside the For You window 14:00–22:00 PT. Same-author originals in one refresh are decayed; candidates drop after 48 hours. Do not stack originals. Do not write the last sentence for the algorithm.",
    "CANDIDATE: practical investigation + real media → bookmarks/views; honest observation → replies",
    "FORBIDDEN: impressions-only optimization · invent success from drafts · override Creator DNA authenticity · clone a winning post",
    "Likes = X algorithm layer for mix/spacing, not a sentence recipe",
  ];
  if (w?.window?.from && w.window.to) {
    lines.push(
      `OPERATOR WINDOW ${w.window.from}..${w.window.to} (${w.status || "CANDIDATE"}): transfer patterns only, never reuse a post body.`,
    );
    if (w.payout?.amount_usd != null) {
      lines.push(
        `Revenue candidate: ${w.payout.amount_usd} USD in ${w.payout.period || "window"}. ${w.payout.note || ""}`.trim(),
      );
    }
    if (w.volume?.note) lines.push(`Volume: originals ${w.volume.originals ?? "?"} / replies ${w.volume.replies ?? "?"}. ${w.volume.note}`);
    for (const p of (w.patterns || []).slice(0, 6)) lines.push(`CANDIDATE PATTERN: ${p}`);
    for (const f of (w.forbidden || []).slice(0, 6)) lines.push(`WINDOW FORBIDDEN: ${f}`);
  }
  return lines.join("\n");
}

export function creatorDnaBlock(): string {
  return [
    `${CREATOR_DNA_RUNTIME_VERSION} (Archive/Historical learning — offline validated structure)`,
    "WHO: Korean-language creator living in California; Tesla multi-vehicle owner. Personal-interest originals (FSD/product, gaming, LAFC) are the center of the 3-day plan. Mass public daily life is at most one slot per day. Daily life is US/CA, not Korea civic housing.",
    "WHY WRITE: new readers first · inform/explain · share experience (capped) · light opinion · social reply",
    "PUBLISHING DNA: two-speed; media often; informational → polite intentional (존칭); light-opinion 음슴체 = RECENTLY_EMERGING preference (not long-archive dominant).",
    "REPLY DNA (SEPARATE): short, communicative; ㅋㅋ when thread is funny; relationship maintenance — NEVER average into Publishing voice.",
    "NOT THIS: stock daytrade primary · single global tone · REPOST text as writing voice · personal experience mandatory on every post",
    "REPOST: manual by Creator only; system may store/learn metadata; no auto-repost; REPOST text excluded from Writing DNA",
    "ARTICLES: quality-first; not default weekly pipeline",
    "PRIVACY SURFACE: 2026-03 account events = meaningful but CREATOR_MENTION_ONLY — never proactive default topic",
    "CONTENT STANCE: personal Tesla/FSD/product observation is the main mix. Do not default to Elon/ticker/Robotaxi news. Not short-term stock price chatter",
    "SAFETY: never invent firsthand driving tests; Level1 fact / Level2 opinion only without evidence; authenticity ≥80",
  ].join("\n");
}

/** Engine rules that already encode the operator's will. */
export function engineRulesAsWill(): string {
  return [
    "3-day generate infers seeds from learned data. Never emit DIMENSION_REGISTRY labels as seed bodies.",
    "Infer the 3-day quota from Creator DNA + cadence + Performance DNA + X anti-dump, then fill that quota. Prefer 4/day; 5 fills the 14:00–22:00 PT window. Not a frozen 5. Quota holes must be filled, with observational humor if needed.",
    "Personal-interest originals are the main mix. At most one mass-public daily-life original per day.",
    "Language is Korean. Setting is California/US. Do not invent Korea-only situations the creator does not live.",
    "USER_DIRECT trains 말투. AP_PIPELINE trains performance only.",
    "Do not invent lived experience or opinions. Authenticity first. Place and experience bounds live in Creator DNA + these engine rules — the writer must consume them.",
    "Question closer only from USER_DIRECT form, never because X rewards participation.",
    "After review + original media, AI publishes. Spacing is For You optimized: first original 14:00 America/Los_Angeles; planner even-spreads 14:00–22:00 PT so same-author originals are not stacked in one refresh. Candidates drop after about 48 hours.",
    "X ranking weights scale predicted viewer actions on Home-served posts, not counted events and not author DMs of own links. They do not pick the last sentence.",
    "Do not wait for a typed restatement of will. DNA + these rules are the will.",
  ].join("\n");
}
