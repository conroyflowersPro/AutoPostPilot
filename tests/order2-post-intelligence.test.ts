import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTheorySearchQuery,
  capTheoryChunks,
  classifyTheoryKind,
  stripTheoryLabels,
  type TheoryChunk,
} from "../lib/intelligence/agent-seung.ts";
import {
  buildExperiencePacket,
  buildPostThought,
  buildSemanticSeedPacket,
} from "../supabase/functions/weekly-plan/semantic-seed-packet.ts";
import {
  applyAgentSeungCoreThought,
  buildCoreThought,
} from "../supabase/functions/weekly-plan/deep-generation-context.ts";
import { runCollectionReadyHook } from "../supabase/functions/weekly-plan/collection-ready-hook.ts";
import {
  retrieveCreatorThinkingIntelligence,
  weightedThinkingScore,
} from "../supabase/functions/weekly-plan/creator-thinking-intelligence.ts";
import { parseAgentSeungPostOutput } from "../supabase/functions/weekly-plan/independent-post-generation.ts";

const keptHeading = stripTheoryLabels(`## V5. 인식 / 공명 (Recognition)

### 시드에 이 힘이 있을 때

독자가 이미 아는 감각.`);
assert.match(keptHeading, /시드에 이 힘이 있을 때/);
assert.doesNotMatch(keptHeading, /V5/);
assert.doesNotMatch(keptHeading, /Recognition/);

const q = buildTheorySearchQuery({
  scene: "빈 운전석에 케이블만 남음",
  contrast_or_tension: "한 칸만 바꿔도 손익이 그대로",
  subject: "FSD Cybertruck",
});
assert.match(q, /케이블/);
assert.doesNotMatch(q, /FSD/);
assert.doesNotMatch(q, /Cybertruck/);

assert.equal(buildTheorySearchQuery({ subject: "FSD Tesla Optimus" }), "");
assert.equal(buildTheorySearchQuery({ scene: "FSD", subject: "Tesla" }), "");

assert.equal(classifyTheoryKind("시드에 이 힘이 있을 때", "x"), "unknown");
assert.equal(classifyTheoryKind("x", "vid-1", { viralIds: ["vid-1"], writingIds: ["wid-1"] }), "viral");

const many: TheoryChunk[] = [
  { chunk_id: "a", chunk_content: "힘A", score: 9, kind: "viral" },
  { chunk_id: "b", chunk_content: "힘B", score: 8, kind: "viral" },
  { chunk_id: "c", chunk_content: "형식A", score: 6, kind: "writing" },
  { chunk_id: "d", chunk_content: "형식B", score: 5, kind: "writing" },
];
const capped = capTheoryChunks(many);
assert.equal(capped.filter((c) => c.kind === "viral").length, 1);
assert.equal(capped.filter((c) => c.kind === "writing").length, 1);

const packet = buildSemanticSeedPacket(
  { concrete_subject: "충전 줄", point_or_tension: "앞차가 안 움직임", owner: "OTHER" },
  {
    what_is_actually_happening: "슈퍼차저에서 앞차가 안 움직인다",
    possible_reader_connection: "대기",
    what_is_new_or_interesting: "줄이 한 칸도 안 줄어든다",
  },
);
assert.equal(packet.ownership, "OTHER");
assert.ok(packet.scene);
assert.equal(packet.change_or_delta, "줄이 한 칸도 안 줄어든다");
assert.equal(packet.contrast_or_tension, "앞차가 안 움직임");

const noExp = buildExperiencePacket(
  { owner: "SELF", creator_evidence_available: true, experience_facts: [] },
  { experience_boundaries: { creator_experienced: true, evidence_supported: true } },
);
assert.equal(noExp.creator_experienced, false);
assert.equal(noExp.must_not_claim_first_person, true);

const withExp = buildExperiencePacket(
  { owner: "SELF", experience_facts: ["어제 HW4로 시내 주행"] },
  { experience_boundaries: { creator_experienced: true } },
);
assert.equal(withExp.creator_experienced, true);
assert.match(withExp.facts[0], /시내/);

const labeled = buildPostThought(
  {
    what_is_actually_happening: "앞차가 안 움직인다",
    why_it_might_matter_to_creator: "예상이 통째로 밀린다",
    possible_reader_connection: "대기 줄에 서 본 사람",
  },
  { creator_judgment: "judgment_axis:ignore_me" },
);
assert.equal(labeled.core_thought, "");
assert.equal(labeled.core_thought.includes("judgment_axis"), false);

const assembled = buildCoreThought(
  {
    seed_subject: "충전 줄",
    what_is_actually_happening: "앞차가 안 움직인다",
    why_it_might_matter_to_creator: "예상이 통째로 밀린다",
    possible_reader_connection: "대기 줄에 서 본 사람",
  },
  { concrete_subject: "충전 줄" },
  null,
);
assert.equal(assembled.primary_claim, "");
assert.equal(assembled.creator_judgment, "");
assert.equal(assembled.status, "CORE_THOUGHT_OPEN");

const decided = applyAgentSeungCoreThought(assembled, {
  core_thought: "대기가 안 줄어드는 건 차 문제가 아니라 앞 칸 규칙이다",
  from_current_seed: true,
  boundary_ok: true,
});
assert.match(decided.creator_judgment, /앞 칸/);
assert.equal(decided.status, "CORE_THOUGHT_READY");
assert.doesNotMatch(decided.creator_judgment, /judgment_axis/);

const hook = runCollectionReadyHook({ seed_packet: packet, core_thought: decided.creator_judgment });
assert.equal(hook.api_calls, 0);
assert.equal(hook.skipped, true);
assert.equal(hook.insertion_point, "after_core_thought_before_write");
assert.ok(hook.meaning.scene);
assert.match(hook.collection_block, /none this run/i);

const none = retrieveCreatorThinkingIntelligence({
  candidates: [],
  seed_packet: packet,
  interpretation: { what_is_actually_happening: "앞차가 안 움직인다" },
});
assert.equal(none.patterns.length, 0);
assert.equal(none.none_is_normal, true);

const topicOnly = retrieveCreatorThinkingIntelligence({
  candidates: [
    {
      id: "fsd-rail",
      topic: "FSD",
      trigger_summary: "FSD",
      expansion_steps: ["observe"],
      support_count: 5,
      recent_14d_support: 5,
      status: "CANDIDATE",
    },
  ],
  seed_packet: packet,
  interpretation: { what_is_actually_happening: "슈퍼차저에서 앞차가 안 움직인다" },
});
assert.equal(topicOnly.patterns.length, 0, "topic name must not retrieve a rail");

const related = retrieveCreatorThinkingIntelligence({
  candidates: [
    {
      id: "wait-line",
      trigger_summary: "충전 줄이 안 줄어들고 앞차가 멈춰 있다",
      expansion_steps: ["observe_concrete", "check_constraint"],
      support_count: 4,
      recent_14d_support: 1,
      historical_strength: "HIGH",
      status: "CANDIDATE",
      notes: JSON.stringify({ judgment_tendency: "leave_uncertain_open", scale_movement: "local_only" }),
    },
  ],
  seed_packet: packet,
  interpretation: { what_is_actually_happening: "슈퍼차저에서 앞차가 안 움직인다" },
});
assert.equal(related.patterns.length, 1);
assert.match(related.patterns[0].reasoning_behaviors.join(" "), /constraint|observe/);

const recentHeavy = weightedThinkingScore(3, { support_count: 10, recent_14d_support: 9, historical_strength: "HIGH" }, 2);
const longTerm = weightedThinkingScore(3, { support_count: 10, recent_14d_support: 1, historical_strength: "HIGH" }, 2);
assert.ok(recentHeavy > longTerm);
assert.ok(longTerm > 2, "long-term evidence still scores; recent does not wipe it");

const parsed = parseAgentSeungPostOutput(
  '{"core_thought":"줄이 안 줄어드는 이유는 앞 칸 규칙이다","from_current_seed":true,"boundary_ok":true,"post":"슈퍼차저에서 앞차가 안 움직인다. 줄은 그대로다."}',
);
assert.match(parsed.core_thought, /앞 칸/);
assert.match(parsed.post, /슈퍼차저/);
assert.doesNotMatch(parsed.core_thought, /슈퍼차저에서 앞차가 안 움직인다\. 줄은 그대로다/);

const wr = readFileSync("supabase/functions/weekly-plan/independent-post-generation.ts", "utf8");
assert.match(wr, /YOU decide Core Thought/);
assert.match(wr, /RECENT VOICE REGISTER/);
assert.match(wr, /STABLE CREATOR DNA/);
assert.match(wr, /No Rail is normal/);
assert.doesNotMatch(wr, /THINKING RAIL \(internal only/);
assert.doesNotMatch(wr, /DECIDED THOUGHT \(do not change\)/);
const ow = readFileSync("supabase/functions/weekly-plan/order-write-pipeline.ts", "utf8");
assert.doesNotMatch(ow, /searchAgentSeungTheories/);
assert.match(ow, /runCollectionReadyHook/);
assert.match(ow, /retrieveCreatorThinkingIntelligence/);
assert.match(ow, /selectDeliveryAfterThought/);
assert.match(ow, /selectThinkingRail/);
assert.ok(ow.indexOf("retrieveCreatorThinkingIntelligence") < ow.indexOf("integrateSlotGeneration"));
assert.ok(ow.indexOf("runCollectionReadyHook") < ow.indexOf("integrateSlotGeneration"));
assert.doesNotMatch(ow, /from "\.\/generate-post/);
const weeklyJob = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
assert.match(weeklyJob, /thinking_rail_candidates/);
assert.doesNotMatch(weeklyJob, /selectThinkingRailHint/);
const extract = readFileSync("supabase/functions/thinking-extract/index.ts", "utf8");
assert.match(extract, /isCreatorThinkingEvidence/);
assert.match(extract, /recent_14d_weight/);
assert.match(extract, /abstractBehaviorKey/);
assert.doesNotMatch(extract, /topic \| editorial_mode \| reasoning_steps/);
console.log("order2-post-intelligence ok");
