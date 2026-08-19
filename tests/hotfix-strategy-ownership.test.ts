import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyPlanOrigin,
  extractFedicaBestPostingTime,
  buildAgentSeungPlanEvidence,
} from "../supabase/functions/weekly-plan/plan-evidence.ts";
import { parseCreatorDaySlots, reachDailyConstraintOk } from "../supabase/functions/weekly-plan/creator-week-slots.ts";
import { spacingConstraintHolds } from "../supabase/functions/weekly-plan/for-you-spread.ts";
import {
  classifyEvidenceOrigin,
  mergeStoredOriginClass,
  classifyOwnTimelineOrigin,
} from "../lib/origin-class.ts";
import { staleLivedExperiencePicks } from "../supabase/functions/weekly-plan/seed-ownership.ts";
import { COLLECTION_API_CALLS_THIS_ORDER } from "../supabase/functions/weekly-plan/collection-ready-hook.ts";
import { jobHasProgress } from "../supabase/functions/weekly-plan/generation-job.ts";

const creator = readFileSync("supabase/functions/weekly-plan/creator-week-slots.ts", "utf8");
assert.doesNotMatch(creator, /PAD_MODES/);
assert.doesNotMatch(creator, /n % 3/);
assert.doesNotMatch(creator, /enforceReachDailyCap/);
assert.match(creator, /inferCreatorSlotReplan/);
assert.match(creator, /Code will not invent Role, Mode, REACH, or time/);
assert.match(creator, /inferCreatorSlotTiming/);
assert.match(creator, /Do not emit planned_at or planned_pt/);
assert.match(creator, /Every listed slot needs planned_at/);
assert.match(creator, /before the next day/);
assert.match(creator, /minimum, not a 2-hour step/);
assert.match(creator, /hard_occupied and today_published/);

const spread = readFileSync("supabase/functions/weekly-plan/for-you-spread.ts", "utf8");
assert.match(spread, /Does not invent a replacement time/);
assert.doesNotMatch(spread, /lastMs \+ gapMs/);

const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
assert.match(job, /코드가 새 시각을 만들지 않음/);
assert.match(job, /PLANNER_XAI_HOLD_MAX/);
assert.match(job, /PLANNER_DAY_SLOT_TIMEOUT_MS/);
assert.match(job, /takePlannerHold/);
assert.match(job, /코드가 Seed를 배정하지 않음/);
assert.match(job, /STRATEGY_REPLAN/);
assert.match(job, /CONTENT_REPAIR/);
assert.match(job, /inferCreatorSlotReplan/);
assert.match(job, /staleLivedExperiencePicks/);
assert.match(job, /STRATEGY_REPLAN_ABANDON/);
assert.match(job, /CONTENT_REPAIR_ABANDON/);
assert.match(job, /inferCreatorSlotTiming/);
assert.match(job, /buildTimingEvidencePacket/);
assert.match(job, /시각만 재추론/);
assert.match(job, /selectSeedsForChunk/);
assert.match(job, /describeStaleLivedPicks/);
assert.match(job, /mustFill/);
assert.match(job, /nextUnassignedSlotChunk/);
assert.match(job, /Seed 배치 일시 중단/);
assert.match(job, /planner_assigning_slot_ids/);
assert.match(job, /extractFedicaBestPostingTime/);
assert.match(job, /public_window_exhausted/);
assert.match(job, /jobHasProgress/);
assert.match(job, /resumeIncompleteJob/);
assert.match(job, /시드 재검색 없음/);
const generatePage = readFileSync("app/generate/page.tsx", "utf8");
assert.match(generatePage, /liveSession/);
assert.match(generatePage, /res.status === 401/);
const mw = readFileSync("lib/supabase/middleware.ts", "utf8");
assert.match(mw, /auth_timeout/);
assert.match(mw, /catch/);
assert.equal(jobHasProgress({ state: { gated: [{ seed_id: "p1" }] } }), true);
assert.equal(jobHasProgress({ state: { gated: [] } }), false);
assert.match(job, /jobHasProgress\(row\)/);
assert.doesNotMatch(job, /기존 Seed Pool로 Planner 이어감/);
assert.match(job, /inferPlanEvidenceDigest/);
assert.match(job, /planner_digest_complete/);
assert.doesNotMatch(job, /applyNewestLivedExperienceAssignments/);
assert.doesNotMatch(job, /=\s*fillUnassignedPlannerSlotsFromPool/);

assert.equal(classifyPlanOrigin(""), "UNKNOWN");
assert.equal(classifyPlanOrigin(undefined), "UNKNOWN");
assert.equal(classifyEvidenceOrigin(""), "UNKNOWN");
assert.equal(classifyEvidenceOrigin("USER_DIRECT"), "USER_DIRECT");
assert.equal(classifyEvidenceOrigin("AP_PIPELINE"), "AP_PIPELINE");
assert.equal(classifyEvidenceOrigin("mystery"), "UNKNOWN");

assert.equal(classifyOwnTimelineOrigin({ apMatched: false, actionType: "ORIGINAL", ownAccount: true }), "USER_DIRECT");
assert.equal(classifyOwnTimelineOrigin({ apMatched: false, actionType: "REPLY", ownAccount: true }), "UNKNOWN");
assert.equal(classifyOwnTimelineOrigin({ apMatched: true, actionType: "ORIGINAL", ownAccount: true }), "AP_PIPELINE");
assert.equal(mergeStoredOriginClass("USER_DIRECT", "UNKNOWN"), "USER_DIRECT");
assert.equal(mergeStoredOriginClass("USER_DIRECT", "AP_PIPELINE"), "AP_PIPELINE");
assert.equal(mergeStoredOriginClass("UNKNOWN", "USER_DIRECT"), "USER_DIRECT");

const inscribe = readFileSync("lib/calendar/planner-inscribe.ts", "utf8");
assert.match(inscribe, /return "unknown"/);
assert.match(inscribe, /classifyOwnTimelineOrigin/);
assert.match(inscribe, /origin === "USER_DIRECT"\) return "handmade"/);
const originSrc = readFileSync("lib/origin-class.ts", "utf8");
assert.match(originSrc, /return "UNKNOWN"/);
assert.match(originSrc, /return "USER_DIRECT"/);
assert.match(originSrc, /Never downgrade/);

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

const stale = staleLivedExperiencePicks({
  slots: [{ slot_id: "D1P1", editorial_mode: "EXPERIENCE" }],
  assignments: [{ slot_id: "D1P1", seed_id: "old" }],
  pool: [
    { seed_id: "old", owner: "SELF", cluster: "FSD", occurred_at: "2026-08-14T20:00:00.000Z" },
    { seed_id: "new", owner: "SELF", cluster: "FSD", occurred_at: "2026-08-17T20:00:00.000Z" },
  ],
});
assert.deepEqual(stale, ["D1P1"]);

const thinking = readFileSync("supabase/functions/thinking-extract/index.ts", "utf8");
assert.match(thinking, /scanned_none_eligible_continue/);
assert.match(thinking, /no more source rows/);
assert.doesNotMatch(thinking, /no more eligible posts/);
assert.match(thinking, /fetchNextSourcePage/);
assert.match(thinking, /cursor_activity_id/);
assert.match(thinking, /isCreatorThinkingEvidence/);
assert.match(thinking, /classifyThinkingOrigin\(row\) === "USER_DIRECT"/);
assert.doesNotMatch(thinking, /filledBatch \? lastEligible/);

assert.equal(extractFedicaBestPostingTime(null).status, "missing");
assert.equal(extractFedicaBestPostingTime({ best_posting_time: ["14:00"] }).status, "present");
const evidence = buildAgentSeungPlanEvidence({
  startDate: "2026-08-19",
  analyticsPosts: [],
  syncPosts: [],
});
assert.equal(evidence.fedica_best_posting_time.status, "missing");

assert.equal(COLLECTION_API_CALLS_THIS_ORDER, 1);

const calendar = readFileSync("app/components/QueueMonthCalendar.tsx", "utf8");
assert.doesNotMatch(calendar, /recover_batch|STRATEGY_REPLAN|repair_attempts/);
assert.match(calendar, /계정 현황/);

const recoverFn = job.slice(job.indexOf("async function stepRecover"), job.indexOf("async function legacySeedJudgeUnused"));
assert.match(recoverFn, /slotId: String\(original\.slotId \|\| id\)/);
assert.match(recoverFn, /strategy_replan_attempts/);
assert.match(recoverFn, /content_repair_attempts/);

console.log("hotfix-strategy-ownership ok");
