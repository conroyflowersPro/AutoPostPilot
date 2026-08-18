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

const thought = buildPostThought(
  {
    what_is_actually_happening: "앞차가 안 움직인다",
    why_it_might_matter_to_creator: "예상이 통째로 밀린다",
    possible_reader_connection: "대기 줄에 서 본 사람",
  },
  { creator_judgment: "judgment_axis:ignore_me" },
);
assert.equal(thought.core_thought.includes("judgment_axis"), false);
assert.match(thought.core_thought, /밀린다/);

const wr = readFileSync("supabase/functions/weekly-plan/independent-post-generation.ts", "utf8");
assert.match(wr, /DECIDED THOUGHT/);
assert.match(wr, /RECENT VOICE REGISTER/);
assert.match(wr, /Do not change Core Thought/);
assert.doesNotMatch(wr, /THINKING RAIL \(internal only/);
const ow = readFileSync("supabase/functions/weekly-plan/order-write-pipeline.ts", "utf8");
assert.match(ow, /searchAgentSeungTheories\(""/);
assert.match(ow, /searchAgentSeungTheories/);
assert.match(ow, /selectThinkingRail/);
assert.match(ow, /buildPostThought/);
console.log("order2-post-intelligence ok");
