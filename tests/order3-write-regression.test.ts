import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  capTheoryChunks,
  classifyTheoryKind,
  stripTheoryLabels,
  type TheoryChunk,
} from "../lib/intelligence/agent-seung.ts";
import { interpretSeed } from "../supabase/functions/weekly-plan/seed-interpretation.ts";
import {
  buildExperiencePacket,
  buildPostThought,
  buildSemanticSeedPacket,
} from "../supabase/functions/weekly-plan/semantic-seed-packet.ts";
import {
  abstractLivedSubject,
  livedExperienceFacts,
} from "../supabase/functions/weekly-plan/seed-ownership.ts";
import { relatedExperienceSubject } from "../supabase/functions/weekly-plan/experience-evidence.ts";
import { buildConstraintOnlyWriterInstructions } from "../supabase/functions/weekly-plan/independent-post-generation.ts";
import { buildDeepGenerationContext } from "../supabase/functions/weekly-plan/deep-generation-context.ts";

const night =
  "보행자는 아직 길에 들어오지도 않았는데 처음에는 왜 멈췄나 싶었는데 자세히 보니 건너려고 제 차가 정차하기를 기다리고 있었던 거더군요. 야간이라 보행자 입장에서는 차가 자신을 봤는지 확신하기 어렵습니다.";
const opinion =
  "FSD가 느린 게 아니라 내가 급한 건데, 그걸 차 탓으로 돌리기 쉽다.";

const gist = abstractLivedSubject(night, "FSD");
assert.ok(gist.length >= 10);
assert.doesNotMatch(gist, /실사용 후속/);
assert.notEqual(gist, night);
assert.ok(livedExperienceFacts(night).length >= 1);
assert.doesNotMatch(relatedExperienceSubject(night, "FSD", false).subject, /실사용 후속/);
assert.doesNotMatch(relatedExperienceSubject("점심 메뉴가 또 밀렸다", "DAILY", false).subject, /DAILY 실사용/);

const seeds = [
  {
    name: "self-experience",
    owner: "SELF",
    editorial_mode: "EXPERIENCE",
    concrete_subject: gist,
    point_or_tension: livedExperienceFacts(night)[1] || livedExperienceFacts(night)[0],
    experience_facts: livedExperienceFacts(night),
    creator_evidence_available: true,
    cluster: "FSD",
    role: "RETURN",
  },
  {
    name: "other-experience",
    owner: "OTHER",
    editorial_mode: "CASUAL_OBSERVATION",
    concrete_subject: "슈퍼차저에서 앞차가 안 움직인다",
    point_or_tension: "줄이 한 칸도 안 줄어든다",
    experience_facts: [],
    cluster: "CYBERTRUCK",
    role: "BRIDGE",
  },
  {
    name: "public-fact",
    owner: "OTHER",
    editorial_mode: "INFORMATIVE",
    concrete_subject: "분기 실적이 시장 예상보다 낮게 나왔다",
    point_or_tension: "기대와 숫자 사이",
    cluster: "TESLA",
    role: "REACH",
  },
  {
    name: "tech",
    owner: "OTHER",
    editorial_mode: "INFORMATIVE",
    concrete_subject: "HW4 카메라 시야가 비 오는 날 다르게 잡힌다",
    point_or_tension: "같은 비인데 화면 결이 다르다",
    cluster: "FSD",
    role: "BRIDGE",
  },
  {
    name: "daily",
    owner: "SELF",
    editorial_mode: "CASUAL_OBSERVATION",
    concrete_subject: "퇴근하고 저녁 메뉴가 또 밀렸다",
    point_or_tension: "배가 고픈데 결정이 안 난다",
    experience_facts: ["퇴근하고 저녁 메뉴가 또 밀렸다"],
    creator_evidence_available: true,
    cluster: "DAILY",
    role: "RETURN",
  },
  {
    name: "opinion",
    owner: "OTHER",
    editorial_mode: "OPINION",
    concrete_subject: opinion,
    point_or_tension: "차 탓으로 돌리기 쉽다",
    cluster: "FSD",
    role: "RETURN",
  },
  {
    name: "short",
    owner: "OTHER",
    editorial_mode: "CASUAL_OBSERVATION",
    concrete_subject: "비 오는 날 와이퍼만 켜 둔 차",
    point_or_tension: "사람은 안 보인다",
    cluster: "ROAD_PARK",
    role: "REACH",
  },
];

const thoughts: string[] = [];
for (const seed of seeds) {
  const interp = interpretSeed({
    seed_id: seed.name,
    concrete_subject: seed.concrete_subject,
    point_or_tension: seed.point_or_tension,
    cluster: seed.cluster,
    owner: seed.owner,
    editorial_mode: seed.editorial_mode,
    experience_facts: seed.experience_facts || [],
    creator_evidence_available: !!seed.creator_evidence_available,
  });
  const packet = buildSemanticSeedPacket(seed as any, interp as any);
  const exp = buildExperiencePacket(seed as any, interp as any);
  const thought = buildPostThought(interp as any, {
    creator_judgment: String((interp as any).why_it_might_matter_to_creator || ""),
  });
  thoughts.push(thought.core_thought);
  assert.doesNotMatch(packet.subject || "", /실사용 후속/);
  assert.ok(thought.core_thought.length >= 8, seed.name + " thought");
  assert.doesNotMatch(thought.core_thought, /judgment_axis:/);
  if (seed.owner === "SELF" && (seed.experience_facts || []).length) {
    assert.equal(exp.creator_experienced, true, seed.name + " must keep lived facts");
    assert.ok(exp.facts.length > 0);
  } else {
    assert.equal(exp.creator_experienced, false, seed.name + " must not fake lived");
    assert.equal(exp.must_not_claim_first_person, true);
  }
  const deep = buildDeepGenerationContext({
    slot_id: "D1P1",
    day_offset: 0,
    slot_index: 1,
    seed: { ...seed, seed_id: seed.name, editorial_mode: seed.editorial_mode } as any,
    interpretation: interp as any,
    thinking_rail: { reasoning_shape: "expect_vs_actual", required_reasoning_beats: ["hook", "twist"] } as any,
    editorial_mode: seed.editorial_mode,
    planner_intent: { strategy_slot_id: "D1P1", strategic_role: seed.role, intent: seed.name },
    voice_register: {
      n: 4,
      window_days: 14,
      median_chars: 90,
      question_ending_allowed: false,
      constraint_line: "haeyo mixed with short cuts. Do not copy last handmade post.",
    },
    seed_packet: packet,
    post_thought: thought,
    collection_block: "COLLECTION: none. Write from the decided thought and seed.",
    experience_packet: exp,
  });
  const prompt = buildConstraintOnlyWriterInstructions(deep);
  assert.match(prompt, /DECIDED THOUGHT/);
  assert.match(prompt, /STABLE CREATOR DNA/);
  assert.match(prompt, /RECENT VOICE REGISTER/);
  assert.doesNotMatch(prompt, /THINKING RAIL \(internal only/);
  assert.doesNotMatch(prompt, /required_reasoning_beats/);
  assert.doesNotMatch(prompt, /\bV1\b/);
  assert.doesNotMatch(prompt, /\bW3\b/);
  assert.doesNotMatch(prompt, /WEEKLY 호출/);
  if (exp.must_not_claim_first_person) {
    assert.match(prompt, /do not claim first-person lived experience/i);
  } else {
    assert.match(prompt, /first-person only within these facts/);
  }
}

const unique = new Set(thoughts);
assert.ok(unique.size >= thoughts.length - 1, "seed thoughts must differ");

const unknownPad: TheoryChunk[] = [
  { chunk_id: "u1", chunk_content: "unknown A", score: 9, kind: "unknown" },
  { chunk_id: "u2", chunk_content: "unknown B", score: 8, kind: "unknown" },
  { chunk_id: "v1", chunk_content: "힘", score: 7, kind: "viral" },
  { chunk_id: "w1", chunk_content: "형식", score: 6, kind: "writing" },
  { chunk_id: "v2", chunk_content: "힘2", score: 5, kind: "viral" },
];
const capped = capTheoryChunks(unknownPad);
assert.equal(capped.length, 2);
assert.equal(capped.filter((c) => c.kind === "viral").length, 1);
assert.equal(capped.filter((c) => c.kind === "writing").length, 1);
assert.equal(capped.filter((c) => c.kind === "unknown").length, 0);
assert.equal(classifyTheoryKind("시드에 이 힘이 있을 때 반전"), "unknown");

const kept = stripTheoryLabels(`## V4. 정보 빈틈

### 시드에 이 힘이 있을 때
장면 안에 이미 보인다.

### 쓰지 말 때
없는 빈틈을 만들지 않는다.`);
assert.match(kept, /시드에 이 힘이 있을 때/);
assert.match(kept, /쓰지 말 때/);
assert.doesNotMatch(kept, /V4/);

const ow = readFileSync("supabase/functions/weekly-plan/order-write-pipeline.ts", "utf8");
assert.ok(ow.indexOf("buildPostThought") < ow.indexOf("searchAgentSeungTheories"));
assert.doesNotMatch(ow, /from "\.\/generate-post/);
assert.match(ow, /voiceRegisterConstraintLine/);
const dna = readFileSync("supabase/functions/weekly-plan/engine-dna.ts", "utf8");
const postHead = dna.slice(dna.indexOf("function postAgentSeungPromptHead"), dna.indexOf("function writerPromptHead"));
assert.doesNotMatch(postHead, /AGENT_SEUNG_OPERATING_STRUCTURE/);
assert.match(postHead, /THIS CALL: POST/);
console.log("order3-write-regression ok");
