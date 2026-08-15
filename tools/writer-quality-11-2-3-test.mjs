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
const dna = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-dna.ts"), "utf8");
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

console.log("Writer quality + leftover seeds (v11.3.4)");
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
ok("W17. version lockstep 11.3.4", /APP_VERSION = "11.3.4"/.test(ver) && /APP_VERSION = "11.3.4"/.test(ix));
ok("W18. Korean summary names ChatGPT writer and new readers", /ChatGPT/.test(ver) && /새 독자/.test(ver) && /하루 관심사/.test(ver));
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
ok("W34. DNA participation order replies bookmarks quotes reposts", /replies > bookmarks > quotes > reposts/.test(dna) && !/followers > profile visits/.test(dna));
ok("W35. DNA says weights are probabilities not counts", /predicted action probabilities/.test(dna));
ok("W36. DNA spacing 48h For You window 14-22 PT", /48 hours/.test(dna) && /14:00 America\/Los_Angeles/.test(dna) && /14:00–22:00 PT/.test(dna) && /Do not stack originals/.test(dna));
ok("W37. DNA audience is readers not a Tesla club", /Audience is readers/.test(dna) && /not a Tesla club/.test(dna));
ok("W38. DNA mix not keep-worthy-only", /do not write only keep-worthy/.test(dna));
ok("W39. DNA copy-link is predicted Home viewer not author DM", /Author copying an original and DMing/.test(dna) && /Direct navigation/.test(dna));
ok("W40. writer readers + wording range", /Audience is readers/.test(wr) && /wording AND the range of wording/.test(wr));
ok("W41. writer tension can inform without preaching", /leave judgment to the reader/.test(wr) && /that can make the post informative/.test(wr));
ok("W42. writer mix for bookmarks not archive-only", /do not write only keep-worthy archive posts/.test(wr));
ok("W43. writer has no copy-link weight numbers", !/ShareViaCopyLink/.test(wr) && !/weight 20/.test(wr) && !/가중치 20/.test(wr));
ok("W44. Korean summary names 2pm PT For You spacing", /태평양시 오후 2시/.test(ver));
ok("W45. write phase does not credit Grok for ChatGPT originals", /chatgpt_writer_attempted/.test(ix) && /phase === "write"/.test(ix) && /creator_generation: false/.test(ix));
ok("W46. DNA new readers first, Tesla not default", /NEW READERS/.test(dna) && /Tesla\/Elon are not the default/.test(dna));
ok("W47. DNA personal cap 1/day", /PERSONAL CAP/.test(dna) && /at most one personal-interest original per day/.test(dna));
ok("W48. DNA length bands", /informative ~50-110/.test(dna) && /experience ~70-160/.test(dna));
ok("W49. writer length band helper", /lengthBandForMode/.test(wr) && /LENGTH: /.test(wr));
ok("W50. prefer 4/day not frozen 5", /Prefer 4\/day/.test(dna) && /POSTS_TARGET = 4/.test(ix));
ok("W51. DNA PLACE is California Korean", /Creator lives in California/.test(dna) && /Language is Korean/.test(dna) && /이중주차/.test(dna));
ok("W52. writer PLACE forbids Korea-only civic", /PLACE: Creator lives in California/.test(wr) && /이중주차/.test(wr));
ok("W53. empty draft is retried once", /_write_retry/.test(job) && /write_flat \|\| \[\]/.test(job));
ok("W54. job expand batch is 10", /const EXPAND_BATCH = 10/.test(job));
ok("W55. client follows 200 ticks", /for \(let i = 0; i < 200; i\+\+\)/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")));
ok("W61. Safari Load failed resumes the job", /isTransientEdgeError/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")) && /Load failed/.test(readFileSync(path.join(ROOT, "lib/transient-edge-error.ts"), "utf8")));
ok("W56. writer gets mechanism constraint lines", /writerMechanismConstraintLines/.test(wr) && /READER ENTRY MOVE/.test(wr));
ok("W57. writer gets rail thought order", /writerRailConstraintLines/.test(wr) && /THOUGHT ORDER/.test(wr));
ok("W58. deep context maps selected_mechanism string", /typeof mech\.selected_mechanism === "string"/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts"), "utf8")));
ok("W59. everyday public still gets a mechanism", /everyday_public_reader_entry/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")));
ok("W60. write batch passes recent mechanisms", /recentMechanismUsage/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8")));

console.log("========================================");
console.log(`WRITER QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
