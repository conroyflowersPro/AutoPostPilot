/**
 * Creator Judge is Contradiction Check, not Creator Fit / topic similarity.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const judge = fs.readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/semantic-judge.ts"), "utf8");
const stage = fs.readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-stage-philosophy.ts"), "utf8");
const router = fs.readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/regeneration-router.ts"), "utf8");

let pass = 0, fail = 0;
const failures = [];
function assert(cond, name) {
  if (cond) { pass++; console.log("PASS:", name); }
  else { fail++; failures.push(name); console.log("FAIL:", name); }
}

assert(/Contradiction Check/.test(stage), "philosophy names Contradiction Check");
assert(/Do not score how similar/.test(stage), "philosophy forbids similarity scoring");
assert(/Do not reject a new topic/.test(stage), "philosophy allows new topics");
assert(/Missing past evidence is not a fail/.test(stage), "thin history is not a fail");
assert(/ORDER8A_CREATOR_CHECK_IS_CONTRADICTION/.test(judge), "runtime flag: contradiction only");
assert(/ORDER8A_NO_CREATOR_FIT_SCORE_GATE/.test(judge), "runtime flag: no fit score gate");
assert(/ORDER8A_NO_TOPIC_FAMILIARITY_GATE/.test(judge), "runtime flag: no topic familiarity gate");
assert(/hasCreatorIdentityContradiction/.test(judge), "contradiction helper exists");
assert(/hard\.push\("creator_identity_contradiction"\)/.test(judge), "contradiction is a hard reason");
assert(!/creator_fit_weak/.test(judge), "no creator_fit_weak soft reason");
assert(!/scores\.creator_fit < 0\.55/.test(judge), "finalize does not use creator_fit threshold");
assert(!/ORDER8B_SOFT_REGEN_CREATOR_FIT_BELOW/.test(router), "router does not regen from creator_fit score");
assert(/CREATOR_CONTRADICTION/.test(router), "router maps contradiction as hard");

const KOREA_ONLY = /이중\s*주차|관리사무소|전세|청약|아파트\s*단지/;
const FIRST_PERSON_LIVED = /제가|나는|우리\s*(아파트|단지|집)|직접|살아보니|살아봤/;
const FIRST_PERSON_KOREA_RESIDENCE = [/한국에\s*살/, /서울에\s*살/, /한국\s*거주/, /한국에서\s*(살고|지내)/, /한국\s*살면서/];

function judgeTwin(text, seedMeaning) {
  const hard = [];
  const flags = { creator_contradiction: false };
  if (FIRST_PERSON_KOREA_RESIDENCE.some((re) => re.test(text)) || (KOREA_ONLY.test(text) && FIRST_PERSON_LIVED.test(text))) {
    flags.creator_contradiction = true;
    hard.push("creator_identity_contradiction");
  }
  const tokens = String(seedMeaning || "").split(/\s+/).filter((t) => t.length >= 2);
  const seedHit = !seedMeaning || tokens.some((t) => text.includes(t));
  if (seedMeaning && !seedHit) hard.push("seed_meaning_departure");
  return {
    overall_status: hard.length ? "REJECT" : "PASS",
    hard_fail_reasons: hard,
    flags,
  };
}

let r = judgeTwin("캠핑 의자 접는 버릇이 남는다. 자리를 뜨기 전에 한 번 더 확인한다.", "캠핑 의자 접는 버릇");
assert(r.overall_status === "PASS", "new adjacent topic is allowed");

r = judgeTwin("와인 온도가 조금만 높아도 맛이 달아진다.", "와인 온도");
assert(r.overall_status === "PASS", "experimental expansion topic is allowed");

r = judgeTwin("한국 청약 뉴스 보니까 대기 줄이 길다.", "한국 청약 뉴스");
assert(r.overall_status === "PASS", "Korea news comment without lived claim is not contradiction");

r = judgeTwin("우리 아파트 전세 갱신하러 관리사무소에 다녀왔다.", "전세 계약 갱신");
assert(r.overall_status === "REJECT" && r.flags.creator_contradiction, "lived Korea civic claim is contradiction");

r = judgeTwin("한국에 살면 이런 대기 줄이 일상이다.", "대기 줄");
assert(r.overall_status === "REJECT" && r.flags.creator_contradiction, "first-person Korea residence is contradiction");

console.log("\n=== CREATOR CONTRADICTION TEST SUMMARY ===");
console.log("PASS:", pass, "FAIL:", fail);
if (failures.length) console.log("Failures:", failures.join(", "));
process.exit(fail > 0 ? 1 : 0);
