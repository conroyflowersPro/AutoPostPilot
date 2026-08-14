#!/usr/bin/env node
/**
 * v11.2.3 — do not abandon usable seeds; do not save stutter/one-line garbage.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const wr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const ow = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8");
const dgc = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts"), "utf8");
const sj = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/semantic-judge.ts"), "utf8");
const ver = readFileSync(path.join(ROOT, "lib/version.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");

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

const STUTTER_RE = /([A-Za-z가-힣]{1,8})(?:\s+\1){2,}/;
const MIN_ORIGINAL_CHARS = 80;

function isTokenStutter(text) {
  const t = String(text || "");
  if (STUTTER_RE.test(t)) return true;
  const entEn = (t.match(/\bent\b/gi) || []).length;
  const entKo = (t.match(/엔트/g) || []).length;
  return entEn + entKo >= 2;
}

function isTooShortOriginal(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length < MIN_ORIGINAL_CHARS) return true;
  if (t.length >= 140) return false;
  const clauses = t.split(/[.!?。\n]|다\s|요\s|죠\s/).map((s) => s.trim()).filter((s) => s.length >= 8);
  return clauses.length < 2;
}

console.log("Writer quality + leftover seeds (v11.2.3)");
ok("W1. stutter detector exists", /export function isTokenStutter/.test(wr) && /token_stutter/.test(wr));
ok("W2. too-short detector exists", /export function isTooShortOriginal/.test(wr) && /too_short_original/.test(wr));
ok("W3. ent ent ent is stutter", isTokenStutter("슈퍼차저 줄에서 ent ent ent ent ent ent"));
ok("W4. hyphenated ent stutter", isTokenStutter("ent 시트-ent 미러가 ent ent ent ent"));
ok("W5. Korean 엔트 filler twice", isTokenStutter("엔트 등이 막 바뀌었는데 시스템이 엔트를 얼마나 붙잡고 있는지."));
ok("W6. normal Supercharger sentence is not stutter", !isTokenStutter("슈퍼차저 줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다. 대기 화면에 남는 건 그 밀린 숫자뿐이다."));
ok("W7. one-liner is too short", isTooShortOriginal("충전 중에 알림이 겹친다."));
ok("W8. two-clause 80+ is not too short", !isTooShortOriginal("충전 중에 알림이 겹치면 어느 레이어를 먼저 봐야 할지 손이 멈춘다. 화면은 한 장인데 메시지는 충전과 내비게이션 두 갈래로 들어온다."));
ok("W9. 140+ observation is not too short", !isTooShortOriginal("충전 중 알림이 겹쳐 보이면 어느 레이어가 위인지 손으로 확인하게 된다. ".repeat(3)));
ok("W10. writer prompt forbids stutter", /token stutter/.test(wr) && /At least two sentences/.test(wr));
ok("W11. validateOutput hard-fails stutter/short", /reasons\.includes\("token_stutter"\)/.test(wr) && /reasons\.includes\("too_short_original"\)/.test(wr));
ok("W12. writer retries once", /allow_one_retry !== false/.test(wr) && /allow_one_retry:\s*true/.test(ow));
ok("W13. leftover selectable fill", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("W14. experience without evidence remints", /onlyMissingLived/.test(job) && /NO_CREATOR_EVIDENCE/.test(job));
ok("W15. non-casual compression never VERY_COMPRESSED", /mode !== "CASUAL_OBSERVATION"/.test(dgc) && /return "NATURAL"/.test(dgc));
ok("W16. judge hard-fails stutter", /hard\.push\("token_stutter"\)/.test(sj) && /hard\.push\("too_short_original"\)/.test(sj));
ok("W17. version lockstep 11.2.3", /APP_VERSION = "11.2.3"/.test(ver) && /APP_VERSION = "11.2.3"/.test(ix));
ok("W18. Korean summary names stutter", /ent 반복/.test(ver));

console.log("========================================");
console.log(`WRITER QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
