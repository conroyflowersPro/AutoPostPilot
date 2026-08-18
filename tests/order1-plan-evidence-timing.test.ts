import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAgentSeungPlanEvidence,
  classifyPlanOrigin,
  compactPlanMetrics,
} from "../supabase/functions/weekly-plan/plan-evidence.ts";
import {
  enforceMinGapOnPlannedTimes,
  MIN_PLANNED_GAP_MS,
  spacingConstraintHolds,
} from "../supabase/functions/weekly-plan/for-you-spread.ts";
import { FEDICA_OVERWRITES_AGENT_SEUNG_PLANNED_AT } from "../lib/fedica-strategy-contract.ts";
import { parseCreatorDaySlots } from "../supabase/functions/weekly-plan/creator-week-slots.ts";

const page = readFileSync("app/generate/page.tsx", "utf8");
assert.match(page, /GENERATION_DAYS = 7/);
assert.doesNotMatch(page, /8일 전략 만들기/);

const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
assert.match(job, /loadAgentSeungPlanEvidence/);
assert.match(job, /planEvidence/);
assert.match(job, /inferCreatorSlotsForDays/);
assert.match(job, /stampPlannerSlotTimes\(/);
assert.match(job, /planEvidence\.occupied_times/);
assert.doesNotMatch(job, /Planner가 시각 배정/);

const spread = readFileSync("supabase/functions/weekly-plan/for-you-spread.ts", "utf8");
assert.match(spread, /MIN_PLANNED_GAP_MS/);
assert.match(spread, /enforceMinGapOnPlannedTimes/);
assert.doesNotMatch(spread, /stepTwoHoursIso/);
assert.doesNotMatch(spread, /FOR_YOU_START_HOUR, 0\)/);

const compact = compactPlanMetrics({
  post_id: "1",
  published_at: "2026-08-18T22:07:00.000Z",
  content: "장면",
  origin: "USER_DIRECT",
  metrics: {
    followers_gained: 2,
    profile_visits: 9,
    bookmarks: 1,
    replies: 4,
    reposts: 1,
    quotes: 0,
    likes: 7,
    impressions: 300,
    shares: 0,
    detail_expands: 3,
  },
});
assert.equal(compact.fol, 2);
assert.equal(compact.pv, 9);
assert.equal(compact.bm, 1);
assert.equal(compact.rp, 4);
assert.equal(compact.rps, 1);
assert.equal(compact.lk, 7);
assert.equal(compact.imp, 300);
assert.equal((compact as { eng?: number }).eng, undefined);

assert.equal(classifyPlanOrigin("USER_DIRECT"), "USER_DIRECT");
assert.equal(classifyPlanOrigin("AP_PIPELINE"), "AP_PIPELINE");
assert.equal(classifyPlanOrigin(""), "UNKNOWN");
assert.equal(classifyPlanOrigin("mystery"), "UNKNOWN");

const evidence = buildAgentSeungPlanEvidence({
  startDate: "2026-08-19",
  analyticsPosts: [
    {
      post_id: "a1",
      published_at: "2026-08-10T21:00:00.000Z",
      content: "직접 올린 장면",
      metrics: { followers_gained: 1, likes: 4, impressions: 80, replies: 2 },
    },
    {
      post_id: "p1",
      published_at: "2026-08-11T21:00:00.000Z",
      content: "AP가 예약한 글 본문",
      metrics: { followers_gained: 3, likes: 10, impressions: 900, replies: 1 },
    },
    {
      post_id: "u1",
      published_at: "2026-08-12T21:00:00.000Z",
      content: "출처 불명 본문",
      metrics: { followers_gained: 1, likes: 8, impressions: 400, replies: 1 },
    },
  ],
  originByPostId: { a1: "USER_DIRECT", p1: "AP_PIPELINE" },
  syncPosts: [
    {
      x_post_id: "a1",
      published_at: "2026-08-10T21:00:00.000Z",
      text_body: "직접 올린 장면",
      post_type: "ORIGINAL",
      system_origin_class: "USER_DIRECT",
    },
    {
      x_post_id: "gap1",
      published_at: "2026-08-17T18:00:00.000Z",
      text_body: "동기화만 있는 원글",
      post_type: "ORIGINAL",
      system_origin_class: "USER_DIRECT",
    },
  ],
  occupiedTimes: ["2026-08-19T21:00:00.000Z"],
});
assert.equal(evidence.user_direct.posts.length, 1);
assert.equal(evidence.ap_pipeline.posts.length, 1);
assert.equal(evidence.unknown.posts.length, 1);
assert.equal(evidence.unknown.posts[0].lk, 8);
assert.equal(evidence.unknown.posts[0].t, "");
assert.equal(evidence.ap_pipeline.posts[0].t, "");
assert.match(evidence.user_direct.posts[0].t, /장면/);
assert.equal(evidence.sync_gap.user_direct.length, 1);
assert.equal(evidence.sync_gap.user_direct[0].id, "gap1");
assert.ok(!evidence.notes.some((n) => /FSD →|Tesla →/.test(n)));

const slots = enforceMinGapOnPlannedTimes("2026-08-19", [
  { day_offset: 0, planned_at: "2026-08-19T22:07:00.000Z" },
  { day_offset: 0, planned_at: "2026-08-19T22:40:00.000Z" },
  { day_offset: 0, planned_at: "2026-08-20T03:11:00.000Z" },
]);
assert.equal(slots[0].planned_at, "2026-08-19T22:07:00.000Z");
assert.equal(slots[1].planned_at, "2026-08-19T22:40:00.000Z");
assert.equal(slots[2].planned_at, "2026-08-20T03:11:00.000Z");
assert.equal(spacingConstraintHolds(slots), false);
assert.ok(MIN_PLANNED_GAP_MS >= 2 * 60 * 60 * 1000);

const parsed = parseCreatorDaySlots({
  raw: {
    slots: [
      {
        slot_id: "D1P1",
        day_offset: 0,
        growth_role: "RETURN",
        editorial_mode: "OBSERVATION",
        planner_intent: "keep identity",
        planned_at: "2026-08-19T22:15:00.000Z",
        planned_pt: "2026-08-19 15:15 PT",
      },
      {
        slot_id: "D1P2",
        day_offset: 0,
        growth_role: "BRIDGE",
        editorial_mode: "INFORMATIVE",
        planner_intent: "open a lane",
        planned_pt: "2026-08-19 17:40 PT",
      },
      {
        slot_id: "D1P3",
        day_offset: 0,
        growth_role: "REACH",
        editorial_mode: "CASUAL_OBSERVATION",
        planner_intent: "easy entry",
        planned_at: "2026-08-19T20:10:00.000Z",
        planned_pt: "2026-08-19 13:10 PT",
      },
      {
        slot_id: "D1P4",
        day_offset: 0,
        growth_role: "RETURN",
        editorial_mode: "COMPARE",
        planner_intent: "compare without cloning",
        planned_at: "2026-08-19T23:20:00.000Z",
        planned_pt: "2026-08-19 16:20 PT",
      },
    ],
  },
  days: [0],
  postsPerDay: [4, 4, 4, 4, 4, 4, 4],
});
assert.ok(parsed);
assert.equal(parsed![0].planned_at, "2026-08-19T22:15:00.000Z");
assert.match(String(parsed![1].planned_pt), /17:40/);

const incomplete = parseCreatorDaySlots({
  raw: {
    slots: [
      {
        slot_id: "D1P1",
        day_offset: 0,
        growth_role: "RETURN",
        editorial_mode: "INFORMATIVE",
        planner_intent: "keep identity",
      },
    ],
  },
  days: [0],
  postsPerDay: [1, 4, 4, 4, 4, 4, 4],
});
assert.equal(incomplete, null);

assert.equal(FEDICA_OVERWRITES_AGENT_SEUNG_PLANNED_AT, false);
const fedicaBatch = readFileSync("app/api/fedica/batch-schedule/route.ts", "utf8");
assert.match(fedicaBatch, /resolveFedicaScheduleTime/);
assert.doesNotMatch(fedicaBatch, /allSlots\[i\]/);
assert.doesNotMatch(fedicaBatch, /buildDaySpreadSlots\(/);
const weekly = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
assert.doesNotMatch(weekly, /searchAgentSeungTheories\(/);

console.log("order1-plan-evidence-timing ok");
