/**
 * Quota-hole fill: one ring outside core Creator interest.
 * Tesla/FSD → EV industry, semiconductors, space. Never lived Tesla.
 * Max 2 adjacent posts per day. Mix is not a frozen ratio.
 */

export const ADJACENT_PER_DAY_MAX = 2;
export const ADJACENT_SOURCE_TYPE = "ADJACENT_EXPANSION";
export const ADJACENT_CLUSTERS = ["EV_INDUSTRY", "SEMICONDUCTOR", "SPACE"] as const;

const CORE_RE =
  /tesla|테슬라|cybertruck|사이버트럭|\bfsd\b|오토파일럿|로보택시|robotaxi|모델\s*[3sy]|플래드|plaid/i;
const ADJACENT_RE =
  /전기차|\bev\b|e-mobility|semicon|반도체|우주|spacex|starship|starlink|배터리|battery|nvidia|칩셋|로켓|orbit|화성|\bmars\b|충전망|배터리셀|위성|aerospace|foundry|hbm/i;

export function isCoreInterestSubject(text: string, cluster?: string): boolean {
  const c = String(cluster || "").toUpperCase();
  if (["FSD", "CYBERTRUCK", "ROBOTAXI", "TESLA"].includes(c)) return true;
  return CORE_RE.test(String(text || ""));
}

export function adjacentClusterFromText(text: string): (typeof ADJACENT_CLUSTERS)[number] {
  const t = String(text || "");
  if (/semicon|반도체|nvidia|칩|foundry|hbm/i.test(t)) return "SEMICONDUCTOR";
  if (/우주|spacex|starship|starlink|로켓|orbit|화성|\bmars\b|위성|aerospace/i.test(t)) return "SPACE";
  return "EV_INDUSTRY";
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
  return ADJACENT_RE.test(sub) && !isCoreInterestSubject(sub, seed.cluster);
}

export function adjacentDomainGate(text: string): boolean {
  const t = String(text || "");
  if (t.length < 12) return false;
  if (isCoreInterestSubject(t)) return false;
  return ADJACENT_RE.test(t);
}

export function adjacentRingPromptLines(): string[] {
  return [
    "QUOTA HOLE FILL — adjacent ring only. Core interest this week is Tesla/FSD/Cybertruck.",
    "Expand the CONCEPT one ring out: electric-vehicle industry (not Tesla-as-lived), semiconductors, space/aerospace.",
    "cluster MUST be one of EV_INDUSTRY, SEMICONDUCTOR, SPACE.",
    "INFORMATIVE / OPINION / COMPARE / CASUAL only. Never EXPERIENCE. Never first-person lived driving.",
    "Do not clone viral wording. Do not write Tesla FSD episodes. Distinct directions only.",
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
