import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessDeepThesisFit,
  deepThesisCollectionNote,
  deepThesisWriteLines,
  namedEntityIndependence,
} from "../supabase/functions/weekly-plan/deep-thesis.ts";
import {
  buildPostThought,
  buildSemanticSeedPacket,
} from "../supabase/functions/weekly-plan/semantic-seed-packet.ts";
import { interpretSeed } from "../supabase/functions/weekly-plan/seed-interpretation.ts";
import { theoryChunksForModel } from "../lib/intelligence/agent-seung.ts";

const thinInterp = interpretSeed({
  seed_id: "thin",
  concrete_subject: "비 오는 날 와이퍼만 켜 둔 차",
  point_or_tension: "사람은 안 보인다",
  cluster: "ROAD_PARK",
  owner: "OTHER",
  editorial_mode: "CASUAL_OBSERVATION",
});
const thinPacket = buildSemanticSeedPacket(
  { concrete_subject: "비 오는 날 와이퍼만 켜 둔 차", point_or_tension: "사람은 안 보인다", owner: "OTHER" },
  thinInterp as any,
);
const thinFit = assessDeepThesisFit(thinPacket, thinInterp as any);
assert.equal(thinFit.use, false, "casual observation is not auto Deep Thesis");
assert.equal(deepThesisWriteLines(thinFit).length, 0);
assert.equal(deepThesisCollectionNote(thinFit), "");

const richSeed = {
  concrete_subject: "슈퍼차저에서 앞차가 안 움직인다",
  point_or_tension: "줄이 한 칸도 안 줄어든다. 예상과 다르다",
  owner: "OTHER",
  change_or_delta: "대기만 늘고 충전은 그대로",
};
const richInterp = interpretSeed({
  seed_id: "rich",
  concrete_subject: richSeed.concrete_subject,
  point_or_tension: richSeed.point_or_tension,
  cluster: "CYBERTRUCK",
  owner: "OTHER",
  editorial_mode: "OPINION",
});
const richPacket = buildSemanticSeedPacket(richSeed, richInterp as any);
const richFit = assessDeepThesisFit(richPacket, richInterp as any);
assert.equal(richFit.use, true, "tension + delta + scene can open Deep Thesis");
assert.ok(!richFit.reasons.includes("editorial_mode"));
assert.match(deepThesisCollectionNote(richFit), /already closed/);
assert.match(deepThesisWriteLines(richFit).join("\n"), /Depth is not length/);
assert.doesNotMatch(deepThesisWriteLines(richFit).join("\n"), /현상\s*↓/);
assert.doesNotMatch(deepThesisWriteLines(richFit).join("\n"), /Scale Up/);

const named = namedEntityIndependence("Tesla FSD가 느린 게 아니라 내가 급한 건데 차 탓으로 돌리기 쉽다");
assert.equal(named, true);
const worship = namedEntityIndependence("Tesla");
assert.equal(worship, false);
assert.equal(namedEntityIndependence("저녁 메뉴가 또 밀렸다"), null);

const expMode = interpretSeed({
  seed_id: "exp",
  concrete_subject: "오늘 짧게 한 판만 깼다",
  point_or_tension: "그게 다다",
  cluster: "GAMING",
  owner: "SELF",
  editorial_mode: "EXPERIENCE",
  experience_facts: ["오늘 짧게 한 판만 깼다"],
  creator_evidence_available: true,
});
const expFit = assessDeepThesisFit(
  buildSemanticSeedPacket(
    { concrete_subject: "오늘 짧게 한 판만 깼다", owner: "SELF", experience_facts: ["오늘 짧게 한 판만 깼다"] },
    expMode as any,
  ),
  expMode as any,
);
assert.equal(expFit.use, false, "EXPERIENCE mode does not force Deep Thesis");

const thought = buildPostThought(richInterp as any, {});
assert.equal(thought.core_thought, "");
assert.doesNotMatch(thought.core_thought, /Deep Thesis/);

const coll = theoryChunksForModel(
  [{ chunk_id: "v", chunk_content: "공명", score: 1, kind: "viral" }],
  deepThesisCollectionNote(richFit),
);
assert.match(coll, /Do not re-apply a card that only duplicates/);
assert.match(coll, /Zero cards is allowed/);

const ow = readFileSync("supabase/functions/weekly-plan/order-write-pipeline.ts", "utf8");
assert.match(ow, /assessDeepThesisFit/);
assert.match(ow, /runCollectionReadyHook/);
assert.doesNotMatch(ow, /searchAgentSeungTheories/);
assert.doesNotMatch(ow, /deepThesisCollectionNote/);
const wr = readFileSync("supabase/functions/weekly-plan/independent-post-generation.ts", "utf8");
assert.match(wr, /deepThesisWriteLines/);
assert.match(wr, /length follows the thought/);
const order = readFileSync("lib/intelligence/agent-seung.ts", "utf8");
assert.match(order, /Deep Thesis는 기본 모드가 아니다/);
assert.match(order, /COLLECTION_READY_HOOK/);
assert.match(order, /Core Thought → COLLECTION_READY_HOOK → WRITE/);
console.log("order4-deep-thesis ok");
