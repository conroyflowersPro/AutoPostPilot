import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canServeEditorialMode } from "../supabase/functions/weekly-plan/seed-engine.ts";
import { parsePlannerSelection } from "../supabase/functions/weekly-plan/seven-day-planner.ts";
import { LIVED_GROUNDING_INSUFFICIENT } from "../supabase/functions/weekly-plan/seed-ownership.ts";
import { analyticsLivedSeeds } from "../supabase/functions/weekly-plan/analytics-lived-seeds.ts";

const planner = readFileSync("supabase/functions/weekly-plan/seven-day-planner.ts", "utf8");
const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
const creator = readFileSync("supabase/functions/weekly-plan/creator-week-slots.ts", "utf8");
const dna = readFileSync("supabase/functions/weekly-plan/engine-dna.ts", "utf8");
const livedSrc = readFileSync("supabase/functions/weekly-plan/analytics-lived-seeds.ts", "utf8");
const audience = readFileSync("supabase/functions/weekly-plan/audience-x-status.ts", "utf8");

assert.doesNotMatch(planner, /change that slot's editorial_mode/);
assert.match(planner, /Do not change editorial_mode/);
assert.match(planner, /lived_grounding_insufficient/);
assert.match(planner, /A large lived_grounding list is supply, not an EXPERIENCE quota/);
assert.doesNotMatch(job, /locked\.editorial_mode = item\.editorial_mode/);
assert.doesNotMatch(job, /EXPERIENCE: expPct/);
assert.doesNotMatch(job, /const expSupply/);
assert.match(job, /lived_grounding_insufficient/);
assert.match(job, /코드가 Mode를 바꾸지 않음/);
assert.match(job, /replanReason: "lived_grounding_insufficient"/);
assert.match(job, /plannerLivedGrounding/);
assert.match(job, /source_role: "GROUNDING_EVIDENCE"/);
assert.match(creator, /grounding supply/);
assert.doesNotMatch(creator, /EXPERIENCE only within lived_scene_count/);
assert.match(dna, /lived_scene_count is supply, not an EXPERIENCE quota/);
assert.match(audience, /not an EXPERIENCE post quota/);
assert.match(livedSrc, /GROUNDING_EVIDENCE/);
assert.match(creator, /lived_grounding_insufficient/);
assert.doesNotMatch(livedSrc, /lived grounding · /);

const lived = {
  seed_id: "lived-1",
  owner: "SELF",
  seed_source: "ANALYTICS_LIVED",
  concrete_subject: "야간에 보행자가 갑자기 나왔다",
  cluster: "FSD",
  experience_facts: ["야간에 보행자가 갑자기 나왔다"],
};
const pub = {
  seed_id: "pub-1",
  owner: "OTHER",
  seed_source: "PUBLIC_X",
  concrete_subject: "슈퍼차저에서 앞차가 안 움직인다",
  cluster: "CYBERTRUCK",
};

assert.equal(canServeEditorialMode(lived, "EXPERIENCE"), true);
assert.equal(canServeEditorialMode(lived, "INFORMATIVE"), false);
assert.equal(canServeEditorialMode(lived, "OPINION"), false);
assert.equal(canServeEditorialMode(pub, "EXPERIENCE"), false);
assert.equal(canServeEditorialMode(pub, "INFORMATIVE"), true);

const expSlot = {
  slot_id: "D1P1",
  day_offset: 0,
  strategic_role: "RETURN",
  editorial_mode: "EXPERIENCE" as const,
  planner_intent: "lived when needed",
};
const infoSlot = {
  slot_id: "D1P2",
  day_offset: 0,
  strategic_role: "BRIDGE",
  editorial_mode: "INFORMATIVE" as const,
  planner_intent: "public fact",
};

const rejectPublicOnExp = parsePlannerSelection(
  {
    assignments: [{ slot_id: "D1P1", seed_id: "pub-1", editorial_mode: "INFORMATIVE", planner_intent: "swap" }],
    missing: [],
  },
  [expSlot],
  new Set(["pub-1", "lived-1"]),
  new Set(),
  [lived, pub] as any,
);
assert.ok(rejectPublicOnExp);
assert.equal(rejectPublicOnExp.assignments.length, 0);
assert.equal(rejectPublicOnExp.missing[0]?.exploration_direction, "EXPERIENCE");

const rejectPublicWhenNoLived = parsePlannerSelection(
  {
    assignments: [{ slot_id: "D1P1", seed_id: "pub-1", editorial_mode: "INFORMATIVE", planner_intent: "swap" }],
    missing: [],
  },
  [expSlot],
  new Set(["pub-1"]),
  new Set(),
  [pub] as any,
);
assert.ok(rejectPublicWhenNoLived);
assert.equal(rejectPublicWhenNoLived.assignments.length, 0);
assert.equal(rejectPublicWhenNoLived.missing[0]?.exploration_direction, LIVED_GROUNDING_INSUFFICIENT);

const rejectLivedOnInfo = parsePlannerSelection(
  {
    assignments: [{ slot_id: "D1P2", seed_id: "lived-1", editorial_mode: "EXPERIENCE", planner_intent: "reuse" }],
    missing: [],
  },
  [infoSlot],
  new Set(["pub-1", "lived-1"]),
  new Set(),
  [lived, pub] as any,
);
assert.ok(rejectLivedOnInfo);
assert.equal(rejectLivedOnInfo.assignments.length, 0);

const keepPlanMode = parsePlannerSelection(
  {
    assignments: [
      { slot_id: "D1P1", seed_id: "lived-1", editorial_mode: "INFORMATIVE", planner_intent: "keep" },
      { slot_id: "D1P2", seed_id: "pub-1", editorial_mode: "EXPERIENCE", planner_intent: "keep" },
    ],
    missing: [],
  },
  [expSlot, infoSlot],
  new Set(["pub-1", "lived-1"]),
  new Set(),
  [lived, pub] as any,
  true,
);
assert.ok(keepPlanMode);
assert.deepEqual(
  keepPlanMode.assignments.map((a) => a.editorial_mode).sort(),
  ["EXPERIENCE", "INFORMATIVE"],
);

const mustFillLivedHole = parsePlannerSelection(
  {
    assignments: [{ slot_id: "D1P2", seed_id: "pub-1", editorial_mode: "CASUAL_OBSERVATION" }],
  },
  [expSlot, infoSlot],
  new Set(["pub-1"]),
  new Set(),
  [pub] as any,
  true,
);
assert.ok(mustFillLivedHole);
assert.equal(mustFillLivedHole.assignments.length, 1);
assert.equal(mustFillLivedHole.assignments[0].editorial_mode, "INFORMATIVE");
assert.equal(mustFillLivedHole.missing[0]?.slot_id, "D1P1");
assert.equal(mustFillLivedHole.missing[0]?.exploration_direction, LIVED_GROUNDING_INSUFFICIENT);

const mustFillRetryWhenLivedRemains = parsePlannerSelection(
  {
    assignments: [{ slot_id: "D1P2", seed_id: "pub-1" }],
  },
  [expSlot, infoSlot],
  new Set(["pub-1", "lived-1"]),
  new Set(),
  [lived, pub] as any,
  true,
);
assert.equal(mustFillRetryWhenLivedRemains, null);

const packets = analyticsLivedSeeds({ limit: 5 });
assert.ok(packets.length > 0);
for (const seed of packets) {
  assert.equal(String((seed as any).source_role), "GROUNDING_EVIDENCE");
  assert.doesNotMatch(String(seed.concrete_subject), /^lived grounding · /);
  assert.ok(Array.isArray((seed as any).experience_facts));
  assert.ok(((seed as any).experience_facts as string[]).length > 0);
}

console.log("experience-grounding-not-quota ok");
