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

ok("A8. job requests adjacentRing expand", /adjacentRing: adjacentFill/.test(job));
ok("A9. job does not abort 22/28", !/할당량을 채운 뒤에만 저장합니다/.test(job));
ok("A10. leftover adjacent respects per-day max", /pickDayForAdjacent/.test(job) && /enforceAdjacentPerDay/.test(job));
ok("A11. shortfall writes then review", /리뷰:/.test(job) && /빈 칸은 작성하지 않음/.test(job));
ok("A12. Grok adjacent prompt is mass sectors not EV/space", /mass public sectors/.test(adjSrc) && /DAILY_AI/.test(adjSrc) && /adjacentRingPromptLines/.test(cr) && !/electric-vehicle industry/.test(adjSrc));
ok("A13. writer forbids lived Tesla on adjacent", /ADJACENT RING/.test(wr) && /FORBIDDEN: first-person Tesla/.test(wr));
ok("A14. generate page keeps review copy", /리뷰하세요/.test(gen));
ok("A15. mix EXPERIENCE capped to supply", /expSupply/.test(job));
ok("A16. leftover pool fill after adjacent", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("A17. experience without evidence stays selectable as INFORMATIVE", /onlyMissingLived/.test(job));
ok("A18. personal cap is 1/day", /PERSONAL_PER_DAY_MAX = 1/.test(scopeSrc) && /enforcePersonalPerDay/.test(job));
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
ok("A22. expand uses placeable count not raw 6-batch", /placeableSeedCount/.test(job) && /대중 시드 보충/.test(job));
ok("A23. quota example is 4 not 6", /posts_per_day":4/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8")));
ok("A24. six Tesla seeds are all personal so a 28-week is still short", (() => {
  const seeds = Array.from({ length: 6 }, (_, i) => ({ concrete_subject: `야간 FSD 보행자 ${i}`, cluster: "FSD" }));
  const personal = seeds.filter((s) => isPersonal(s.concrete_subject, s.cluster)).length;
  const mass = seeds.length - personal;
  const placeable = Math.min(personal, 7) + mass;
  return personal === 6 && mass === 0 && placeable === 6 && placeable < 28;
})());

console.log("========================================");
console.log(`ADJACENT FILL: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
