import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyPlanOrigin } from "../supabase/functions/weekly-plan/plan-evidence.ts";
import { parseCreatorDaySlots, reachDailyConstraintOk } from "../supabase/functions/weekly-plan/creator-week-slots.ts";
import { spacingConstraintHolds } from "../supabase/functions/weekly-plan/for-you-spread.ts";
import { classifyEvidenceOrigin } from "../lib/origin-class.ts";
import { COLLECTION_API_CALLS_THIS_ORDER } from "../supabase/functions/weekly-plan/collection-ready-hook.ts";

const creator = readFileSync("supabase/functions/weekly-plan/creator-week-slots.ts", "utf8");
assert.doesNotMatch(creator, /PAD_MODES/);
assert.doesNotMatch(creator, /n % 3/);
assert.doesNotMatch(creator, /enforceReachDailyCap/);
assert.match(creator, /inferCreatorSlotReplan/);
assert.match(creator, /Code will not invent Role, Mode, REACH, or time/);

const spread = readFileSync("supabase/functions/weekly-plan/for-you-spread.ts", "utf8");
assert.match(spread, /Does not invent a replacement time/);
assert.doesNotMatch(spread, /lastMs \+ gapMs/);

const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
assert.match(job, /코드가 새 시각을 만들지 않음/);
assert.match(job, /코드가 Seed를 배정하지 않음/);
assert.match(job, /STRATEGY_REPLAN/);
assert.match(job, /CONTENT_REPAIR/);
assert.match(job, /inferCreatorSlotReplan/);
assert.doesNotMatch(job, /=\s*fillUnassignedPlannerSlotsFromPool/);

assert.equal(classifyPlanOrigin(""), "UNKNOWN");
assert.equal(classifyPlanOrigin(undefined), "UNKNOWN");
assert.equal(classifyEvidenceOrigin(""), "UNKNOWN");
assert.equal(classifyEvidenceOrigin("USER_DIRECT"), "USER_DIRECT");
assert.equal(classifyEvidenceOrigin("AP_PIPELINE"), "AP_PIPELINE");
assert.equal(classifyEvidenceOrigin("mystery"), "UNKNOWN");

const inscribe = readFileSync("lib/calendar/planner-inscribe.ts", "utf8");
assert.match(inscribe, /return "UNKNOWN"/);
assert.match(inscribe, /return "unknown"/);
assert.doesNotMatch(inscribe, /return "USER_DIRECT";\s*\}/);
assert.match(inscribe, /origin === "USER_DIRECT"\) return "handmade"/);

const intent = readFileSync("lib/intelligence/creator-intent-14d.ts", "utf8");
assert.match(intent, /classifyEvidenceOrigin\(row\.system_origin_class \|\| row\.origin\) === "USER_DIRECT"/);

const exp = readFileSync("lib/intelligence/experience-evidence.ts", "utf8");
assert.match(exp, /classifyEvidenceOrigin\(row\.system_origin_class\) !== "USER_DIRECT"/);

const noMode = parseCreatorDaySlots({
  raw: {
    slots: [
      {
        slot_id: "D1P1",
        day_offset: 0,
        growth_role: "RETURN",
        planner_intent: "keep",
        planned_at: "2026-08-19T21:00:00.000Z",
      },
    ],
  },
  days: [0],
  postsPerDay: [1, 4, 4, 4, 4, 4, 4],
});
assert.equal(noMode, null);

const noReach = parseCreatorDaySlots({
  raw: {
    slots: [
      {
        slot_id: "D1P1",
        day_offset: 0,
        growth_role: "RETURN",
        editorial_mode: "INFORMATIVE",
        planner_intent: "keep",
        planned_at: "2026-08-19T21:00:00.000Z",
      },
    ],
  },
  days: [0],
  postsPerDay: [1, 4, 4, 4, 4, 4, 4],
});
assert.equal(noReach, null);
assert.equal(reachDailyConstraintOk([{ day_offset: 0, strategic_role: "RETURN" }]), false);

assert.equal(
  spacingConstraintHolds([
    { planned_at: "2026-08-19T21:00:00.000Z" },
    { planned_at: "2026-08-19T21:30:00.000Z" },
  ]),
  false,
);

const thinking = readFileSync("supabase/functions/thinking-extract/index.ts", "utf8");
assert.match(thinking, /scanned_none_eligible_continue/);
assert.match(thinking, /no more source rows/);
assert.doesNotMatch(thinking, /no more eligible posts/);
assert.match(thinking, /isCreatorThinkingEvidence/);
assert.match(thinking, /classifyThinkingOrigin\(row\) === "USER_DIRECT"/);

assert.equal(COLLECTION_API_CALLS_THIS_ORDER, 0);

const calendar = readFileSync("app/components/QueueMonthCalendar.tsx", "utf8");
assert.doesNotMatch(calendar, /recover_batch|STRATEGY_REPLAN|repair_attempts/);
assert.match(calendar, /계정 현황/);

console.log("hotfix-strategy-ownership ok");
