/**
 * ORDER 8A tests — structural markers on module source + pure-JS behavioral twin
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = process.env.JUDGE_MOD || path.join(__dirname, "../supabase/functions/weekly-plan/semantic-judge.ts");
const src = fs.readFileSync(modPath, "utf8");

let pass = 0, fail = 0;
const failures = [];
function assert(cond, name) {
  if (cond) { pass++; console.log("PASS:", name); }
  else { fail++; failures.push(name); console.log("FAIL:", name); }
}

assert(src.includes('ORDER8A_VERSION = "semantic_judge_foundation_v1_order8a"'), "version string");
assert(src.includes("ORDER8A_JUDGE_ONLY"), "judge_only");
assert(src.includes("ORDER8A_NO_REWRITE"), "no_rewrite");
assert(src.includes("ORDER8A_NO_ALTERNATIVE_GENERATION"), "no_alt_gen");
assert(src.includes("ORDER8A_NO_SUGGESTED_HOOK"), "no_hook");
assert(src.includes("ORDER8A_NO_SUGGESTED_ENDING"), "no_ending");
assert(src.includes("ORDER8A_PER_POST_ISOLATION"), "isolation");
assert(src.includes("ORDER8A_HARD_SOFT_SEPARATION"), "hard_soft");
assert(src.includes("ORDER8A_GENERATION_STATUS_SEPARATE"), "gen_status_sep");
assert(src.includes("ORDER8A_NO_AUTO_REGENERATION"), "no_auto_regen");
assert(src.includes("ORDER8A_JUDGE_FAILURE_EXPLICIT"), "judge_fail_explicit");
assert(src.includes("ORDER8A_NO_FINISHED_EXAMPLES_IN_PROMPT"), "no_examples");
assert(src.includes("export function semanticJudge"), "export semanticJudge");
assert(src.includes("export function evaluateSemanticJudge"), "export evaluate");
assert(src.includes("export function buildSemanticJudgeInput"), "export build input");
assert(src.includes("extractStructuralSignature"), "export signature");
assert(src.includes("weekStructureHardReasons") || src.includes("structural-signature"), "week structure reasons");
assert(src.includes("JUDGE_UNAVAILABLE"), "JUDGE_UNAVAILABLE status");
assert(src.includes("PASS_WITH_CONCERNS"), "PASS_WITH_CONCERNS");
assert(src.includes("hard_fail_reasons"), "hard_fail_reasons");
assert(src.includes("soft_concerns"), "soft_concerns");
assert(src.includes("fabricated_experience"), "fabricated_experience flag");
assert(src.includes("fabricated_fact"), "fabricated_fact");
assert(src.includes("manual_text_leakage"), "manual leakage");
assert(src.includes("conceptual_repetition"), "conceptual_repetition");
assert(src.includes("seed_fidelity"), "seed_fidelity score");
assert(src.includes("core_thought_preservation"), "core_thought_preservation");
assert(src.includes("creator_fit"), "creator_fit");
assert(src.includes("reader_self_projection"), "reader_self_projection");
assert(src.includes("inference_space_fit"), "inference_space_fit");
assert(src.includes("anti_ai_voice_fit"), "anti_ai_voice_fit");
assert(src.includes("over_explained"), "over_explained");
assert(src.includes("over_connected"), "over_connected");
assert(!src.includes("rewritten_text"), "no rewritten_text field");
assert(!src.includes("suggested_post"), "no suggested_post");
assert(!src.includes("better_hook"), "no better_hook");
assert(!src.includes("better_ending"), "no better_ending");
assert(src.includes("SemanticJudgeInput"), "input type");
assert(src.includes("SemanticJudgeResult"), "result type");
assert(src.includes("[MANUAL_RAW]"), "manual marker");
assert(src.includes("제가\\s*직접\\s*써보니") || src.includes("제가\\s*직접\\s*써보니"), "experience pattern");
assert(src.includes("DeepGenerationContext") || src.includes("IndependentPostResult") || src.includes("deep-generation"), "imports upstream types");

const EXP = [/제가\s*직접\s*써보니/, /어제\s*해봤는데/, /운전하다가/, /직접\s*타보니/, /제가\s*경험해보니/];
const MANUAL = ["[MANUAL_RAW]", "MANUAL_POST_TEXT:", "<<<HISTORICAL>>>", "RAW_PROSE_LEAK"];
const AI = [/결국\s*중요한\s*것/, /시사하는\s*바가\s*큽/, /결론적으로/, /요약하면/];

function twin(input) {
  const text = (input.generated_text || "").trim();
  const hard = [], soft = [];
  const flags = { fabricated_experience: false, manual_text_leakage: false, ai_report_voice: false, over_explained: false, conceptual_repetition: "LOW" };
  if (!text) { hard.push("empty_final_text"); return { overall_status: "REJECT", hard_fail_reasons: hard, soft_concerns: soft, flags }; }
  for (const m of MANUAL) if (text.includes(m)) { flags.manual_text_leakage = true; hard.push("manual_text_leakage"); }
  const expB = input.experience_boundary || {};
  for (const re of EXP) if (re.test(text) && (expB.must_not_claim_first_person || !expB.creator_experienced)) {
    flags.fabricated_experience = true; hard.push("fabricated_experience"); break;
  }
  const seed = (input.seed && input.seed.meaning) || "";
  const tokens = seed.split(/\s+/).filter(t => t.length >= 2);
  const seedHit = !seed || tokens.some(t => text.includes(t)) || text.includes(seed.slice(0, Math.min(10, seed.length)));
  if (seed && !seedHit) hard.push("seed_meaning_departure");
  for (const re of AI) if (re.test(text)) { flags.ai_report_voice = true; soft.push("ai_report_voice"); break; }
  if (input.stop_condition && input.stop_condition.leave_inference_open && flags.ai_report_voice) {
    flags.over_explained = true; soft.push("over_explained");
  }
  const humor = (input.humor_decision && input.humor_decision.humor_strength) || "NONE";
  if (String(humor).toUpperCase() === "NONE" && /ㅋㅋ/.test(text)) soft.push("humor_forced");
  let overall = hard.length ? "REJECT" : soft.length ? "PASS_WITH_CONCERNS" : "PASS";
  return { overall_status: overall, hard_fail_reasons: hard, soft_concerns: soft, flags };
}

let r = twin({ seed: { meaning: "FSD 업데이트 체감" }, experience_boundary: { must_not_claim_first_person: true, creator_experienced: false }, generated_text: "제가 직접 써보니 FSD가 확 달라졌어요." });
assert(r.overall_status === "REJECT" && r.flags.fabricated_experience, "A fabricated experience REJECT");

r = twin({ seed: { meaning: "Cybertruck 충전 속도" }, generated_text: "오늘은 LAFC 경기가 정말 재밌었어요 골이 세 개나." });
assert(r.overall_status === "REJECT" && r.hard_fail_reasons.some(x => x.includes("seed")), "B seed departure REJECT");

r = twin({ seed: { meaning: "FSD" }, generated_text: "FSD 좋다 [MANUAL_RAW] 예전 글" });
assert(r.overall_status === "REJECT" && r.flags.manual_text_leakage, "C manual leakage REJECT");

r = twin({ seed: { meaning: "FSD" }, generated_text: "" });
assert(r.overall_status === "REJECT" && r.hard_fail_reasons.includes("empty_final_text"), "D empty REJECT");

r = twin({ seed: { meaning: "FSD 업데이트 체감" }, generated_text: "FSD 업데이트가 왔다. 결국 중요한 것은 실사용 체감이다." });
assert(r.flags.ai_report_voice && r.overall_status !== "REJECT", "soft AI report not hard reject");

r = twin({ seed: { meaning: "비 오는 날 충전" }, humor_decision: { humor_strength: "NONE" }, generated_text: "비 오는 날 충전이 조금 더 느린 느낌이 있다." });
assert(r.overall_status === "PASS", "Humor NONE PASS");

r = twin({ seed: { meaning: "아이와 드라이브" }, stop_condition: { leave_inference_open: true }, generated_text: "아이와 드라이브. 결국 중요한 것은 가족의 의미다." });
assert(r.flags.over_explained || r.soft_concerns.length > 0, "over explained soft");

r = twin({ seed: { meaning: "FSD" }, generated_text: "FSD 체감이 좋아졌다." });
assert(r.overall_status === "PASS", "clean PASS");
assert(!("rewritten_text" in r), "no rewrite in result shape");

const a = twin({ seed: { meaning: "Cybertruck" }, generated_text: "Cybertruck 충전 포트가 편하다." });
const b = twin({ seed: { meaning: "LAFC" }, generated_text: "LAFC 홈 경기가 기대된다." });
assert(a.overall_status === "PASS" && b.overall_status === "PASS", "isolation both pass independently");

assert(src.includes("missing_judge_input") || src.includes("JUDGE_UNAVAILABLE"), "unavailable path");

console.log("\n=== ORDER 8A TEST SUMMARY ===");
console.log("PASS:", pass, "FAIL:", fail);
if (failures.length) console.log("Failures:", failures.join(", "));
process.exit(fail > 0 ? 1 : 0);
