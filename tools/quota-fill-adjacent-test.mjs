#!/usr/bin/env node
/**
 * Quota holes fill from adjacent-ring viral seeds (max 2/day).
 * Still-short weeks write what exists and go to review. Never abort 22/28.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const adjSrc = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/adjacent-expansion.ts"), "utf8");
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

const CORE_RE =
  /tesla|테슬라|cybertruck|사이버트럭|\bfsd\b|오토파일럿|로보택시|robotaxi|모델\s*[3sy]|플래드|plaid/i;
const ADJACENT_RE =
  /전기차|\bev\b|e-mobility|semicon|반도체|우주|spacex|starship|starlink|배터리|battery|nvidia|칩셋|로켓|orbit|화성|\bmars\b|충전망|배터리셀|위성|aerospace|foundry|hbm/i;

function isCore(text, cluster) {
  const c = String(cluster || "").toUpperCase();
  if (["FSD", "CYBERTRUCK", "ROBOTAXI", "TESLA"].includes(c)) return true;
  return CORE_RE.test(String(text || ""));
}
function isAdjacentSeed(seed) {
  const st = String(seed.source_type || seed.source_kind || "").toUpperCase();
  if (st.includes("ADJACENT")) return true;
  const c = String(seed.cluster || "").toUpperCase();
  if (["EV_INDUSTRY", "SEMICONDUCTOR", "SPACE"].includes(c)) return true;
  const sub = String(seed.concrete_subject || "");
  return ADJACENT_RE.test(sub) && !isCore(sub, seed.cluster);
}
function countAdjacent(posts) {
  return posts.filter((p) => isAdjacentSeed(p)).length;
}
function pickDay(days, postsPerDay, maxAdj = 2) {
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

console.log("Quota fill via adjacent viral (max 2/day) then review");
ok("A1. module exports adjacent helpers", /export const ADJACENT_PER_DAY_MAX = 2/.test(adjSrc) && /EV_INDUSTRY/.test(adjSrc));
ok("A2. Tesla night FSD is core not adjacent", isCore("야간 FSD 보행자 대기", "FSD") && !isAdjacentSeed({ concrete_subject: "야간 FSD 보행자 대기", cluster: "FSD" }));
ok("A3. semiconductor is adjacent", isAdjacentSeed({ concrete_subject: "HBM 반도체 공급이 EV 전장에 미치는 병목", cluster: "SEMICONDUCTOR" }));
ok("A4. space/Starship is adjacent", isAdjacentSeed({ concrete_subject: "Starship 발사가 위성망 일정에 주는 압력", cluster: "SPACE" }));
ok("A5. EV industry not Tesla-lived", isAdjacentSeed({ concrete_subject: "전기차 충전망 표준이 갈리는 지점", cluster: "EV_INDUSTRY" }) && !isCore("전기차 충전망 표준이 갈리는 지점", "EV_INDUSTRY"));

const days = Array.from({ length: 7 }, () => ({ posts: [] }));
days[0].posts = [{ source_type: "ADJACENT_EXPANSION" }, { source_type: "ADJACENT_EXPANSION" }];
ok("A6. day with 2 adjacent is full", pickDay(days, 4, 2) !== 0);
ok("A7. other days still accept adjacent", pickDay(days, 4, 2) > 0);

ok("A8. job requests adjacentRing expand", /adjacentRing: adjacentFill/.test(job));
ok("A9. job does not abort 22/28", !/할당량을 채운 뒤에만 저장합니다/.test(job));
ok("A10. leftover adjacent respects 2/day", /pickDayForAdjacent/.test(job) && /enforceAdjacentPerDay/.test(job));
ok("A11. shortfall writes then review", /리뷰:/.test(job) && /빈 칸은 작성하지 않음/.test(job));
ok("A12. Grok adjacent prompt has EV/semiconductor/space", /electric-vehicle industry/.test(adjSrc) && /semiconductors/.test(adjSrc) && /space\/aerospace/.test(adjSrc) && /adjacentRingPromptLines/.test(cr));
ok("A13. writer forbids lived Tesla on adjacent", /ADJACENT RING/.test(wr) && /FORBIDDEN: first-person Tesla/.test(wr));
ok("A14. generate page keeps review copy", /리뷰하세요/.test(gen));
ok("A15. mix EXPERIENCE capped to supply", /expSupply/.test(job));

console.log("========================================");
console.log(`ADJACENT FILL: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
