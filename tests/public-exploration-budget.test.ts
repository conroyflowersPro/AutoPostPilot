import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publicExplorationBudget,
  PUBLIC_EXPLORATION_CAP,
  PUBLIC_EXPLORATION_MIN_MULTIPLIER,
} from "../supabase/functions/weekly-plan/public-exploration-budget.ts";

const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
const weekly = readFileSync("supabase/functions/weekly-plan/index.ts", "utf8");
const quota = readFileSync("supabase/functions/weekly-plan/quota-inference.ts", "utf8");

assert.doesNotMatch(job, /칸 \+ \$\{SEED_POOL_BUFFER\}/);
assert.doesNotMatch(job, /poolTarget - \(st\.gated \|\| \[\]\)\.length/);
assert.doesNotMatch(job, /required <= 0\s*\n\s*\? Math.max\(0, EXPAND_BATCH - publicViralSeedCount/);
assert.match(job, /lived는 목표에 안 넣음/);
assert.match(job, /publicGated/);
assert.doesNotMatch(weekly, /required_slots \+ 10/);
assert.match(quota, /publicExplorationBudget/);

const lived = Array.from({ length: 40 }, (_, i) => ({
  seed_id: `lived-${i}`,
  owner: "SELF",
  seed_source: "ANALYTICS_LIVED",
  cluster: "FSD",
}));
const pub = Array.from({ length: 10 }, (_, i) => ({
  seed_id: `pub-${i}`,
  owner: "OTHER",
  seed_source: "PUBLIC_X",
  cluster: "TESLA",
}));

const mixed = publicExplorationBudget({
  requiredSlots: 39,
  gated: [...lived, ...pub],
});
assert.equal(mixed.have, 10);
assert.ok(mixed.target > 39 + 10, `target ${mixed.target} should beat 칸+10=49`);
assert.ok(mixed.target / 39 > 1.25, `multiplier-equivalent ${mixed.target / 39} should beat 1.25`);
assert.equal(mixed.remaining, mixed.target - 10);
assert.notEqual(mixed.target, 100);
assert.ok(mixed.target <= PUBLIC_EXPLORATION_CAP);

const prePlan = publicExplorationBudget({ requiredSlots: 0, gated: lived });
assert.equal(prePlan.have, 0);
assert.ok(prePlan.target >= Math.ceil(28 * PUBLIC_EXPLORATION_MIN_MULTIPLIER));
assert.notEqual(prePlan.target, 10);

const onlyLived = publicExplorationBudget({ requiredSlots: 39, gated: lived });
assert.equal(onlyLived.have, 0);
assert.equal(onlyLived.remaining, onlyLived.target);

const burned = publicExplorationBudget({
  requiredSlots: 39,
  gated: pub,
  rejectedPublicSeedIds: ["a", "b", "c", "d"],
  abandonedPublicSeedIds: ["c", "e"],
  judgeRejectCount: 4,
  seedUnfitCount: 8,
});
assert.ok(burned.target >= mixed.target);

console.log("public-exploration-budget ok", {
  mixedTarget: mixed.target,
  mixedHave: mixed.have,
  prePlanTarget: prePlan.target,
  burnedTarget: burned.target,
});
