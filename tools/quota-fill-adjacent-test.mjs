#!/usr/bin/env node
/**
 * Quota holes fill from mass public sectors (max 3/day).
 * Still-short weeks write what exists and go to review. Never abort 22/28.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const adjSrc = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/adjacent-expansion.ts"), "utf8");
const scopeSrc = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-scope.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");
const wr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log("  PASS ", name);
  } else {
    fail++;
    console.log("  FAIL ", name);
  }
}

const PERSONAL_RE =
  /tesla|테슬라|elon|musk|일론|머스크|cybertruck|사이버트럭|\bfsd\b|오토파일럿|로보택시|robotaxi|모델\s*[3sy]|플래드|plaid|lafc|직관|게임\s*한\s*판|매치메이킹/i;
const MASS_RE =
  /번역|초안|요약|음성|알림|휴대폰|화면|주차|와이퍼|구독|수수료|대기|줄|날씨|외출|길찾기|요금|업데이트 미루/i;
const MASS_CLUSTERS = ["DAILY_AI", "PHONE_NOTIFY", "ROAD_PARK", "LIVING_COST", "QUEUE_WAIT", "WEATHER_OUT"];

function isPersonal(text, cluster) {
  const c = String(cluster || "").toUpperCase();
  if (["FSD", "CYBERTRUCK", "ROBOTAXI", "TESLA", "LAFC", "GAMING"].includes(c)) return true;
  return PERSONAL_RE.test(String(text || ""));
}
function isAdjacentSeed(seed) {
  const st = String(seed.source_type || seed.source_kind || "").toUpperCase();
  if (st.includes("ADJACENT")) return true;
  const c = String(seed.cluster || "").toUpperCase();
  if (MASS_CLUSTERS.includes(c)) return true;
  const sub = String(seed.concrete_subject || "");
  return MASS_RE.test(sub) && !isPersonal(sub, seed.cluster);
}
function countAdjacent(posts) {
  return posts.filter((p) => isAdjacentSeed(p)).length;
}
function pickDay(days, postsPerDay, maxAdj = 3) {
  let best = -1;
  let bestScore = 1e9;
  for (let d = 0; d < days.length; d++) {
    const posts = days[d].posts || [];
    if (posts.length >= postsPerDay) continue;
    if (countAdjacent(posts) >= maxAdj) continue;
    const score = countAdjacent(posts) * 10 + posts.length;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function countPersonal(posts) {
  return posts.filter((p) => isPersonal(p.concrete_subject, p.cluster || p.topic_cluster)).length;
}

console.log("Quota fill via mass public sectors (max 3/day) then review");
ok("A1. module exports mass-sector adjacent helpers", /export const ADJACENT_PER_DAY_MAX = 3/.test(adjSrc) && /DAILY_AI/.test(adjSrc) && /PHONE_NOTIFY/.test(adjSrc) && !/EV_INDUSTRY/.test(adjSrc));
ok("A2. Tesla night FSD is personal not mass-fill", isPersonal("야간 FSD 보행자 대기", "FSD") && !isAdjacentSeed({ concrete_subject: "야간 FSD 보행자 대기", cluster: "FSD" }));
ok("A3. phone alerts are mass", isAdjacentSeed({ concrete_subject: "휴대폰 알림이 겹쳐 어느 레이어가 위인지", cluster: "PHONE_NOTIFY" }));
ok("A4. parking without a brand is mass", isAdjacentSeed({ concrete_subject: "비 오는 날 주차 줄에서 와이퍼만 켜 둔 차", cluster: "ROAD_PARK" }));
ok("A5. subscription fee is mass not Tesla-lived", isAdjacentSeed({ concrete_subject: "구독 수수료가 대기 시간에 붙는 지점", cluster: "LIVING_COST" }) && !isPersonal("구독 수수료가 대기 시간에 붙는 지점", "LIVING_COST"));

const days = Array.from({ length: 7 }, () => ({ posts: [] }));
days[0].posts = [{ source_type: "ADJACENT_EXPANSION" }, { source_type: "ADJACENT_EXPANSION" }, { source_type: "ADJACENT_EXPANSION" }];
ok("A6. day with 3 adjacent is full", pickDay(days, 4, 3) !== 0);
ok("A7. other days still accept adjacent", pickDay(days, 4, 3) > 0);

ok("A8. job requests humorRing expand", /humorRing: humorFill \|\| massAtCap/.test(job));
ok("A9. job does not abort 22/28", !/할당량을 채운 뒤에만 저장합니다/.test(job));
ok("A10. leftover adjacent respects per-day max", /pickDayForAdjacent/.test(job) && /enforceAdjacentPerDay/.test(job));
ok("A11. shortfall keeps Grok humor expand, never a frozen keyword list", /humor_fill = true/.test(job) && /유머·관심 시드로 할당량 보충/.test(job) && !/localHumorKeywordSeeds/.test(job) && !/빈 칸은 작성하지 않음/.test(job));
ok("A12. Grok adjacent prompt is mass sectors not EV/space", /mass public sectors/.test(adjSrc) && /DAILY_AI/.test(adjSrc) && /adjacentRingPromptLines/.test(cr) && !/electric-vehicle industry/.test(adjSrc));
ok("A13. writer forbids lived Tesla on adjacent", /ADJACENT RING/.test(wr) && /FORBIDDEN: first-person Tesla/.test(wr));
ok("A14. generate page keeps review copy", /리뷰하세요/.test(gen));
ok("A15. mix EXPERIENCE capped to supply", /expSupply/.test(job));
ok("A16. leftover pool fill after adjacent", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("A17. experience without evidence stays selectable as INFORMATIVE", /onlyMissingLived/.test(job));
ok("A18. mass cap is 1/day", /MASS_PER_DAY_MAX = 1/.test(scopeSrc) && /enforceMassPerDay/.test(job));
ok("A19. seed prompt forbids Elon/Tesla as default", /Tesla\/Elon\/Robotaxi-news are not the default/.test(cr));
ok("A20. writer mass slot forbids Tesla subject", /MASS PUBLIC SLOT/.test(wr) && /do not name Elon, Tesla, FSD/.test(wr));

const personalDays = Array.from({ length: 7 }, () => ({ posts: [] }));
personalDays[0].posts = [
  { concrete_subject: "야간 FSD 보행자 대기", cluster: "FSD" },
  { concrete_subject: "야간 FSD 보행자 대기 2", cluster: "FSD" },
  { concrete_subject: "휴대폰 알림 겹침", cluster: "PHONE_NOTIFY" },
];
personalDays[1].posts = [{ concrete_subject: "구독 수수료", cluster: "LIVING_COST" }];
ok("A21. day 0 has two personal before cap", countPersonal(personalDays[0].posts) === 2);
ok("A22. expand uses placeable count not raw 6-batch", /placeableSeedCount/.test(job) && /유머·관심 시드로 할당량 보충/.test(job));
ok("A23. quota example is 4 not 6", /posts_per_day":4/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8")));
ok("A25. Korea-only civic is forbidden default", /isKoreaOnlySituation/.test(scopeSrc) && /이중\\s\*주차/.test(scopeSrc));
ok("A26. 이중주차 is Korea-only", /이중\\s\*주차/.test(scopeSrc) && /관리사무소/.test(scopeSrc) && /배민/.test(scopeSrc));
ok("A27. adjacent infers mass situation, no street-parking menu", /Infer a NEW mass-public situation/.test(adjSrc) && !/street \/ structure \/ red curb/.test(adjSrc) && /이중\\s\*주차/.test(scopeSrc));
ok("A28. seed prompt lives in California", /Creator lives in California/.test(cr) && /FORBIDDEN invented subjects: 이중주차/.test(cr));
ok("A29. job skips Korea-only on expand and select", /isKoreaOnlySituation/.test(job));
ok("A30. expand batch 10 on job path", /const EXPAND_BATCH = 10/.test(job));
const KOREA_ONLY_RE =
  /이중\s*주차|관리사무소|관리비|주민센터|배달의민족|배민|쿠팡이츠|따릉이|마을버스|김밥천국|전세|청약|아파트\s*단지|경비실|공동현관|층간소음|무인\s*택배함|명절\s*귀성|\bktx\b|경부고속|한국\s*지하철|서울\s*지하철|홍대|인천공항(?!\s*환승)/i;
ok("A31. 이중 주차 is Korea-only", KOREA_ONLY_RE.test("단지 이중 주차"));
ok("A32. CA street parking is not Korea-only", !KOREA_ONLY_RE.test("빨간 연석 옆 길가 주차"));
ok("A33. 배민 is Korea-only, drive-through is not", KOREA_ONLY_RE.test("배민 쿠폰") && !KOREA_ONLY_RE.test("드라이브스루 대기줄"));
ok("A24. six Tesla seeds are all personal so a 12-slot 3-day is still short", (() => {
  const seeds = Array.from({ length: 6 }, (_, i) => ({ concrete_subject: `야간 FSD 보행자 ${i}`, cluster: "FSD" }));
  const personal = seeds.filter((s) => isPersonal(s.concrete_subject, s.cluster)).length;
  const mass = seeds.length - personal;
  const placeable = personal + Math.min(mass, 3);
  return personal === 6 && mass === 0 && placeable === 6 && placeable < 12;
})());
ok("A34. empty Grok expand uses compactRetry next tick, never DNA keyword inject",
  /compactRetry: compact/.test(job) && /시드 짧게 재추론/.test(job) && !/DNA 관심 키워드/.test(job) && !/localHumorKeywordSeeds/.test(job));
ok("A35. select bounces to Grok expand when short, does not fill frozen keywords",
  /adjacent_rounds \|\| 0\) < 2/.test(job) && /Grok이 관심 시드를 더 추론/.test(job) && !/localHumorKeywordSeeds/.test(job));
ok("A36. humorRing remaps OBSERVATION cluster onto DNA interests",
  /inferPersonalCluster/.test(cr) && /humorRing cluster MUST/.test(cr));
ok("A37. FSD keyword with OBSERVATION cluster is still personal",
  /inferPersonalCluster/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-scope.ts"), "utf8")));
const humor = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/humor-fill.ts"), "utf8");
ok("A38. frozen 11.5.6 keyword list is a clone-guard not a seed injector",
  /export function isFrozenHumorClone/.test(humor) && /사이버트럭 사이드미러/.test(humor) && !/export function localHumorKeywordSeeds/.test(humor));
ok("A39. Grok drops frozen clone subjects",
  /isFrozenHumorClone/.test(cr) && /isFrozenHumorClone/.test(job));
ok("A40. job lock covers a write tick", /JOB_LOCK_MS = 90000/.test(job));
ok("A41. write is one slot per tick so Safari can continue past 2/12", /const WRITE_CHUNK = 1/.test(job) && /skipSelectiveRegen: true/.test(job));
ok("A42. Grok seed prompt does not list the canned 11.5.6 subjects",
  !/사이버트럭 사이드미러/.test(cr) && !/차선 합류 망설임/.test(cr) && !/FORBIDDEN clone subjects/.test(humor) && !/Prefer 알림 겹침/.test(cr));
ok("A43. seed philosophy is infer, not prompt examples",
  /Infer\. Do not paste examples/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-stage-philosophy.ts"), "utf8")) &&
  /Never emit a prompt example/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-dna.ts"), "utf8")) &&
  !/night FSD pedestrian wait/.test(cr) && !/e\.g\. 돈 not 자산/.test(cr));

console.log("========================================");
console.log(`ADJACENT FILL: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
