/**
 * Quota-hole fill starts adjacent to existing interests, not random new topics.
 * Promotion path: Exploration → Emerging → Secondary → Core, by published outcomes.
 * Max 3 mass-fill posts per day. Mix is not a frozen ratio.
 */
import { isPersonalInterestSubject, MASS_SECTORS, massSectorFromText } from "./seed-scope.ts";

export const ADJACENT_PER_DAY_MAX = 3;
export const ADJACENT_SOURCE_TYPE = "ADJACENT_EXPANSION";
export const ADJACENT_CLUSTERS = MASS_SECTORS;
/** Promote only from published outcomes, not from a random topic dump. */
export const INTEREST_PROMOTION_PATH = [
  "exploration",
  "emerging",
  "secondary",
  "core",
] as const;

const MASS_RE =
  /번역|초안|요약|음성|알림|휴대폰|화면|주차|와이퍼|구독|수수료|대기|줄|날씨|외출|길찾기|요금|업데이트 미루/i;

export function isCoreInterestSubject(text: string, cluster?: string): boolean {
  return isPersonalInterestSubject(text, cluster);
}

export function adjacentClusterFromText(text: string): (typeof ADJACENT_CLUSTERS)[number] {
  return massSectorFromText(text);
}

export function isAdjacentExpansionSeed(seed: {
  source_type?: string;
  source_kind?: string;
  cluster?: string;
  concrete_subject?: string;
}): boolean {
  const st = String(seed.source_type || seed.source_kind || "").toUpperCase();
  if (st.includes("ADJACENT")) return true;
  const c = String(seed.cluster || "").toUpperCase();
  if ((ADJACENT_CLUSTERS as readonly string[]).includes(c)) return true;
  const sub = String(seed.concrete_subject || "");
  return MASS_RE.test(sub) && !isCoreInterestSubject(sub, seed.cluster);
}

export function adjacentDomainGate(text: string): boolean {
  const t = String(text || "");
  if (t.length < 12) return false;
  if (isCoreInterestSubject(t)) return false;
  return MASS_RE.test(t);
}

export function adjacentRingPromptLines(): string[] {
  return [
    "QUOTA HOLE FILL — mass public sectors for NEW readers. Not Tesla/Elon as the subject.",
    "Sectors are schema only: DAILY_AI, PHONE_NOTIFY, ROAD_PARK, LIVING_COST, QUEUE_WAIT, WEATHER_OUT. Infer a NEW mass-public situation in those bounds. Do not copy a situation menu from this prompt. California life, not invented Korea civic housing.",
    "cluster MUST be one of DAILY_AI, PHONE_NOTIFY, ROAD_PARK, LIVING_COST, QUEUE_WAIT, WEATHER_OUT.",
    "INFORMATIVE / OPINION / COMPARE / CASUAL only. Never EXPERIENCE. Never first-person Tesla driving. Never Elon/Musk.",
    "Do not clone viral wording. Distinct directions only.",
  ];
}

export function countAdjacentOnDay(posts: Array<{ source_type?: string; cluster?: string; concrete_subject?: string }>): number {
  return (posts || []).filter((p) => isAdjacentExpansionSeed(p)).length;
}

export function pickDayForAdjacent(
  days: Array<{ posts: any[] }>,
  postsPerDay: number,
  maxAdjacent = ADJACENT_PER_DAY_MAX,
): number {
  let best = -1;
  let bestScore = 1e9;
  for (let d = 0; d < days.length; d++) {
    const posts = days[d].posts || [];
    if (posts.length >= postsPerDay) continue;
    if (countAdjacentOnDay(posts) >= maxAdjacent) continue;
    const score = countAdjacentOnDay(posts) * 10 + posts.length;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function enforceAdjacentPerDay<T extends { source_type?: string; cluster?: string; concrete_subject?: string }>(
  days: Array<{ posts: T[] }>,
  postsPerDay: number,
  maxAdjacent = ADJACENT_PER_DAY_MAX,
): void {
  for (let d = 0; d < days.length; d++) {
    for (;;) {
      const posts = days[d].posts || [];
      const adjIdx = posts
        .map((p, i) => (isAdjacentExpansionSeed(p) ? i : -1))
        .filter((i) => i >= 0);
      if (adjIdx.length <= maxAdjacent) break;
      let dest = -1;
      for (let j = 0; j < days.length; j++) {
        if (j === d) continue;
        if ((days[j].posts || []).length >= postsPerDay) continue;
        if (countAdjacentOnDay(days[j].posts || []) >= maxAdjacent) continue;
        dest = j;
        break;
      }
      if (dest < 0) break;
      const item = posts.splice(adjIdx[adjIdx.length - 1], 1)[0];
      days[dest].posts.push(item);
    }
  }
}

export function markAdjacentSeed<T extends Record<string, unknown>>(seed: T): T {
  const subject = String(seed.concrete_subject || "");
  const cluster = adjacentClusterFromText(subject);
  return {
    ...seed,
    cluster,
    source_type: ADJACENT_SOURCE_TYPE,
    source_kind: "adjacent_expansion",
    creator_evidence_available: false,
    experience_required: false,
    requested_editorial_mode: "INFORMATIVE",
    editorial_mode: "INFORMATIVE",
  };
}
