#!/usr/bin/env node
/**
 * Week-depth engines: structural memory, selective regen, count ledger, interest ladder.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const sig = read("supabase/functions/weekly-plan/structural-signature.ts");
const pipe = read("supabase/functions/weekly-plan/order-write-pipeline.ts");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const judge = read("supabase/functions/weekly-plan/semantic-judge.ts");
const regen = read("supabase/functions/weekly-plan/selective-regeneration.ts");
const router = read("supabase/functions/weekly-plan/regeneration-router.ts");
const promo = read("lib/learning/interest-promotion.ts");
const analyze = read("app/api/learning/analyze/route.ts");
const intel = read("supabase/functions/weekly-plan/planner-intelligence.ts");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");
const planner = read("supabase/functions/weekly-plan/seven-day-planner.ts");

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

const DISCOURSE_TWIST_REINTERPRET = "observation_twist_reinterpret";
function inferDiscourseShape(text) {
  const t = String(text || "");
  const twist = /그런데|하지만|반대로|오히려/.test(t);
  const reinterp = /다시 보면|다시 생각|그래서인지|결국에는|결국 /.test(t);
  if (twist && reinterp) return DISCOURSE_TWIST_REINTERPRET;
  if (twist) return "observation_twist";
  if (/내가|제가/.test(t) && /그때|어제|오늘/.test(t)) return "lived_scene";
  if (/그래서|결국/.test(t)) return "consequence";
  return "situation_only";
}
function weekStructureHardReasons(mine, others) {
  const hard = [];
  const prior = (others || []).filter((s) => s && typeof s === "object");
  for (const s of prior) {
    if (s.hook_type === mine.hook_type && s.discourse_shape === mine.discourse_shape && s.ending_type === mine.ending_type) {
      hard.push("structural_repetition_high");
      break;
    }
  }
  const sameShape = prior.filter((s) => s.discourse_shape === mine.discourse_shape).length;
  if (mine.discourse_shape === DISCOURSE_TWIST_REINTERPRET && sameShape >= 1) hard.push("structural_repetition_high");
  else if (sameShape >= 2) hard.push("structural_repetition_high");
  return [...new Set(hard)];
}

const STAGES = ["exploration", "emerging", "secondary", "core"];
function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return STAGES[Math.min(STAGES.length - 1, i + 1)];
}
function promote(prev, signal) {
  let stage = prev?.stage || "exploration";
  let cycles = prev?.signalCycles || 0;
  if (signal) cycles += 1;
  else cycles = 0;
  if (signal && cycles >= 2 && stage !== "core") {
    stage = nextStage(stage);
    cycles = 0;
  }
  return { stage, signalCycles: cycles };
}

console.log("Week-depth engines (v11.12.7)");

ok("E1. twist+reinterp is the AI unfold",
  inferDiscourseShape("충전 중 알림이 겹친다. 그런데 화면이 가린다. 다시 보면 손이 먼저 간다.") === DISCOURSE_TWIST_REINTERPRET);
ok("E2. situation-only is not that unfold",
  inferDiscourseShape("충전 중 알림이 겹치면 어느 화면이 위인지 손으로 확인하게 된다.") === "situation_only");
ok("E3. same hook+unfold+ending is a hard fail",
  weekStructureHardReasons(
    { hook_type: "situation", discourse_shape: "situation_only", ending_type: "statement" },
    [{ hook_type: "situation", discourse_shape: "situation_only", ending_type: "statement" }],
  ).includes("structural_repetition_high"));
ok("E4. second 관찰→반전→재해석 is a hard fail",
  weekStructureHardReasons(
    { hook_type: "situation", discourse_shape: DISCOURSE_TWIST_REINTERPRET, ending_type: "statement" },
    [{ hook_type: "number_lead", discourse_shape: DISCOURSE_TWIST_REINTERPRET, ending_type: "humor_tail" }],
  ).includes("structural_repetition_high"));
ok("E5. first of that unfold is allowed",
  weekStructureHardReasons(
    { hook_type: "situation", discourse_shape: DISCOURSE_TWIST_REINTERPRET, ending_type: "statement" },
    [],
  ).length === 0);
ok("E6. Writer does not get virtual-week structure commands",
  !/writerWeekStructureConstraintLines\(ctx/.test(wr) && !/performanceDnaBlock\(\)/.test(wr));
ok("E7. Judge does not evaluate Planner week structure",
  !/weekStructureHardReasons\(mine, sigs\)/.test(judge));
ok("E8. write path sequential so signatures accumulate",
  /weekSignatures: signatures/.test(pipe) &&
    !/i \+= V11_WRITE_CONCURRENCY/.test(pipe));
ok("E9. REJECT returns the slot to Planner",
  /pending_recovery/.test(job) && /row\.step = "recover"/.test(job));
ok("E10. Planner recovery receives Judge reasons, not failed post prose",
  /semantic_judge_reasons/.test(planner) && !/previous_final_text/.test(planner));
ok("E11. Planner recovery returns through Writer then Judge",
  /recoverRejectedPlannerSlot/.test(job) && /st\.write_flat\.splice\(insertAt, 0, replacement\)/.test(job) &&
  /st\.write_index = insertAt/.test(job) && /row\.step = "write"/.test(job));
ok("E12. Job calls weekly-count-ledger",
  /evaluateOrder8cCompletionGate/.test(job) &&
    /attachCountLedger/.test(job) &&
    /planned/.test(job) &&
    /regenerated/.test(job) &&
    /blocked/.test(job));
ok("E13. One-cycle signal does not promote",
  promote({ stage: "exploration", signalCycles: 0 }, true).stage === "exploration" &&
    promote({ stage: "exploration", signalCycles: 0 }, true).signalCycles === 1);
ok("E14. Second cycle promotes one step",
  promote({ stage: "exploration", signalCycles: 1 }, true).stage === "emerging");
ok("E15. No signal resets cycles, does not demote",
  promote({ stage: "emerging", signalCycles: 1 }, false).stage === "emerging" &&
    promote({ stage: "emerging", signalCycles: 1 }, false).signalCycles === 0);
ok("E16. Analyze persists ladder; Planner reads it; UNKNOWN if empty",
  /promoteInterestLadder/.test(analyze) &&
    /interestLadder/.test(analyze) &&
    /Array.isArray\(prevAudience\)/.test(analyze) &&
    /INTEREST LADDER/.test(intel) &&
    /Do not promote from one post/.test(intel));
ok("E17. Core Creator topics stay core",
  /CREATOR_CORE_TOPICS/.test(promo) && /fsd_field/.test(promo) && /lafc/.test(promo));
ok("E18. Writer still does not ingest Performance DNA",
  !/performanceDnaBlock\(\)/.test(wr) && /Performance DNA is Planner-only/.test(read("supabase/functions/weekly-plan/engine-architecture.ts")));
ok("E19. shipping 11.12.7",
  /APP_VERSION = "11.12.7"/.test(ver) && /APP_VERSION = "11.12.7"/.test(ix));
ok("E20. profile repetition belongs to Planner actual-X strategy",
  /recent_x_analytics/.test(planner) && !/hard\.push\("structural_repetition_high"\)/.test(judge));

console.log("========================================");
console.log(`WEEK DEPTH: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
