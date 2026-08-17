/**
 * Seed discovery classification helpers. Candidate generation has no fixed mix;
 * seven-day Planner owns final strategy and allocation.
 * Elon/ticker/Robotaxi news is still not a default subject.
 * Do not invent lived experience — DNA/engine bounds only.
 */

export const MASS_PER_DAY_MAX = 1;
/** Personal-interest originals are the main mix; no 1/day cap. */
export const PERSONAL_PER_DAY_MAX = 99;

export const MASS_SECTORS = [
  "DAILY_AI",
  "PHONE_NOTIFY",
  "ROAD_PARK",
  "LIVING_COST",
  "QUEUE_WAIT",
  "WEATHER_OUT",
] as const;

export type MassSector = (typeof MASS_SECTORS)[number];

export const PERSONAL_CLUSTERS = [
  "FSD",
  "CYBERTRUCK",
  "ROBOTAXI",
  "TESLA",
  "LAFC",
  "GAMING",
] as const;

/** Slot type labels are bounds, not seed bodies. Grok must not copy these as concrete_subject. */
export function isSlotTypeLabel(subject: string): boolean {
  const raw = String(subject || "").trim();
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (!compact) return true;
  if ((PERSONAL_CLUSTERS as readonly string[]).includes(compact)) return true;
  if ((MASS_SECTORS as readonly string[]).includes(compact)) return true;
  if (/^(MASS_PUBLIC|PERSONAL_INTEREST|PERSONAL_DNA_INTEREST|MASS_PUBLIC_DAILY|OBSERVATION|HUMOR|CASUAL|INFORMATIVE|CASUALOBSERVATION)$/.test(compact)) {
    return true;
  }
  return /관찰·판단\s*축|DIMENSION_REGISTRY|PERSONAL_DNA_INTEREST|MASS_PUBLIC_DAILY|slot_kind|cluster_bound/.test(raw);
}

export type OpenSeedSlot = {
  slot_id: string;
  /**
   * Candidate discovery is deliberately unbounded by the final publish mix.
   * The Planner applies personal/mass balance when it selects and places posts.
   */
  slot_kind: "OPEN_DISCOVERY";
  cluster_bound: "CREATOR_DNA_OR_ADJACENT";
  concrete_subject: "";
};

/** Typed empty cells. concrete_subject stays empty until Grok infers a situation. */
export function buildOpenSlots(args: {
  needed: number;
  existing?: Array<{ cluster?: string; concrete_subject?: string }>;
  days?: number;
  maxMass?: number;
}): OpenSeedSlot[] {
  const needed = Math.max(0, Math.min(64, Math.ceil(Number(args.needed) || 0)));
  const slots: OpenSeedSlot[] = [];
  for (let i = 0; i < needed; i++) {
    slots.push({
      slot_id: `open-${i + 1}`,
      slot_kind: "OPEN_DISCOVERY",
      cluster_bound: "CREATOR_DNA_OR_ADJACENT",
      concrete_subject: "",
    });
  }
  return slots;
}

const PERSONAL_RE =
  /tesla|테슬라|elon|musk|일론|머스크|cybertruck|사이버트럭|\bfsd\b|hw3|v14|오토파일럿|로보택시|robotaxi|모델\s*[3sy]|플래드|plaid|lafc|축구|직관|\b게임\b|스팀|매치메이킹|\bgrok\b|그록|충전|슈퍼차저|supercharger/i;

/** Map a subject onto a Creator-DNA interest cluster when Grok used OBSERVATION/HUMOR. */
export function inferPersonalCluster(text: string, cluster?: string): string {
  const c = String(cluster || "").toUpperCase();
  if ((PERSONAL_CLUSTERS as readonly string[]).includes(c)) return c;
  const t = String(text || "").toLowerCase();
  if (/fsd|hw3|v14|오토파일럿|자율/.test(t)) return "FSD";
  if (/cybertruck|사이버트럭/.test(t)) return "CYBERTRUCK";
  if (/lafc|축구|손흥민|\bbmo\b/.test(t)) return "LAFC";
  if (/게임|스팀|\bsteam\b|매치메이킹|큐 대기/.test(t)) return "GAMING";
  if (/테슬라|tesla|\bgrok\b|그록|충전|슈퍼차저|supercharger/.test(t)) return "TESLA";
  return c;
}

const GENERIC_TICKER_NEWS_RE =
  /테슬라\s*주가|tsla\b|로보택시\s*뉴스|robotaxi news/i;

/** Korea-only civic/housing/daily situations the CA-based creator does not live. */
const KOREA_ONLY_RE =
  /이중\s*주차|관리사무소|관리비|주민센터|배달의민족|배민|쿠팡이츠|따릉이|마을버스|김밥천국|전세|청약|아파트\s*단지|경비실|공동현관|층간소음|무인\s*택배함|명절\s*귀성|\bktx\b|경부고속|한국\s*지하철|서울\s*지하철|홍대|인천공항(?!\s*환승)/i;

export function isKoreaOnlySituation(text: string): boolean {
  return KOREA_ONLY_RE.test(String(text || ""));
}

export function isPersonalInterestSubject(text: string, cluster?: string): boolean {
  const inferred = inferPersonalCluster(text, cluster);
  if ((PERSONAL_CLUSTERS as readonly string[]).includes(inferred)) return true;
  return PERSONAL_RE.test(String(text || ""));
}

export function isForbiddenDefaultSubject(text: string): boolean {
  return GENERIC_TICKER_NEWS_RE.test(String(text || "")) || isKoreaOnlySituation(text);
}

export function countPersonalOnDay(
  posts: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }>,
): number {
  return (posts || []).filter((p) =>
    isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")),
  ).length;
}

/** How many originals we can actually place: all personal + 1 mass/day. */
export function placeableSeedCount(
  seeds: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }>,
  days = 3,
  maxMass = MASS_PER_DAY_MAX,
): number {
  let personal = 0;
  let mass = 0;
  for (const s of seeds || []) {
    if (isPersonalInterestSubject(String(s.concrete_subject || ""), String(s.cluster || s.topic_cluster || ""))) {
      personal += 1;
    } else {
      mass += 1;
    }
  }
  return personal + Math.min(mass, days * maxMass);
}

export function massSectorFromText(text: string): MassSector {
  const t = String(text || "");
  if (/번역|초안|요약|음성|챗gpt|chatgpt|\bgrok\b|그록|ai\b/i.test(t)) return "DAILY_AI";
  if (/알림|업데이트|휴대폰|화면|레이어|폰\b/i.test(t)) return "PHONE_NOTIFY";
  if (/주차|비\s|와이퍼|길찾기|네비|교통|차선/i.test(t)) return "ROAD_PARK";
  if (/구독|수수료|대기.*돈|생활비|요금/i.test(t)) return "LIVING_COST";
  if (/줄|대기|대기줄|순번/i.test(t)) return "QUEUE_WAIT";
  return "WEATHER_OUT";
}

/** Deep internal terms. Everyday Tesla/FSD/충전 language is not this list. */
const DEEP_JARGON_RE = /(?<!플)레이어\s*\d+|(?<!플)레이어2|(?<!플)레이어|페이로드|엔드포인트|엔트리\s*포인트|프로토콜|\b메커니즘\b|\bM[1-9]_\w+/gi;

export function lastSentenceKo(text: string): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.split(/(?<=[.?!？！])\s+/);
  return parts[parts.length - 1] || t;
}

/** Reply-bait / follower-beg in the last sentence only. A thinking ? is allowed. */
export function isEngagementBaitCloser(text: string): boolean {
  const last = lastSentenceKo(text);
  return /어떻게\s*생각|어떠신가요|보이시나요|댓글로|의견을\s*남겨|팔로우|리트윗|궁금하(신)?가요/.test(last);
}

export function deepJargonCount(text: string): number {
  const t = String(text || "");
  const a = t.match(DEEP_JARGON_RE) || [];
  const stack = t.match(/(^|[^가-힣])스택([^가-힣]|$)/g) || [];
  return a.length + stack.length;
}

/** Too many deep terms in one post. One necessary term still passes. */
export function hasExpertJargon(text: string): boolean {
  return deepJargonCount(text) >= 2;
}

export function lengthBandForMode(_mode: string): string {
  return "Length follows the closed thought until it is complete. Not a character quota. Not one sentence because the slot is informational.";
}

export function pickDayForPersonal(
  days: Array<{ posts: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }> }>,
  postsPerDay: number,
  maxPersonal = PERSONAL_PER_DAY_MAX,
): number {
  let best = -1;
  let bestScore = 1e9;
  for (let d = 0; d < days.length; d++) {
    const posts = days[d].posts || [];
    if (posts.length >= postsPerDay) continue;
    if (countPersonalOnDay(posts) >= maxPersonal) continue;
    const score = countPersonalOnDay(posts) * 10 + posts.length;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function countMassOnDay(
  posts: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }>,
): number {
  return (posts || []).filter((p) =>
    !isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")),
  ).length;
}

export function pickDayForMass(
  days: Array<{ posts: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }> }>,
  postsPerDay: number,
  maxMass = MASS_PER_DAY_MAX,
): number {
  let best = -1;
  let bestScore = 1e9;
  for (let d = 0; d < days.length; d++) {
    const posts = days[d].posts || [];
    if (posts.length >= postsPerDay) continue;
    if (countMassOnDay(posts) >= maxMass) continue;
    const score = countMassOnDay(posts) * 10 + posts.length;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** EXPERIENCE only on the personal-interest slot. Mass posts demote to INFORMATIVE. */
export function demoteExperienceOnMassSlots<
  T extends { editorial_mode?: string; cluster?: string; concrete_subject?: string; topic_cluster?: string },
>(days: Array<{ posts: T[] }>): void {
  for (const day of days) {
    for (const p of day.posts || []) {
      if (String(p.editorial_mode || "").toUpperCase() !== "EXPERIENCE") continue;
      if (!isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || ""))) {
        p.editorial_mode = "INFORMATIVE";
      }
    }
  }
}

/**
 * At most one mass-public daily-life original per day. Extra mass posts
 * swap onto a day that has none.
 */
export function enforceMassPerDay<
  T extends { cluster?: string; concrete_subject?: string; topic_cluster?: string },
>(days: Array<{ posts: T[] }>, maxMass = MASS_PER_DAY_MAX): void {
  for (let d = 0; d < days.length; d++) {
    for (;;) {
      const posts = days[d].posts || [];
      const massIdx = posts
        .map((p, i) => (isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")) ? -1 : i))
        .filter((i) => i >= 0);
      if (massIdx.length <= maxMass) break;
      const extraI = massIdx[massIdx.length - 1];
      let dest = -1;
      let swapPersonal = -1;
      for (let j = 0; j < days.length; j++) {
        if (j === d) continue;
        if (countMassOnDay(days[j].posts || []) >= maxMass) continue;
        dest = j;
        swapPersonal = (days[j].posts || []).findIndex(
          (p) => isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")),
        );
        break;
      }
      if (dest < 0) break;
      const extra = posts.splice(extraI, 1)[0];
      if (swapPersonal >= 0) {
        const personal = days[dest].posts.splice(swapPersonal, 1)[0];
        days[d].posts.push(personal);
      }
      days[dest].posts.push(extra);
    }
  }
}

/**
 * Legacy helper kept for tests: extra personal posts swap with a mass post
 * on a day that has none. Callers that want the live mix should use enforceMassPerDay.
 */
export function enforcePersonalPerDay<
  T extends { cluster?: string; concrete_subject?: string; topic_cluster?: string },
>(days: Array<{ posts: T[] }>, maxPersonal = PERSONAL_PER_DAY_MAX): void {
  for (let d = 0; d < days.length; d++) {
    for (;;) {
      const posts = days[d].posts || [];
      const personalIdx = posts
        .map((p, i) => (isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")) ? i : -1))
        .filter((i) => i >= 0);
      if (personalIdx.length <= maxPersonal) break;
      const extraI = personalIdx[personalIdx.length - 1];
      let dest = -1;
      let swapMass = -1;
      for (let j = 0; j < days.length; j++) {
        if (j === d) continue;
        if (countPersonalOnDay(days[j].posts || []) >= maxPersonal) continue;
        dest = j;
        swapMass = (days[j].posts || []).findIndex(
          (p) => !isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")),
        );
        break;
      }
      if (dest < 0) break;
      const extra = posts.splice(extraI, 1)[0];
      if (swapMass >= 0) {
        const mass = days[dest].posts.splice(swapMass, 1)[0];
        days[d].posts.push(mass);
      }
      days[dest].posts.push(extra);
    }
  }
}
