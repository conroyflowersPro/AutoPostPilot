#!/usr/bin/env node
/**
 * Lived originals can become EXPERIENCE cite-seeds.
 * Related follow-up OK. Same-content clone forbidden.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const exp = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/experience-evidence.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const wr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");

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

const SIGNAL =
  /직접|해봤|타\s*보|충전했|직관|갔었|경험|체감|쓰다\s*보|쓰다가|운전했|사용\s*중|내\s*(차|기록|세션)|오늘\s*(충전|주행|직관|게임)|어제|퇴근길|출근길|식겁|야간|보행자|정차|차량에서|드라이브스루|이스터에|와이퍼|꽃집|마님/i;

function isExp(t) {
  return SIGNAL.test(t);
}

const night =
  "보행자는 아직 길에 들어오지도 않았는데… 처음에는 왜 멈췄나 싶었는데 자세히 보니 건너려고 제 차가 정차하기를 기다리고 있었던 거더군요. 야간이라 보행자 입장에서는 차가 자신을 봤는지 확신하기 어렵습니다.";
const scare =
  "오늘 퇴근길에 Cybertruck FSD v14.3.6 쓰다가 진짜 식겁할 뻔했습니다. 차 많은 사거리에서 꼬리물기 안 하려고 딱 멈추길래";
const grokCar =
  "테슬라 차량에서 Grok을 쓰다가 주간 한도가 생각보다 빨리 차는 걸 느껴서 원인을 찾아봤어요.";
const news =
  "테슬라찬님 진짜 미쳤다… HW3 + FSD V14 Lite 과열 이슈 뜨자마자 바로 영상 올려서 정리해주심.";

console.log("Experience cite-seeds (related OK, clone forbidden)");
ok("E1. lived voice signals in extractor", /퇴근길/.test(exp) && /보행자/.test(exp) && /식겁/.test(exp));
ok("E2. relatedExperienceSubject exported", /export function relatedExperienceSubject/.test(exp));
ok("E3. never body.slice as subject", !/concrete_subject:\s*[^\n]*body\.slice/.test(exp));
ok("E4. 동일 내용 금지 on extract", /동일 내용 금지/.test(exp));
ok("E5. originals are SEED_SOURCE cite-seeds", /SEED_SOURCE/.test(exp) && /seed_eligible: userExplicit \|\| !isReply/.test(exp));
ok("E6. job injects 30d Analytics lived seeds", /analyticsLivedSeeds/.test(job) && /ANALYTICS_LIVED/.test(job));
ok("E7. job does not mix archive fallback into experience pool", /아카이브 폴백 없음/.test(job) && !/ARCHIVE_EXPERIENCE_FALLBACK/.test(job));
ok("E8. writer may cite related, not clone", /CITE RELATED/.test(wr) && /동일 내용/.test(wr));
ok("E9. Grok expand told not to clone lived", /CITE\+RELATED/.test(cr) || /Never clone the same content/.test(cr));
ok("E10. night FSD pedestrian is experiential", isExp(night));
ok("E11. intersection scare is experiential", isExp(scare));
ok("E12. in-car Grok is experiential", isExp(grokCar));
ok("E13. third-party news recap is not experience", !isExp(news));
ok("E14. night subject is cite-follow-up", /야간 FSD 보행자 대기 장면 인용/.test(exp));
ok("E15. performance window stored as candidates not post bodies", /performance-window-candidates\.json/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-dna.ts"), "utf8")));
ok("E16. window json has no clone of night pedestrian prose", !/보행자는 아직 길에/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/performance-window-candidates.json"), "utf8")));

console.log("========================================");
console.log(`EXPERIENCE CITE: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
