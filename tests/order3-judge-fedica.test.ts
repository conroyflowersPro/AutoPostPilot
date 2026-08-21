import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FEDICA_OVERWRITES_AGENT_SEUNG_PLANNED_AT,
  resolveFedicaScheduleTime,
  spacingConflictIso,
} from "../lib/fedica-strategy-contract.ts";
import {
  JUDGE_DOES_NOT_PLAN,
  JUDGE_DOES_NOT_SCHEDULE,
  JUDGE_NO_COLLECTION_API,
  JUDGE_QUESTION,
  isSlotStrategyInvalidation,
} from "../supabase/functions/weekly-plan/semantic-judge.ts";
import {
  COLLECTION_API_CALLS_THIS_ORDER,
  runCollectionReadyHook,
} from "../supabase/functions/weekly-plan/collection-ready-hook.ts";

const page = readFileSync("app/generate/page.tsx", "utf8");
assert.match(page, /GENERATION_DAYS = 7/);
assert.doesNotMatch(page, /8일 전략 만들기/);

const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
const recoverFn = job.slice(job.indexOf("async function stepRecover"), job.indexOf("async function legacySeedJudgeUnused"));
assert.match(recoverFn, /CONTENT_REPAIR/);
assert.match(recoverFn, /STRATEGY_REPLAN/);
assert.match(recoverFn, /inferCreatorSlotReplan/);
assert.match(recoverFn, /planned_at: original\.planned_at/);
assert.match(recoverFn, /editorial_mode: original\.editorial_mode/);
assert.doesNotMatch(recoverFn, /creatorRelabelRejectBatch\(/);
assert.doesNotMatch(recoverFn, /attachSeedsForSlots\(/);
assert.match(job, /findExistingPassDraft/);
assert.match(job, /judge_status: "pass"/);
assert.match(job, /while \(i < flat\.length && flat\[i\]\?\._saved\)/);
assert.doesNotMatch(job, /searchAgentSeungTheories\(/);

const write = readFileSync("supabase/functions/weekly-plan/independent-post-generation.ts", "utf8");
assert.match(write, /THIS CALL IS REPAIR/);
assert.match(write, /THIS CALL IS CREATE after slot-level PLAN replan/);
assert.match(write, /not a rewrite template/);
assert.doesNotMatch(write, /Topic→Retry/);

assert.equal(JUDGE_DOES_NOT_PLAN, true);
assert.equal(JUDGE_DOES_NOT_SCHEDULE, true);
assert.equal(JUDGE_NO_COLLECTION_API, true);
assert.match(JUDGE_QUESTION, /게시 가능/);

const judgeSrc = readFileSync("supabase/functions/weekly-plan/semantic-judge.ts", "utf8");
assert.match(judgeSrc, /is this final post publishable in this slot/);
assert.doesNotMatch(judgeSrc, /searchAgentSeungTheories/);
assert.doesNotMatch(judgeSrc, /collections_search/);
assert.equal(isSlotStrategyInvalidation(["forced_cta", "ai_report_voice"]), false);
assert.equal(isSlotStrategyInvalidation(["seed_no_longer_valid", "factual_basis"]), true);

assert.equal(COLLECTION_API_CALLS_THIS_ORDER, 1);
const hook = await runCollectionReadyHook({ seed_packet: { scene: "충전 줄" }, core_thought: "앞 칸 규칙" });
assert.equal(hook.api_calls, 0);
assert.equal(hook.skipped, true);

const pipeline = readFileSync("supabase/functions/weekly-plan/order-write-pipeline.ts", "utf8");
assert.match(pipeline, /runCollectionReadyHook/);
assert.match(pipeline, /judgeIndependentResult/);

const weeklyIndex = readFileSync("supabase/functions/weekly-plan/index.ts", "utf8");
assert.doesNotMatch(weeklyIndex, /from ["'].*generate-post/);

assert.equal(FEDICA_OVERWRITES_AGENT_SEUNG_PLANNED_AT, false);
const planned = "2026-08-19T22:00:00.000Z";
const ok = resolveFedicaScheduleTime({
  post: { strategy_json: { planned_at: planned } },
  occupiedISOs: ["2026-08-19T18:00:00.000Z"],
});
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.iso, new Date(planned).toISOString());
  assert.equal(ok.source, "agent_seung_planned_at");
}

const missing = resolveFedicaScheduleTime({
  post: { strategy_json: {} },
  occupiedISOs: [],
});
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.code, "missing_planned_at");

const broken = resolveFedicaScheduleTime({
  post: { strategy_json: { planned_at: planned } },
  occupiedISOs: [planned],
});
assert.equal(broken.ok, false);
if (!broken.ok) {
  assert.equal(broken.code, "strategy_spacing_broken");
  assert.equal("iso" in broken, false);
}

assert.equal(spacingConflictIso(planned, ["2026-08-19T18:00:00.000Z"]), null);

const batch = readFileSync("app/api/fedica/batch-schedule/route.ts", "utf8");
assert.match(batch, /resolveFedicaScheduleTime/);
assert.doesNotMatch(batch, /buildDaySpreadSlots\(/);
assert.doesNotMatch(batch, /Math\.random/);
assert.doesNotMatch(batch, /jitter/i);
assert.doesNotMatch(batch, /searchAgentSeungTheories/);
assert.match(batch, /already_scheduled/);

const single = readFileSync("app/api/fedica/schedule/route.ts", "utf8");
assert.match(single, /resolveFedicaScheduleTime/);
assert.doesNotMatch(single, /buildDaySpreadSlots\(/);
assert.doesNotMatch(single, /searchAgentSeungTheories/);

const cal = readFileSync("lib/calendar/activity-provider.ts", "utf8");
assert.match(cal, /strategy_json\?\.planned_at/);
assert.match(cal, /schedule_failed/);
assert.match(cal, /PUBLISHED/);
assert.doesNotMatch(cal, /createCalendarPostRecord/);

const scheduleSvc = readFileSync("lib/services/schedule-service.ts", "utf8");
assert.match(scheduleSvc, /already_scheduled/);
assert.match(scheduleSvc, /idempotencyKey/);

console.log("order3-judge-fedica ok");
