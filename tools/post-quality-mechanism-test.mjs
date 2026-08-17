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
  const re = /(?<!플)레이어\s*\d+|(?<!플)레이어2|(?<!플)레이어|페이로드|엔드포인트|엔트리\s*포인트|프로토콜|\b메커니즘\b|\bM[1-9]_\w+/gi;
  const a = t.match(re) || [];
  const stack = t.match(/(^|[^가-힣])스택([^가-힣]|$)/g) || [];
  return a.length + stack.length >= 2;
}

function isQuestionCloser(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  const parts = t.split(/(?<=[.?!？！])\s+/);
  const last = parts[parts.length - 1] || t;
  return /어떻게\s*생각|어떠신가요|보이시나요|댓글로|의견을\s*남겨|팔로우|리트윗|궁금하(신)?가요/.test(last);
}

console.log("Post quality: mechanism vs question vs jargon");
ok("Q1. two deep terms are jargon", hasExpertJargon("레이어와 프로토콜이 겹친다"));
ok("Q1b. one 레이어 is allowed", !hasExpertJargon("테슬라 앱 레이어 2"));
ok("Q2. 알림 겹침 is not jargon", !hasExpertJargon("테슬라 앱 알림이 겹친다"));
ok("Q3. engagement-bait is a closer", isQuestionCloser("이 화면 어떻게 생각하세요"));
ok("Q4. genuine thinking question is not bait", !isQuestionCloser("이 알림이 위일까요"));
ok("Q5. finished observation is not a question", !isQuestionCloser("충전 중 알림이 겹치면 어느 화면이 위인지 손으로 확인하게 된다."));
ok("Q6. humor fill has no 레이어 seed", !/레이어/.test(humor));
ok("Q7. humor fill does not number leftover keywords", !/suffix \+ 1/.test(humor) && !/\$\{base\.concrete_subject\} \$\{/.test(humor));
ok("Q8. mechanism write catalog is not injected into the live writer", /MECHANISM_WRITE_MOVES/.test(wr) && /Compress a repeated everyday behavior/.test(wr) && !/\.\.\.writerMechanismConstraintLines/.test(wr) && !/READER ENTRY MOVE/.test(wr));
ok("Q9. writer no longer asks for a judgment-gap question", !/leave a judgment gap so a reader can add/.test(wr));
ok("Q10. mechanism NONE is normal", /none_is_normal/.test(rsp) && /MECHANISM_NONE_IS_NORMAL/.test(rsp) && !/default_observation_personality/.test(rsp));
ok("Q11. AP voice never allows question ending", /question_ending_allowed = false/.test(voice));
ok("Q12. judge hard-fails question closer", /hard\.push\("question_closer"\)/.test(sj));
ok("Q13. judge hard-fails stacked deep jargon", /hard\.push\("expert_jargon"\)/.test(sj) && /deepJargonCount/.test(sj));
ok("Q14. job preserves jargon Seed thought; Writer uses density jargon", !/hasExpertJargon/.test(job) && /hasExpertJargon\(text\)/.test(wr));
ok("Q15. DNA wording names 레이어 as deep, not a single-word ban", /레이어/.test(dna) && /two or more/.test(dna) && /Do not ask a question to make a reply slot/.test(dna));
ok("Q16. seed-scope exports hasExpertJargon", /export function hasExpertJargon/.test(scope));
const everydayBlock = (rsp.match(/const everydayIds: MechanismId\[\] = \[([\s\S]*?)\];/) || [])[1] || "";
ok("Q17. M9 is not the everyday fallback", /M4_LIFE_PATTERN_EXPOSURE/.test(everydayBlock) && !/M9_/.test(everydayBlock));
ok("Q18. final Judge rejects engagement bait, not every question mark", /hard\.push\("question_closer"\)/.test(sj) && !/if \(\/\[\?？\]\/\.test\(text\)\)/.test(sj));
ok("Q19. Writer completes the thought without a sentence quota", /stop when the thought is complete/i.test(wr) && !/sentence quota/.test(wr));

console.log("========================================");
console.log(`POST QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
