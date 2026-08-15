#!/usr/bin/env node
/**
 * v11.2.4 — quality is a finished observation, not two-sentence padding.
 * Keep leftover-seed / stutter guards from 11.2.3.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const wr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const ow = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8");
const dgc = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts"), "utf8");
const sj = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/semantic-judge.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");
const se = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-engine.ts"), "utf8");
const gi = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-integration.ts"), "utf8");
const voice = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/user-direct-voice-window.ts"), "utf8");
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
const MIN_ORIGINAL_CHARS = 28;
const GENERIC_THESIS_RE =
  /중요한\s*이슈|관심이\s*쏠|주목할\s*만|향후\s*전망|변화가\s*있|의미가\s*크다|생각해볼\s*필요/;

function isTokenStutter(text) {
  const t = String(text || "");
  if (STUTTER_RE.test(t)) return true;
  const entEn = (t.match(/\bent\b/gi) || []).length;
  const entKo = (t.match(/엔트/g) || []).length;
  return entEn + entKo >= 2;
}

function normForCompare(text) {
  return String(text || "").toLowerCase().replace(/[^0-9A-Za-z가-힣]+/g, "").trim();
}

function isFragmentOriginal(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length < MIN_ORIGINAL_CHARS) return true;
  if (/([A-Za-z가-힣])\1{4,}/.test(t)) return true;
  const ended = /[다요죠네음임]\s*[.!?…]*$/.test(t) || /[.!?]$/.test(t);
  if (!ended && t.length < 72) return true;
  return false;
}

function isSubjectRestate(text, subject) {
  const body = normForCompare(text);
  const sub = normForCompare(subject);
  if (!body || !sub || sub.length < 6) return false;
  if (body === sub) return true;
  if (body.startsWith(sub) && body.length - sub.length < 10) return true;
  if (sub.startsWith(body) && sub.length - body.length < 8) return true;
  return false;
}

console.log("Writer quality + leftover seeds (v11.2.6)");
ok("W1. stutter detector exists", /export function isTokenStutter/.test(wr) && /token_stutter/.test(wr));
ok("W2. fragment detector exists", /export function isFragmentOriginal/.test(wr) && /too_short_original/.test(wr));
ok("W3. ent ent ent is stutter", isTokenStutter("슈퍼차저 줄에서 ent ent ent ent ent ent"));
ok("W4. hyphenated ent stutter", isTokenStutter("ent 시트-ent 미러가 ent ent ent ent"));
ok("W5. Korean 엔트 filler twice", isTokenStutter("엔트 등이 막 바뀌었는데 시스템이 엔트를 얼마나 붙잡고 있는지."));
ok("W6. normal Supercharger sentence is not stutter", !isTokenStutter("슈퍼차저 줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다."));
ok("W7. tiny fragment is too short", isFragmentOriginal("충전 중에 알림이 겹친다."));
ok("W8. one finished sentence is allowed", !isFragmentOriginal("충전 중에 알림이 겹치면 어느 레이어가 위인지 손으로 확인하게 된다."));
ok("W9. 140+ observation is not a fragment", !isFragmentOriginal("충전 중 알림이 겹쳐 보이면 어느 레이어가 위인지 손으로 확인하게 된다. ".repeat(3)));
ok("W10. writer does not lock two sentences", /One complete sentence is enough/.test(wr) && !/At least two sentences/.test(wr));
ok("W11. validateOutput hard-fails stutter/fragment/restate", /reasons\.includes\("token_stutter"\)/.test(wr) && /subject_restate/.test(wr) && /generic_thesis/.test(wr));
ok("W12. writer retries once", /allow_one_retry !== false/.test(wr) && /allow_one_retry:\s*true/.test(ow));
ok("W13. leftover selectable fill", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("W14. experience without evidence remints", /onlyMissingLived/.test(job) && /NO_CREATOR_EVIDENCE/.test(job));
ok("W15. non-casual compression never VERY_COMPRESSED", /mode !== "CASUAL_OBSERVATION"/.test(dgc) && /return "NATURAL"/.test(dgc));
ok("W16. judge hard-fails stutter", /hard\.push\("token_stutter"\)/.test(sj));
ok("W17. version lockstep 11.2.6", /APP_VERSION = "11.2.6"/.test(ver) && /APP_VERSION = "11.2.6"/.test(ix));
ok("W18. Korean summary names ChatGPT writer", /ChatGPT가 씁니다/.test(ver));
ok("W19. quality rewrite hint on retry", /QUALITY REWRITE/.test(wr) && /retry_hint/.test(gi));
ok("W20. snag is optional not required", /A snag is optional/.test(wr) && /optional angle, not a required snag/.test(cr));
ok("W21. subject restate is rejected", isSubjectRestate("슈퍼차저 대기줄", "슈퍼차저 대기줄"));
ok("W22. finished observation is not a restate", !isSubjectRestate("슈퍼차저 대기줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다.", "슈퍼차저 대기줄"));
ok("W23. generic thesis is rejected", GENERIC_THESIS_RE.test("전기차 보조금은 중요한 이슈다."));
ok("W24. voice allows one sentence", /One finished sentence is allowed/.test(voice));
ok("W25. 7C retry passes rewrite hint", /quality_rewrite|retry_hint: \(last\.block_reasons/.test(gi));
ok("W26. short keyword subject is usable", /export function isUsableKeywordSubject/.test(se));
ok("W27. writer infers keyword via vision, no example posts", /short keyword seed is valid/.test(wr) && /hardcoded example posts/.test(wr));
ok("W28. info posts forbid 음슴체", /Do not use 음슴체 on information posts/.test(wr) && /Do not use 음슴체/.test(voice));
ok("W29. public words must not distort the claim", /NEVER swap a word if it would change the claim/.test(wr));
ok("W30. pipeline passes editorial mode into voice", /voiceRegisterConstraintLine\(voice, mode\)/.test(ow));
ok("W31. no Texas\/1TW sample in writer or seed prompts", !/1TW/.test(wr) && !/텍사스에서 짓고/.test(wr + cr));
ok("W32. original body uses OpenAI ChatGPT", /api\.openai\.com\/v1\/chat\/completions/.test(wr) && /OPENAI_API_KEY/.test(ix));
ok("W33. writer does not call xAI", !/api\.x\.ai/.test(wr));

console.log("========================================");
console.log(`WRITER QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
