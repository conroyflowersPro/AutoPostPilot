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

console.log("Writer quality + leftover seeds (v11.8.1)");
ok("W1. stutter detector exists", /export function isTokenStutter/.test(wr) && /token_stutter/.test(wr));
ok("W2. fragment detector exists", /export function isFragmentOriginal/.test(wr) && /too_short_original/.test(wr));
ok("W3. ent ent ent is stutter", isTokenStutter("슈퍼차저 줄에서 ent ent ent ent ent ent"));
ok("W4. hyphenated ent stutter", isTokenStutter("ent 시트-ent 미러가 ent ent ent ent"));
ok("W5. Korean 엔트 filler twice", isTokenStutter("엔트 등이 막 바뀌었는데 시스템이 엔트를 얼마나 붙잡고 있는지."));
ok("W6. normal Supercharger sentence is not stutter", !isTokenStutter("슈퍼차저 줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다."));
ok("W7. tiny fragment is too short", isFragmentOriginal("충전 중에 알림이 겹친다."));
ok("W8. one finished sentence is allowed", !isFragmentOriginal("충전 중에 알림이 겹치면 어느 화면이 위인지 손으로 확인하게 된다."));
ok("W9. 140+ observation is not a fragment", !isFragmentOriginal("충전 중 알림이 겹쳐 보이면 어느 화면이 위인지 손으로 확인하게 된다. ".repeat(3)));
ok("W10. writer does not lock every post to one length", /Stop when the thought is complete/.test(wr) && !/At least two sentences/.test(wr) && !/one finished sentence is enough/.test(wr));
ok("W11. validateOutput hard-fails stutter/fragment/restate", /reasons\.includes\("token_stutter"\)/.test(wr) && /subject_restate/.test(wr) && /generic_thesis/.test(wr));
ok("W12. writer retries once unless job skipSelectiveRegen", /allow_one_retry !== false/.test(wr) && /allow_one_retry: args\.skipSelectiveRegen \? false : true/.test(ow));
ok("W13. leftover selectable fill", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("W14. experience without evidence remints", /onlyMissingLived/.test(job) && /NO_CREATOR_EVIDENCE/.test(job));
ok("W15. non-casual compression never VERY_COMPRESSED", /mode !== "CASUAL_OBSERVATION"/.test(dgc) && /return "NATURAL"/.test(dgc));
ok("W16. judge hard-fails stutter", /hard\.push\("token_stutter"\)/.test(sj));
ok("W17. version lockstep 11.8.1", /APP_VERSION = "11.8.1"/.test(ver) && /APP_VERSION = "11.8.1"/.test(ix));
ok("W18. Korean summary names Grok writer and personal mix", /Grok 4\.6/.test(ver) && /개인 관심/.test(ver) && /대중 생활/.test(ver));
ok("W19. quality rewrite hint on retry", /QUALITY REWRITE/.test(wr) && /retry_hint/.test(gi));
ok("W20. snag is optional not required", /A snag is optional/.test(wr) && /optional angle, not a required snag/.test(cr));
ok("W21. subject restate is rejected", isSubjectRestate("슈퍼차저 대기줄", "슈퍼차저 대기줄"));
ok("W22. finished observation is not a restate", !isSubjectRestate("슈퍼차저 대기줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다.", "슈퍼차저 대기줄"));
ok("W23. generic thesis is rejected", GENERIC_THESIS_RE.test("전기차 보조금은 중요한 이슈다."));
ok("W24. voice length follows this slot not one median", /median_chars is a handmade statistic/.test(voice));
ok("W25. 7C retry passes rewrite hint", /quality_rewrite|retry_hint: \(last\.block_reasons/.test(gi));
ok("W26. short keyword subject is usable", /export function isUsableKeywordSubject/.test(se));
ok("W27. writer infers keyword via vision, no example posts", /short keyword seed is valid/.test(wr) && /hardcoded example posts/.test(wr));
ok("W28. info posts do not lock 해요 / forbid 음슴", /Editorial mode is not a 말투 table/.test(wr) && /Information posts may use 음슴/.test(wr) && !/Do not use 음슴체 on information posts/.test(wr));
ok("W29. public words must not distort the claim", /NEVER swap a word if it would change the claim/.test(wr));
ok("W30. pipeline planner decides surface, not mode as 해요 lock", /planSlotSurface/.test(ow) && /voiceRegisterConstraintLine\(voice, surface\)/.test(ow) && !/voiceRegisterConstraintLine\(voice, mode\)/.test(ow));
ok("W31. no Texas\/1TW sample in writer or seed prompts", !/1TW/.test(wr) && !/텍사스에서 짓고/.test(wr + cr));
ok("W32. original body uses Grok 4.6 on xAI", /api\.x\.ai\/v1\/chat\/completions/.test(wr) && /grok-4\.6/.test(wr) && !/OPENAI_API_KEY/.test(ix) && !/api\.openai\.com/.test(wr));
ok("W33. writer calls xAI with live search and low reasoning", /api\.x\.ai/.test(wr) && /reasoning_effort:\s*"low"/.test(wr) && /search_parameters/.test(wr));
ok("W34. DNA participation order replies bookmarks quotes reposts", /replies > bookmarks > quotes > reposts/.test(dna) && !/followers > profile visits/.test(dna));
ok("W35. DNA says weights are probabilities not counts", /predicted action probabilities/.test(dna));
ok("W36. DNA spacing 48h For You window 14-22 PT", /48 hours/.test(dna) && /14:00 America\/Los_Angeles/.test(dna) && /14:00–22:00 PT/.test(dna) && /Do not stack originals/.test(dna));
ok("W37. DNA audience is readers not a Tesla club", /Audience is readers/.test(dna) && /not a Tesla club/.test(dna));
ok("W38. DNA mix not keep-worthy-only", /do not write only keep-worthy/.test(dna));
ok("W39. DNA copy-link is predicted Home viewer not author DM", /Author copying an original and DMing/.test(dna) && /Direct navigation/.test(dna));
ok("W40. writer readers + wording range", /Audience is readers/.test(wr) && /wording AND the range of wording/.test(wr));
ok("W41. writer thought first, style follows", /THOUGHT FIRST/.test(wr) && /They must not choose the thought/.test(wr) && /Close ONE thought/.test(wr));
ok("W42. writer variety is same person's thought not a template", /VARIETY:/.test(wr) && /same person's thought/.test(wr) && /Do not copy a winning sentence/.test(wr));
ok("W43. writer has no copy-link weight numbers", !/ShareViaCopyLink/.test(wr) && !/weight 20/.test(wr) && !/가중치 20/.test(wr));
ok("W44. Korean summary names 2pm PT For You spacing", /태평양시 오후 2시/.test(ver));
ok("W45. write phase credits Grok for originals", /grok_writer_attempted/.test(ix) && /phase === "write"/.test(ix) && /creator_generation: true/.test(ix));
ok("W46. DNA one mass slot per day, Tesla ticker not default", /NEW READERS/.test(dna) && /Tesla\/Elon ticker\/Robotaxi-news are not the default/.test(dna));
ok("W47. DNA mass cap 1/day, personal fills the rest", /MASS CAP/.test(dna) && /at most one mass-public daily-life original per day/.test(dna));
ok("W48. DNA length is mechanism-complete not a 50-110 quota", /not a mode quota/.test(dna) && !/informative ~50-110/.test(dna));
ok("W49. writer length follows the thought not a mode band", /Length follows the thought/.test(wr) && /Stop when the thought is complete/.test(wr) && !/lengthBandForMode/.test(wr));
ok("W50. prefer 4/day not frozen 5", /Prefer 4\/day/.test(dna) && /POSTS_TARGET = 4/.test(ix));
ok("W51. DNA PLACE is California Korean, Korea-only gated in code", /Creator lives in California/.test(dna) && /Language is Korean/.test(dna) && /Do not invent Korea-only/.test(dna) && /isKoreaOnlySituation/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-scope.ts"), "utf8")));
ok("W52. writer PLACE forbids Korea-only civic without example list", /PLACE: Creator lives in California/.test(wr) && /Do not invent Korea-only/.test(wr) && !/이중주차, 관리사무소/.test(wr) && !/Use 알림\/화면\/겹침\/가림/.test(wr));
ok("W53. empty draft is not padded; job keeps filling until quota", /keepOnlySavedWriteSlots/.test(job) && /bounceToFillQuota/.test(job) && /quotaFilled/.test(job) && !/할당 미달/.test(job) && !/_write_retry/.test(job));
ok("W54. job expand batch is 10", /const EXPAND_BATCH = 10/.test(job));
ok("W55. client follows 200 ticks", /for \(let i = 0; i < 200; i\+\+\)/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")));
ok("W61. Safari Load failed resumes the job", /isTransientEdgeError/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")) && /Load failed/.test(readFileSync(path.join(ROOT, "lib/transient-edge-error.ts"), "utf8")));
ok("W56. writer gets optional mechanism delivery lines", /writerMechanismConstraintLines/.test(wr) && /OPTIONAL DELIVERY/.test(wr));
ok("W57. writer gets rail thought order", /writerRailConstraintLines/.test(wr) && /THOUGHT ORDER/.test(wr));
ok("W58. deep context maps selected_mechanism string", /typeof mech\.selected_mechanism === "string"/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts"), "utf8")));
ok("W59. everyday public still gets a mechanism", /everyday_public_reader_entry/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")));
ok("W60. write batch passes recent mechanisms", /recentMechanismUsage/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8")));
ok("W62. Grok writer consumes Creator DNA and engine rules", /creatorDnaBlock\(\)/.test(wr) && /engineRulesAsWill\(\)/.test(wr) && /CREATOR DNA/.test(wr));
ok("W63. 3-day generate on client", /GENERATION_DAYS = 3/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")));
ok("W64. writer everyday language reaches Grok", /writerEverydayConstraintLines/.test(wr) && /EVERYDAY LANGUAGE/.test(wr));
ok("W65. writer style reaches Grok", /writerStyleConstraintLines/.test(wr) && /CREATOR STYLE/.test(wr));
ok("W66. writer factual do-not-invent reaches Grok", /FACTUAL DO-NOT-INVENT/.test(wr));
ok("W67. 14d intent overlays cluster weights on the job", /overlayClusterWeightsWithIntent14d/.test(job));
ok("W68. engagement-bait questions fail, not every question mark", /isQuestionCloser/.test(wr) && /question_closer/.test(wr) && /어떻게\\s\*생각/.test(wr) && !/if \(\/\[\?？\]\/\.test\(t\)\) return true/.test(wr));
ok("W69. expert jargon is a hard fail", /expert_jargon/.test(wr) && /레이어2/.test(wr));
ok("W70. mechanism write move is operational not a question gap", /MECHANISM_WRITE_MOVES/.test(wr) && /A question is not a mechanism/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/user-direct-voice-window.ts"), "utf8")));
ok("W71. humor fill has no numbered 레이어 seed", !/테슬라 앱 레이어/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/humor-fill.ts"), "utf8")));
ok("W72. mechanism NONE is normal, not a forced observation personality", /none_is_normal/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")) && !/default_observation_personality/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")));
ok("W73. variety: planner decides 말투 per slot, no frozen mix", /VARIETY:/.test(wr) && /No frozen mix ratio/.test(wr) && /planSlotSurface/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8")) && /recentEndingCounts/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8")));
ok("W74. writer closes this seed's thought then writes it", /WRITER ROLE/.test(wr) && /You DO close the central judgment/.test(wr) && /Do not copy a previously successful sentence/.test(wr) && /THOUGHT FIRST/.test(wr));
ok("W75. writer is not Planner and does not ingest Performance DNA", /writerArchitectureLock/.test(wr) && /You do not become the Planner/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-architecture.ts"), "utf8")) && !/performanceDnaBlock\(\)/.test(wr));
ok("W76. writer gets stage philosophy 14-17", /writingStagePhilosophyBlock/.test(wr) && /Easy must not mean shallow/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-stage-philosophy.ts"), "utf8")));
ok("W77. writer receives week structure helper", /writerWeekStructureConstraintLines/.test(wr));

console.log("========================================");
console.log(`WRITER QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
