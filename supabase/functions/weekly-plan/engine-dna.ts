/**
 * Operator will lives here: Creator DNA + engine rules.
 * Not a generate-box slogan. Not something the operator retypes each week.
 * Optional topic field on /generate is a this-run overlay only.
 *
 * Keep WHO/WHY/NOT THIS in conceptual sync with lib/intelligence/creator-dna-runtime.ts
 * (Edge cannot import lib/).
 */
export const CREATOR_DNA_RUNTIME_VERSION = "creator-dna-runtime-v1.3.1-snapshot";
export const PERFORMANCE_DNA_RUNTIME_VERSION = "performance-dna-runtime-v1.2-participation-first";

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
    "SUCCESS PRIORITY (strategy): reader participation first. X-algorithm order: replies > bookmarks > quotes > reposts. Followers are a lagging result, not a strategy rank. Likes and impressions are mix/spacing only.",
    "X WEIGHTS: they multiply predicted action probabilities for this viewer, not raw like/reply counts. Do not treat a report-vs-like weight ratio as 'N likes cancelled'. Do not put weight numbers into post prose.",
    "SPACING (strategy only): same-author originals in a row get decayed; For You candidates drop after 48 hours. Do not stack originals. Do not write the last sentence for the algorithm.",
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
  ].join("\n");
}

/** Engine rules that already encode the operator's will. */
export function engineRulesAsWill(): string {
  return [
    "7-day generate infers seeds from learned data. Never emit DIMENSION_REGISTRY labels as seed bodies.",
    "Infer the week's quota from Creator DNA + cadence + Performance DNA + X anti-dump, then fill that quota.",
    "USER_DIRECT trains 말투. AP_PIPELINE trains performance only.",
    "Do not invent lived experience or opinions. Authenticity first.",
    "Question closer only from USER_DIRECT form, never because X rewards participation.",
    "After review + original media, AI publishes. Spacing from X-algorithm evidence: do not stack same-day originals; For You freshness is about 48 hours.",
    "X ranking weights scale predicted viewer actions, not counted events. They do not pick the last sentence.",
    "Do not wait for a typed restatement of will. DNA + these rules are the will.",
  ].join("\n");
}
