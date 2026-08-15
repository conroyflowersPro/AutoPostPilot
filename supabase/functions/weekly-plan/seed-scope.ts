/**
 * Seed scope: new readers first.
 * One personal-interest original per Pacific day. Rest are mass public sectors.
 * Tesla/Elon are not the default neighborhood.
 */

export const PERSONAL_PER_DAY_MAX = 1;

export const MASS_SECTORS = [
  "DAILY_AI",
  "PHONE_NOTIFY",
  "ROAD_PARK",
  "LIVING_COST",
  "QUEUE_WAIT",
  "WEATHER_OUT",
] as const;

export type MassSector = (typeof MASS_SECTORS)[number];

const PERSONAL_RE =
  /tesla|테슬라|elon|musk|일론|머스크|cybertruck|사이버트럭|\bfsd\b|오토파일럿|로보택시|robotaxi|모델\s*[3sy]|플래드|plaid|lafc|직관|게임\s*한\s*판|매치메이킹/i;

const ELON_TESLA_DEFAULT_RE =
  /elon|musk|일론|머스크|테슬라\s*주가|tsla\b|로보택시\s*뉴스|robotaxi news/i;

/** Korea-only civic/housing/daily situations the CA-based creator does not live. */
const KOREA_ONLY_RE =
  /이중\s*주차|관리사무소|관리비|주민센터|배달의민족|\b배민\b|쿠팡이츠|따릉이|마을버스|김밥천국|전세|청약|아파트\s*단지|경비실|공동현관|층간소음|무인\s*택배함|명절\s*귀성|\bktx\b|경부고속|한국\s*지하철|서울\s*지하철|홍대|인천공항(?!\s*환승)/i;

export function isKoreaOnlySituation(text: string): boolean {
  return KOREA_ONLY_RE.test(String(text || ""));
}

export function isPersonalInterestSubject(text: string, cluster?: string): boolean {
  const c = String(cluster || "").toUpperCase();
  if (["FSD", "CYBERTRUCK", "ROBOTAXI", "TESLA", "LAFC", "GAMING"].includes(c)) return true;
  return PERSONAL_RE.test(String(text || ""));
}

export function isForbiddenDefaultSubject(text: string): boolean {
  return ELON_TESLA_DEFAULT_RE.test(String(text || "")) || isKoreaOnlySituation(text);
}

export function countPersonalOnDay(
  posts: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }>,
): number {
  return (posts || []).filter((p) =>
    isPersonalInterestSubject(String(p.concrete_subject || ""), String(p.cluster || p.topic_cluster || "")),
  ).length;
}

/** How many originals we can actually place: 1 personal/day + all mass seeds. */
export function placeableSeedCount(
  seeds: Array<{ cluster?: string; concrete_subject?: string; topic_cluster?: string }>,
  days = 7,
  maxPersonal = PERSONAL_PER_DAY_MAX,
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
  return Math.min(personal, days * maxPersonal) + mass;
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

export function lengthBandForMode(mode: string): string {
  const m = String(mode || "").toUpperCase();
  if (m === "CASUAL_OBSERVATION") return "One sentence, about 40-80 Korean characters.";
  if (m === "EXPERIENCE") return "One or two sentences, about 70-160 Korean characters. Second sentence only to show how the tension resolved.";
  if (m === "COMPARE" || m === "OPINION") {
    return "One or two sentences, about 60-130 Korean characters. Leave the judgment open.";
  }
  return "Prefer one finished sentence, about 50-110 Korean characters. Second sentence only to resolve tension.";
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
 * At most one personal-interest original per day. Extra personal posts
 * swap with a mass post on a day that has none.
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
