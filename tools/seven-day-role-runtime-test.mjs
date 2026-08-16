#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const planner = read("supabase/functions/weekly-plan/seven-day-planner.ts");
const seed = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const seedEngine = read("supabase/functions/weekly-plan/seed-engine.ts");
const scope = read("supabase/functions/weekly-plan/seed-scope.ts");
const writer = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const pipe = read("supabase/functions/weekly-plan/order-write-pipeline.ts");
const deep = read("supabase/functions/weekly-plan/deep-generation-context.ts");
const judge = read("supabase/functions/weekly-plan/semantic-judge.ts");
const stage = read("supabase/functions/weekly-plan/engine-stage-philosophy.ts");
const quota = read("supabase/functions/weekly-plan/quota-inference.ts");
const page = read("app/generate/page.tsx");
const analyticsImport = read("app/api/learning/import/route.ts");
const analyticsParser = read("lib/learning/parse-csv.ts");

let pass = 0;
let fail = 0;
function ok(name, condition) {
  if (condition) {
    pass += 1;
    console.log("  PASS ", name);
  } else {
    fail += 1;
    console.log("  FAIL ", name);
  }
}

console.log("Seven-day role runtime");
ok("R1. planning horizon is seven days", /QUOTA_DAYS = 7/.test(quota) && /GENERATION_DAYS = 7/.test(page));
ok("R2. persisted job has strategy, select, write, recover steps",
  /"strategy"/.test(job) && /"select"/.test(job) && /"write"/.test(job) && /"recover"/.test(job));
ok("R3. live router uses Planner strategy/select/recover",
  /stepStrategy\(args\.supabase, args\.xaiKey, row\)/.test(job) &&
  /stepPlannerSelect\(args\.supabase, args\.xaiKey, row\)/.test(job) &&
  /stepRecover\(args\.xaiKey \|\| "", row\)/.test(job));
ok("R4. Seed Generator is explore-only", /Do not score Creator fit/.test(seed) && /No scores, rankings, strategy, selection, allocation/.test(seed));
ok("R5. Seed output has no strategic judgment fields",
  !/why_now/.test(seed) && !/creator_relevance/.test(seed) && !/audience_relevance/.test(seed) &&
  !/seed_priority/.test(seed) && !/selection_reason/.test(seed));
ok("R6. Seed open cells have no Editorial Mode", /OPEN_DISCOVERY/.test(scope) && !/editorial_mode: modes/.test(scope));
ok("R7. Seed ranking system removed", !/seedSelectionValueScore/.test(seedEngine + job + planner));
ok("R8. Planner strategy happens without Seed Pool input",
  /inferSevenDayStrategy/.test(planner) && !/seedPool: ConcreteSeed\[\][\s\S]*inferSevenDayStrategy/.test(planner));
ok("R9. Planner uses up to 30 days actual X Analytics",
  /from\("post_metrics"\)/.test(planner) && /Math\.min\(30, days\)/.test(planner) &&
  /limit\(1000\)/.test(planner) && /recent_x_analytics/.test(planner) &&
  /x-analytics-30d-window\.json/.test(planner) && /loadBundledXAnalyticsWindow/.test(planner));
ok("R10. Planner does not replace missing analytics", /Do not estimate missing analytics dates/.test(planner));
ok("R11. Planner selects and allocates only after strategy",
  /selectSeedsForSevenDayPlan/.test(planner) && /seven_day_strategy/.test(planner) && /seed_pool/.test(planner));
ok("R12. Writer receives Planner Intent", /planner_intent/.test(deep) && /planner_intent: \{/.test(pipe) && /ASSIGNED PLANNER INTENT/.test(writer));
ok("R13. Writer prompt does not enumerate creative engines",
  !/writingStagePhilosophyBlock\(\)/.test(writer) && !/writerMechanismConstraintLines\(ctx\)/.test(writer));
ok("R14. Writer pre-hard gate is minimum boundary",
  /reasons\.includes\("experience_fabrication"\)/.test(writer) &&
  /reasons\.includes\("possible_factual_invention"\)/.test(writer) &&
  /reasons\.includes\("manual_text_leakage"\)/.test(writer) &&
  !/hardFail[\s\S]{0,500}reasons\.includes\("expert_jargon"\)/.test(writer));
ok("R15. Judge hard failures are final-unacceptable only",
  /hard\.push\("empty_final_text"\)/.test(judge) &&
  /hard\.push\("fabricated_experience"\)/.test(judge) &&
  /hard\.push\("fabricated_factual_claim"\)/.test(judge) &&
  /hard\.push\("token_stutter"\)/.test(judge) &&
  /hard\.push\("question_closer"\)/.test(judge) &&
  /hard\.push\("expert_jargon"\)/.test(judge) &&
  /hard\.push\("generic_thesis"\)/.test(judge) &&
  !/hard\.push\("structural_repetition_high"\)/.test(judge));
ok("R15b. Judge Creator check is contradiction, not topic similarity",
  /ORDER8A_CREATOR_CHECK_IS_CONTRADICTION/.test(judge) &&
  /hasCreatorIdentityContradiction/.test(judge) &&
  /creator_identity_contradiction/.test(judge) &&
  /Contradiction Check/.test(stage) &&
  !/creator_fit_weak/.test(judge) &&
  !/scores\.creator_fit < 0\.55/.test(judge));
ok("R16. Judge reject returns slot to Planner", /pending_recovery/.test(job) && /row\.step = "recover"/.test(job));
ok("R16b. Planner requeues the recovered slot as the next Writer/Judge pass",
  /st\.write_flat\.splice\(insertAt, 0, replacement\)/.test(job) &&
  /st\.write_index = insertAt/.test(job) &&
  /Planner 재배차 → Writer 재작성/.test(job) &&
  /skipSelectiveRegen: true/.test(job));
ok("R16d. Judge reject reasons are shown to the operator",
  /last_reject_ko/.test(job) &&
  /JUDGE_REASON_KO/.test(job) &&
  /Judge 거절 ·/.test(job) &&
  /lastReject/.test(page));
ok("R16e. Judge reject reasons stay as a list",
  /reject_log/.test(job) &&
  /appendRejectLog/.test(job) &&
  /rejectLog/.test(page) &&
  /Judge 거절 목록/.test(page));
ok("R16c. Judge reject does not bounce recover before remaining planned writes",
  /enqueueRecovery/.test(job) &&
  /beginRecoverIfQueueReady/.test(job) &&
  /SEED_REJECT_ABANDON = 3/.test(job) &&
  /recoverSeedPool/.test(job) &&
  !/reservedSeedIds\.add\(rejectedSeedId\)/.test(job));
ok("R16f. 3-strike discards that Seed only; Planner still refills the slot",
  /Planner가 Seed 3회 거절 후 버림/.test(job) &&
  /슬롯은 재배차/.test(job) &&
  /enqueueRecovery/.test(job) &&
  !/write_flat\.push\(\{ \.\.\.chunk\[k\], _saved: false \}\)/.test(job) &&
  !/JOB_RECOVERY_CAP_MULT/.test(job));
ok("R16g. empty Seed pool asks Seed Generator for a 10-candidate field batch",
  /TARGETED_EXPLORE_SEED_COUNT = 10/.test(job) &&
  /requestTargetedSeedRefill/.test(job) &&
  /Planner Seed 후보 없음 → Seed Generator/.test(job) &&
  /a batch, never a single seed/.test(seed));
ok("R16h. generate job returns a Korean pipeline report",
  /report_ko: buildJobReportKo\(row\)/.test(job) &&
  /생성 보고서/.test(job) &&
  /Writer가 거절된 글을 다시 썼는가/.test(job) &&
  !/setJobReport/.test(page));
ok("R17. recovery checks existing Pool first", /availableSeedPool: pool/.test(job) && /RESELECT_EXISTING/.test(planner));
ok("R18. Planner can request targeted Seed exploration", /TARGETED_EXPLORE/.test(planner) && /planner_exploration_direction/.test(job + seed));
ok("R19. Judge reject does not delete Seed", /Judge rejection is not permanent Seed rejection/.test(planner));
ok("R20. count completes only from saved Judge-pass posts", /quotaFilled/.test(job) && /judgeWeekCount/.test(job) && /acceptedOutcomes/.test(job));
ok("R21. each xAI stage is one-call-per-tick", /callPlanner/.test(planner) && /one xAI request/.test(planner));
ok("R22. old local Seed judge/select are not live", /legacySeedJudgeUnused/.test(job) && /legacyLocalSelectUnused/.test(job));
ok("R23. account overview remains a separate daily Planner signal",
  /dailyAccountPulse/.test(analyticsImport) && /engagements: number/.test(analyticsParser) &&
  /account_overview_daily/.test(planner) && /never to attribute an account total to an individual post/.test(planner));
ok("R24. Planner strategy sends compacted 30-day outcomes, not full post bodies",
  /compactPublishedFlow/.test(planner) && /maxTokens: 7000/.test(planner) &&
  /compacted to date, short text, and outcome metrics/.test(planner));
ok("R25. Planner owns weekly volume; 7-slot days are rejected",
  /strategyCoversSevenDays/.test(planner) && /empty_days_forbidden/.test(planner) &&
  /handmade_cadence/.test(planner) && /MIN_WEEKLY_SLOTS/.test(planner));
ok("R26. job starts at Seed expand, then Planner strategy",
  /step: "expand"/.test(job) && /Seed Generator 공개 X 탐색/.test(job) &&
  !/inferWeeklyQuota/.test(job) && /SEED_POOL_BUFFER/.test(job));
ok("R27. bundled X Analytics is a TS module first",
  /BUNDLED_X_ANALYTICS_WINDOW/.test(planner) &&
  /x-analytics-30d-bundled/.test(planner) &&
  /source: "module"/.test(planner));
ok("R28. strategy fills volume then 2 days per tick",
  /STRATEGY_DAYS_PER_TICK = 2/.test(planner) &&
  /inferSevenDayVolume/.test(job) &&
  /inferSevenDaySlotsForDays/.test(job) &&
  !/await inferSevenDayStrategy\(/.test(job));
ok("R29. Planner stamps 14:00–22:00 PT after the week is locked",
  /stampPlannerSlotTimes/.test(job) &&
  /FOR_YOU_START_HOUR = 14/.test(read("supabase/functions/weekly-plan/for-you-spread.ts")) &&
  /FOR_YOU_END_HOUR = 22/.test(read("supabase/functions/weekly-plan/for-you-spread.ts")) &&
  /planned_pt/.test(job));
ok("R30. Writer timeout vs Judge reject labels",
  /V11_WRITER_TIMEOUT_MS = 45000/.test(pipe) &&
  /formatPipelineReject/.test(job) &&
  /Writer 실패 ·/.test(job) &&
  /Judge 거절 ·/.test(job));
ok("R31. xAI timeout keeps the job running",
  /isTransientXaiError/.test(job) &&
  /holdForXai/.test(job) &&
  /같은 칸 다시 씀/.test(job) &&
  /JOB_LOCK_MS = 55000/.test(job) &&
  /row\.status = "error"/.test(job));
ok("R32. Judge owns week count; Planner plans only",
  /JUDGE_OWNS_WEEK_COUNT/.test(judge) &&
  /judgeWeekCount/.test(job) &&
  /selectSeedsForDays/.test(job) &&
  /nextUnassignedDayOffsets/.test(job) &&
  !/await selectSeedsForSevenDayPlan\(/.test(job) &&
  /FIELD_REFILL_MAX = 30/.test(job) &&
  /Judge 개수 미달/.test(job) &&
  !/Count Integrity/.test(job));

console.log("========================================");
console.log(`SEVEN-DAY ROLES: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
