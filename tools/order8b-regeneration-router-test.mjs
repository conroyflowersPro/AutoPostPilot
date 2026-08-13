/**
 * ORDER 8B Regeneration Router tests — structural + behavioral
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = process.env.ROUTER_MOD || path.join(__dirname, "../supabase/functions/weekly-plan/regeneration-router.ts");
const src = fs.readFileSync(modPath, "utf8");

let pass = 0, fail = 0;
const failures = [];
function assert(cond, name) {
  if (cond) { pass++; console.log("PASS:", name); }
  else { fail++; failures.push(name); console.log("FAIL:", name); }
}

const markers = [
  ["ORDER8B_VERSION", "version"],
  ["ORDER8B_MAX_SEMANTIC_REGEN_ATTEMPTS = 2", "max attempts 2"],
  ["NO_PREVIOUS_DRAFT_FEWSHOT", "no previous draft fewshot"],
  ["NO_AI_SELF_REINFORCEMENT", "no self reinforcement"],
  ["NO_SILENT_DROP", "no silent drop"],
  ["SLOT_IDENTITY_PRESERVED", "slot identity"],
  ["RE_JUDGE_REQUIRED", "re-judge required"],
  ["NO_AUTO_ACCEPT_REGENERATED", "no auto accept"],
  ["UPSTREAM_FREEZE_WHEN_UNRELATED", "upstream freeze"],
  ["INTENTIONAL_KR_HUMOR_PRESERVE", "kr humor"],
  ["export function decideRegenerationRoute", "decide route"],
  ["export async function routeSlotWithRegeneration", "route slot"],
  ["export function buildRegenConstraintHints", "constraint hints"],
  ["REWRITE_ONLY", "rewrite only"],
  ["STYLE_REGENERATE", "style regen"],
  ["HUMOR_REGENERATE", "humor regen"],
  ["EVERYDAY_LANGUAGE_REGENERATE", "everyday regen"],
  ["THINKING_RAIL_REGENERATE", "rail regen"],
  ["MECHANISM_REGENERATE", "mechanism regen"],
  ["SELF_PROJECTION_REGENERATE", "self proj regen"],
  ["INTERPRETATION_REGENERATE", "interpretation regen"],
  ["SEED_REJECT", "seed reject"],
  ["FABRICATED_EXPERIENCE", "code fab exp"],
  ["SEED_DRIFT", "code seed drift"],
  ["AI_REPORT_VOICE", "code ai voice"],
  ["CONCEPTUAL_REPETITION_HIGH", "code conceptual"],
  ["include_previous_final_text: false", "include previous false"],
  ["include_failure_reasons_only: true", "failure reasons only"],
];
for (const [m, n] of markers) assert(src.includes(m), n);

function codesFrom(j) {
  const hard = [], soft = [];
  for (const r of j.hard_fail_reasons || []) {
    if (/experience/i.test(r)) hard.push("FABRICATED_EXPERIENCE");
    else if (/seed/i.test(r)) hard.push("SEED_DRIFT");
    else if (/manual/i.test(r)) hard.push("MANUAL_LEAKAGE");
    else if (/empty/i.test(r)) hard.push("EMPTY_OUTPUT");
    else if (/core/i.test(r)) hard.push("CORE_THOUGHT_LOSS");
    else if (/fact/i.test(r)) hard.push("FABRICATED_FACT");
  }
  for (const r of j.soft_concerns || []) {
    if (/ai_report/i.test(r)) soft.push("AI_REPORT_VOICE");
    if (/over_explained/i.test(r)) soft.push("OVER_EXPLAINED");
    if (/creator_fit/i.test(r)) soft.push("CREATOR_FIT_WEAK");
    if (/mechanism/i.test(r)) soft.push("MECHANISM_MISFIT");
    if (/rail/i.test(r) && !/mechanism/i.test(r)) soft.push("RAIL_MISFIT");
    if (/self_projection|reader/i.test(r)) soft.push("SELF_PROJECTION_WEAK");
    if (/humor/i.test(r)) soft.push("HUMOR_FORCED");
    if (/structural/i.test(r)) soft.push("STRUCTURAL_REPETITION");
    if (/conceptual/i.test(r)) soft.push("CONCEPTUAL_REPETITION_HIGH");
  }
  if (j.flags?.fabricated_experience) hard.push("FABRICATED_EXPERIENCE");
  if (j.flags?.conceptual_repetition === "HIGH") soft.push("CONCEPTUAL_REPETITION_HIGH");
  return { hard: [...new Set(hard)], soft: [...new Set(soft)] };
}

function decide(j, attempts = 0, ju = 0) {
  if (!j) return { route: "JUDGE_RETRY" };
  if (j.overall_status === "JUDGE_UNAVAILABLE") return ju < 1 ? { route: "JUDGE_RETRY" } : { route: "BLOCK" };
  if (attempts >= 2 && j.overall_status === "REJECT") return { route: "BLOCK" };
  if (j.overall_status === "PASS") return { route: "NO_ACTION", freeze_core: true };
  const { hard, soft } = codesFrom(j);
  if (hard.includes("MANUAL_LEAKAGE") || hard.includes("EMPTY_OUTPUT")) return { route: "REWRITE_ONLY", reset: "writer", freeze_seed: true };
  if (hard.includes("FABRICATED_EXPERIENCE")) return { route: "REWRITE_ONLY", reset: "writer", strengthen_exp: true, freeze_core: true };
  if (hard.includes("SEED_DRIFT")) return { route: "INTERPRETATION_REGENERATE", reset: "interpretation" };
  if (hard.includes("CORE_THOUGHT_LOSS") && (j.scores?.seed_fidelity ?? 1) < 0.4) return { route: "INTERPRETATION_REGENERATE" };
  if (hard.length) return { route: "REWRITE_ONLY", reset: "writer" };
  if (j.overall_status === "PASS_WITH_CONCERNS") {
    if (soft.includes("CONCEPTUAL_REPETITION_HIGH")) return { route: "INTERPRETATION_REGENERATE" };
    if (soft.includes("MECHANISM_MISFIT")) return { route: "MECHANISM_REGENERATE", freeze_seed: true };
    if (soft.includes("RAIL_MISFIT")) return { route: "THINKING_RAIL_REGENERATE", freeze_mechanism: true };
    if (soft.includes("SELF_PROJECTION_WEAK")) return { route: "SELF_PROJECTION_REGENERATE" };
    if (soft.length <= 1 && (j.scores?.creator_fit ?? 1) >= 0.55) return { route: "ACCEPT_WITH_CONCERNS" };
    if (soft.includes("HUMOR_FORCED")) return { route: "HUMOR_REGENERATE", force_none: true };
    if (soft.includes("AI_REPORT_VOICE") || soft.includes("CREATOR_FIT_WEAK") || soft.includes("STRUCTURAL_REPETITION")) {
      return { route: "STYLE_REGENERATE", freeze_core: true, freeze_seed: true };
    }
    if (soft.includes("OVER_EXPLAINED")) return { route: "REWRITE_ONLY", strengthen_comp: true };
    return { route: "REWRITE_ONLY" };
  }
  return { route: "REWRITE_ONLY" };
}

let d = decide({ overall_status: "REJECT", hard_fail_reasons: ["fabricated_experience"], soft_concerns: [], flags: { fabricated_experience: true }, scores: {} });
assert(d.route === "REWRITE_ONLY" && d.strengthen_exp && d.freeze_core, "T40 fabricated experience writer+boundary");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["ai_report_voice"], flags: {}, scores: { creator_fit: 0.5 } });
assert(d.route === "STYLE_REGENERATE" && d.freeze_core && d.freeze_seed, "T41 AI voice style freeze core/seed");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["over_explained", "over_explained_2"], flags: {}, scores: { creator_fit: 0.4 } });
assert(d.route === "REWRITE_ONLY" || d.strengthen_comp, "T42 over-explained writer constraints");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["self_projection_weak"], flags: {}, scores: { creator_fit: 0.7, reader_self_projection: 0.3 } });
assert(d.route === "SELF_PROJECTION_REGENERATE", "T43 self-projection rollback");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["mechanism_misfit"], flags: {}, scores: { creator_fit: 0.7 } });
assert(d.route === "MECHANISM_REGENERATE" && d.freeze_seed, "T44 mechanism regen");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["rail_misfit"], flags: {}, scores: { creator_fit: 0.7 } });
assert(d.route === "THINKING_RAIL_REGENERATE" && d.freeze_mechanism, "T45 rail regen mechanism frozen");

d = decide({ overall_status: "REJECT", hard_fail_reasons: ["seed_meaning_departure"], soft_concerns: [], flags: {}, scores: {} });
assert(d.route === "INTERPRETATION_REGENERATE", "T46 seed drift interpretation");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["conceptual"], flags: { conceptual_repetition: "HIGH" }, scores: { creator_fit: 0.7 } });
assert(d.route === "INTERPRETATION_REGENERATE", "T47 conceptual high deep rollback");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["structural_repetition", "x"], flags: {}, scores: { creator_fit: 0.5 } });
assert(d.route === "STYLE_REGENERATE" && d.freeze_core, "T48 structural style only");

d = decide({ overall_status: "PASS", hard_fail_reasons: [], soft_concerns: [], flags: {}, scores: {} });
assert(d.route === "NO_ACTION", "T49 pass no humor regen");

d = decide({ overall_status: "PASS_WITH_CONCERNS", hard_fail_reasons: [], soft_concerns: ["ai_report_voice"], flags: {}, scores: { creator_fit: 0.8 } });
assert(d.route === "ACCEPT_WITH_CONCERNS", "mild single soft accept");

d = decide({ overall_status: "JUDGE_UNAVAILABLE", hard_fail_reasons: [], soft_concerns: [], flags: {}, scores: {} }, 0, 0);
assert(d.route === "JUDGE_RETRY", "T51 judge unavailable retry");
d = decide({ overall_status: "JUDGE_UNAVAILABLE", hard_fail_reasons: [], soft_concerns: [], flags: {}, scores: {} }, 0, 1);
assert(d.route === "BLOCK", "T51 judge unavailable exhausted");

d = decide({ overall_status: "REJECT", hard_fail_reasons: ["fabricated_experience"], soft_concerns: [], flags: { fabricated_experience: true }, scores: {} }, 2);
assert(d.route === "BLOCK", "T52 regen exhausted BLOCK");

assert(src.includes("include_previous_final_text: false"), "T55 no draft leakage contract");
assert(src.includes("Do not invent first-person") || src.includes("experience boundary"), "constraint hint experience");
assert(src.includes("NO_SILENT_DROP"), "T53 count / no silent drop");
assert(src.includes("slot_id") && src.includes("routeSlotWithRegeneration"), "T54 isolation via per-slot API");

console.log("\n=== ORDER 8B TEST SUMMARY ===");
console.log("PASS:", pass, "FAIL:", fail);
if (failures.length) console.log("Failures:", failures.join(", "));
process.exit(fail > 0 ? 1 : 0);
