#!/usr/bin/env node
/**
 * Operator quality lock: questions are not mechanisms; 레이어2 is forbidden jargon.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const humor = read("supabase/functions/weekly-plan/humor-fill.ts");
const rsp = read("supabase/functions/weekly-plan/reader-self-projection.ts");
const voice = read("supabase/functions/weekly-plan/user-direct-voice-window.ts");
const sj = read("supabase/functions/weekly-plan/semantic-judge.ts");
const scope = read("supabase/functions/weekly-plan/seed-scope.ts");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");

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

function hasExpertJargon(text) {
  const t = String(text || "");
  return /레이어|레이어\s*\d|\bL2\b|\bL1\b|스택\b|프로토콜|엔드포인트|페이로드|엔트리\s*포인트|메커니즘|\bM[1-9]_\w+/i.test(t);
}

function isQuestionCloser(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/[?？]/.test(t)) return true;
  if (/(까요|나요|을까|ㄹ까|는가|인가|실까요|할까요)\s*[.…]?$/.test(t)) return true;
  if (/어떻게\s*생각|어떠신가요|보이시나요|있으신가요|해보셨/.test(t)) return true;
  return false;
}

console.log("Post quality: mechanism vs question vs jargon");
ok("Q1. 레이어2 is jargon", hasExpertJargon("테슬라 앱 레이어 2"));
ok("Q2. 알림 겹침 is not jargon", !hasExpertJargon("테슬라 앱 알림이 겹친다"));
ok("Q3. question mark is a closer", isQuestionCloser("이 화면이 맞나요?"));
ok("Q4. 까요 closer", isQuestionCloser("이 알림이 위일까요"));
ok("Q5. finished observation is not a question", !isQuestionCloser("충전 중 알림이 겹치면 어느 화면이 위인지 손으로 확인하게 된다."));
ok("Q6. humor fill has no 레이어 seed", !/레이어/.test(humor));
ok("Q7. humor fill does not number leftover keywords", !/suffix \+ 1/.test(humor) && !/\$\{base\.concrete_subject\} \$\{/.test(humor));
ok("Q8. writer has operational mechanism moves", /MECHANISM_WRITE_MOVES/.test(wr) && /Compress a repeated everyday behavior/.test(wr));
ok("Q9. writer no longer asks for a judgment-gap question", !/leave a judgment gap so a reader can add/.test(wr));
ok("Q10. default mechanism is observation personality", /default_observation_personality/.test(rsp) && !/self_projection_none_informative_ok/.test(rsp));
ok("Q11. AP voice never allows question ending", /question_ending_allowed = false/.test(voice));
ok("Q12. judge hard-fails question closer", /hard\.push\("question_closer"\)/.test(sj));
ok("Q13. judge hard-fails 레이어 jargon", /hard\.push\("expert_jargon"\)/.test(sj));
ok("Q14. job drops jargon seeds", /hasExpertJargon/.test(job));
ok("Q15. DNA wording forbids 레이어2", /레이어2/.test(dna) && /Do not ask a question to make a reply slot/.test(dna));
ok("Q16. seed-scope exports hasExpertJargon", /export function hasExpertJargon/.test(scope));
const everydayBlock = (rsp.match(/const everydayIds: MechanismId\[\] = \[([\s\S]*?)\];/) || [])[1] || "";
ok("Q17. M9 is not the everyday fallback", /M4_LIFE_PATTERN_EXPOSURE/.test(everydayBlock) && !/M9_/.test(everydayBlock));
ok("Q18. writer user message is statement only", /Statement only\. No question mark/.test(wr));
ok("Q19. 말투/length follow this slot not one batch template", /VARIETY:/.test(wr) && /Do not make every post the same length/.test(wr));

console.log("========================================");
console.log(`POST QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
