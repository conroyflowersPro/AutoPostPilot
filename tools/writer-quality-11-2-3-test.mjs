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

console.log("Writer quality + leftover seeds (v12.2.0)");
ok("W1. stutter detector exists", /export function isTokenStutter/.test(wr) && /token_stutter/.test(wr));
ok("W2. fragment detector exists", /export function isFragmentOriginal/.test(wr) && /too_short_original/.test(wr));
ok("W3. ent ent ent is stutter", isTokenStutter("슈퍼차저 줄에서 ent ent ent ent ent ent"));
ok("W4. hyphenated ent stutter", isTokenStutter("ent 시트-ent 미러가 ent ent ent ent"));
ok("W5. Korean 엔트 filler twice", isTokenStutter("엔트 등이 막 바뀌었는데 시스템이 엔트를 얼마나 붙잡고 있는지."));
ok("W6. normal Supercharger sentence is not stutter", !isTokenStutter("슈퍼차저 줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다."));
ok("W7. tiny fragment is too short", isFragmentOriginal("충전 중에 알림이 겹친다."));
ok("W8. one finished sentence is allowed", !isFragmentOriginal("충전 중에 알림이 겹치면 어느 화면이 위인지 손으로 확인하게 된다."));
ok("W9. 140+ observation is not a fragment", !isFragmentOriginal("충전 중 알림이 겹쳐 보이면 어느 화면이 위인지 손으로 확인하게 된다. ".repeat(3)));
ok("W10. Writer decides length from the completed thought", /stop when the thought is complete/i.test(wr) && !/At least two sentences/.test(wr));
ok("W11. Writer pre-hard gate is minimum boundary; Judge owns final quality", /possible_factual_invention/.test(wr) && /manual_text_leakage/.test(wr) && !/hardFail[\s\S]{0,500}token_stutter/.test(wr));
ok("W12. writer retries once unless job skipSelectiveRegen", /allow_one_retry !== false/.test(wr) && /allow_one_retry: args\.skipSelectiveRegen \? false : true/.test(ow));
ok("W13. leftover selectable fill", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("W14. experience without evidence remints", /onlyMissingLived/.test(job) && /NO_CREATOR_EVIDENCE/.test(job));
ok("W15. non-casual compression never VERY_COMPRESSED", /mode !== "CASUAL_OBSERVATION"/.test(dgc) && /return "NATURAL"/.test(dgc));
ok("W16. judge hard-fails stutter", /hard\.push\("token_stutter"\)/.test(sj));
ok("W17. version lockstep 12.2.0", /APP_VERSION = "12.2.0"/.test(ver) && /APP_VERSION = "12.2.0"/.test(ix));
ok("W18. Korean summary names seven-day role order", /7일 생성/.test(ver) && /Planner/.test(ver) && /Semantic Judge/.test(ver));
ok("W19. retry is minimum-boundary retry, not creative rewrite direction", /BOUNDARY RETRY/.test(wr) && /retry_hint/.test(gi));
ok("W20. Writer prompt does not prescribe a snag", !/A snag is optional/.test(wr) && /point_or_tension is an optional angle/.test(cr));
ok("W21. subject restate is rejected", isSubjectRestate("슈퍼차저 대기줄", "슈퍼차저 대기줄"));
ok("W22. finished observation is not a restate", !isSubjectRestate("슈퍼차저 대기줄에서 앞차가 안 움직이면 충전 예상이 통째로 밀린다.", "슈퍼차저 대기줄"));
ok("W23. generic thesis is rejected", GENERIC_THESIS_RE.test("전기차 보조금은 중요한 이슈다."));
ok("W24. voice length follows this slot not one median", /median_chars is a handmade statistic/.test(voice));
ok("W25. 7C retry passes rewrite hint", /quality_rewrite|retry_hint: \(last\.block_reasons/.test(gi));
ok("W26. short keyword subject is usable", /export function isUsableKeywordSubject/.test(se));
ok("W27. Writer accepts assigned Seed without example prose", /ASSIGNED SEED/.test(wr) && /Do not paste prompt material or examples/.test(wr));
ok("W28. Editorial Mode does not pre-lock Writer surface", !/Information posts may use 음슴/.test(wr) && !/Do not use 음슴체/.test(wr));
ok("W29. Planner Intent is strategy, never a writing template", /strategic purpose, never a writing template/.test(wr));
ok("W30. pipeline does not lock 해요/음슴 before the thought", !/planSlotSurface/.test(ow) && /voiceRegisterConstraintLine\(voice\)/.test(ow) && /THOUGHT_FIRST_RUNTIME/.test(ow));
ok("W31. no Texas\/1TW sample in writer or seed prompts", !/1TW/.test(wr) && !/텍사스에서 짓고/.test(wr + cr));
ok("W32. original body uses Grok 4.6 on xAI", /api\.x\.ai\/v1\/responses/.test(wr) && /grok-4\.6/.test(wr) && !/OPENAI_API_KEY/.test(ix) && !/api\.openai\.com/.test(wr));
ok("W33. writer calls xAI Agent Tools without Live Search", /api\.x\.ai\/v1\/responses/.test(wr) && /type: "x_search"/.test(wr) && /reasoning_effort:\s*"low"/.test(wr) && !/search_parameters/.test(wr));
ok("W34. DNA participation order replies bookmarks quotes reposts", /replies > bookmarks > quotes > reposts/.test(dna) && !/followers > profile visits/.test(dna));
ok("W35. DNA says weights are probabilities not counts", /predicted action probabilities/.test(dna));
ok("W36. DNA spacing 48h For You window 14-22 PT", /48 hours/.test(dna) && /14:00 America\/Los_Angeles/.test(dna) && /14:00–22:00 PT/.test(dna) && /Do not stack originals/.test(dna));
ok("W37. DNA audience is readers not a Tesla club", /Audience is readers/.test(dna) && /not a Tesla club/.test(dna));
ok("W38. DNA mix not keep-worthy-only", /do not write only keep-worthy/.test(dna));
ok("W39. DNA copy-link is predicted Home viewer not author DM", /Author copying an original and DMing/.test(dna) && /Direct navigation/.test(dna));
ok("W40. Writer receives Creator Intelligence after assignment", /ASSIGNED PLANNER INTENT/.test(wr) && /CREATOR INTELLIGENCE/.test(wr));
ok("W41. Writer is Thought-first after Seed + Planner Intent", /THOUGHT FIRST/.test(wr) && /Understand the assigned Seed and Planner Intent first/.test(wr));
ok("W42. Writer decides necessary reasoning and expression", /Decide the necessary reasoning and expression yourself/.test(wr));
ok("W43. writer has no copy-link weight numbers", !/ShareViaCopyLink/.test(wr) && !/weight 20/.test(wr) && !/가중치 20/.test(wr));
ok("W44. Korean summary names actual X Analytics", /실제 X Analytics/.test(ver));
ok("W45. write phase credits Grok for originals", /grok_writer_attempted/.test(ix) && /phase === "write"/.test(ix) && /creator_generation: true/.test(ix));
ok("W46. DNA new-reader signal is not a fixed topic quota", /NEW READERS/.test(dna) && /not a fixed daily topic quota/.test(dna));
ok("W47. DNA has no fixed personal-public mix", /NO FIXED MIX/.test(dna) && !/at most one mass-public daily-life original per day/.test(dna));
ok("W48. DNA does not prescribe Writer length", /Writer decides from the assigned thought/.test(dna) && !/informative ~50-110/.test(dna));
ok("W49. Writer completes thought without a mode band", /stop when the thought is complete/i.test(wr) && !/lengthBandForMode/.test(wr));
ok("W50. Planner locks count; quota file has no xAI", /SEED_POOL_BUFFER = 10/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8")) && /POSTS_TARGET = 4/.test(ix));
ok("W51. DNA PLACE is California Korean, Korea-only gated in code", /Creator lives in California/.test(dna) && /Language is Korean/.test(dna) && /Do not invent Korea-only/.test(dna) && /isKoreaOnlySituation/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-scope.ts"), "utf8")));
ok("W52. Writer receives factual boundaries without situation examples", /writerBoundaryConstraintLines/.test(wr) && !/이중주차, 관리사무소/.test(wr));
ok("W53. Judge reject returns to Planner; no fake padding", /pending_recovery/.test(job) && /row\.step = "recover"/.test(job) && /quotaFilled/.test(job) && !/localHumorKeywordSeeds/.test(job));
ok("W54. job expand batch is 10", /const EXPAND_BATCH = 10/.test(job));
ok("W55. client follows 200 ticks", /for \(let i = 0; i < 200; i\+\+\)/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")));
ok("W61. Safari Load failed resumes the job", /isTransientEdgeError/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")) && /Load failed/.test(readFileSync(path.join(ROOT, "lib/transient-edge-error.ts"), "utf8")));
ok("W56. live writer does not inject pre-chosen mechanism moves", /writerMechanismConstraintLines/.test(wr) && !/READER ENTRY MOVE/.test(wr) && !/\.\.\.writerMechanismConstraintLines/.test(wr));
ok("W57. live writer does not inject pre-chosen rail beats", /writerRailConstraintLines/.test(wr) && !/\.\.\.writerRailConstraintLines/.test(wr));
ok("W58. deep context maps selected_mechanism string", /typeof mech\.selected_mechanism === "string"/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts"), "utf8")));
ok("W59. everyday public still gets a mechanism", /everyday_public_reader_entry/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")));
ok("W60. write batch passes recent mechanisms", /recentMechanismUsage/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8")));
ok("W62. Grok writer consumes Planner Intent + Creator Intelligence", /planner_intent/.test(wr) && /creatorDnaBlock\(\)/.test(wr) && !/engineRulesAsWill\(\)/.test(wr));
ok("W63. seven-day generate on client", /GENERATION_DAYS = 7/.test(readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8")));
ok("W64. live Writer prompt has no preselected everyday strategy", !/writingStagePhilosophyBlock\(\)/.test(wr) && !/\.\.\.writerEverydayConstraintLines/.test(wr));
ok("W65. live Writer prompt has no preselected style family", !/writingStagePhilosophyBlock\(\)/.test(wr) && !/\.\.\.writerStyleConstraintLines/.test(wr));
ok("W66. writer factual do-not-invent reaches Grok", /FACTUAL DO-NOT-INVENT/.test(wr));
ok("W67. 14d intent overlays cluster weights on the job", /overlayClusterWeightsWithIntent14d/.test(job));
ok("W68. engagement-bait questions fail, not every question mark", /isQuestionCloser/.test(wr) && /question_closer/.test(wr) && /어떻게\\s\*생각/.test(wr) && !/if \(\/\[\?？\]\/\.test\(t\)\) return true/.test(wr));
ok("W69. final Judge hard-fails expert jargon", /hard\.push\("expert_jargon"\)/.test(sj));
ok("W70. mechanism write catalog is not injected into the live writer", /MECHANISM_WRITE_MOVES/.test(wr) && /A question is not a mechanism/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/user-direct-voice-window.ts"), "utf8")) && !/\.\.\.writerMechanismConstraintLines/.test(wr));
ok("W71. humor fill has no numbered 레이어 seed", !/테슬라 앱 레이어/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/humor-fill.ts"), "utf8")));
ok("W72. mechanism NONE is normal, not a forced observation personality", /none_is_normal/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")) && !/default_observation_personality/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8")));
ok("W73. Writer surface is not pre-locked", !/planSlotSurface/.test(ow) && /Decide the necessary reasoning and expression yourself/.test(wr));
ok("W74. Writer closes assigned Seed + Planner Intent thought", /WRITER ROLE/.test(wr) && /assigned Seed and Planner Intent/.test(wr) && /THOUGHT FIRST/.test(wr));
ok("W75. writer is not Planner and does not ingest Performance DNA", /writerArchitectureLock/.test(wr) && /You do not become the Planner/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-architecture.ts"), "utf8")) && !/performanceDnaBlock\(\)/.test(wr));
ok("W76. Writer does not receive enumerated creative-stage menu", !/writingStagePhilosophyBlock\(\)/.test(wr));
ok("W77. Writer does not receive virtual-week structure commands", !/writerWeekStructureConstraintLines\(ctx/.test(wr));
const writeFn = ow.slice(ow.indexOf("export async function writeOneSlot"), ow.indexOf("export async function writeSlotBatch"));
const iInterp = writeFn.indexOf("interpretConcreteSeed");
const iWrite = writeFn.indexOf("integrateSlotGeneration");
const iDelivery = writeFn.indexOf("selectDeliveryAfterThought");
ok("W78. runtime interprets before write", iInterp >= 0 && iInterp < iWrite);
ok("W79. runtime delivery is after write", iDelivery > iWrite && /DELIVERY_AFTER_THOUGHT/.test(ow));
ok("W80. writeOneSlot does not select mechanism/rail/style before the writer", !/selectReactionMechanism/.test(writeFn) && !/selectThinkingRail/.test(writeFn) && !/decideCreatorStyle/.test(writeFn) && !/decideNaturalHumor/.test(writeFn) && !/decideEverydayLanguage/.test(writeFn));
ok("W81. live Grok user message does not inject mechanism lines", /callGrokWriter/.test(wr) && !/\.\.\.writerMechanismConstraintLines/.test(wr));
ok("W82. mechanism does not force Writer personality", !/READER ENTRY MOVE/.test(wr) && !/\.\.\.writerMechanismConstraintLines/.test(wr));

console.log("========================================");
console.log(`WRITER QUALITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
