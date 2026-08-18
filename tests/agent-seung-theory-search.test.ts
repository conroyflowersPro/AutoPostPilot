import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTheorySearchQuery,
  capTheoryChunks,
  classifyTheoryKind,
  stripTheoryLabels,
  theoryChunksForModel,
  type TheoryChunk,
} from "../lib/intelligence/agent-seung.ts";

const sampleViral = `## V4. 정보 빈틈 (Information Gap)

출처: George Loewenstein, *The Psychology of Curiosity*

Agent승 질문: 이 시드에, 독자가 느끼는 특정 정보 빈틈이 이미 있는가?
시드에 이 힘이 있을 때 장면·사실 안에 이미 보인다.`;

const sampleWriting = `## W3. 구체성 / 장면 우선

출처: Allan Paivio, Dual Coding Theory

### 맞는 형식
- 시드에 있는 장면·사실로 운반한다`;

assert.equal(classifyTheoryKind(sampleViral, "viral-col-1"), "viral");
assert.equal(classifyTheoryKind(sampleWriting, "writing-col-1"), "writing");
assert.equal(classifyTheoryKind(sampleViral), "unknown");
assert.equal(
  classifyTheoryKind(sampleViral, "abc", { viralIds: ["abc"], writingIds: ["def"] }),
  "viral",
);

const stripped = stripTheoryLabels(sampleViral);
assert.doesNotMatch(stripped, /V4/);
assert.doesNotMatch(stripped, /Information Gap/i);
assert.doesNotMatch(stripped, /Loewenstein/);
assert.match(stripped, /빈틈/);
assert.match(stripped, /시드에 이 힘이/);

const q = buildTheorySearchQuery({
  scene: "충전 커넥터가 빗물에 젖어 있다",
  fact: "V4 Information Gap 카드",
});
assert.doesNotMatch(q, /V4/);
assert.doesNotMatch(q, /Information Gap/i);
assert.match(q, /충전/);

const many: TheoryChunk[] = [
  { chunk_id: "a", chunk_content: "힘A", score: 9, kind: "viral" },
  { chunk_id: "b", chunk_content: "힘B", score: 8, kind: "viral" },
  { chunk_id: "c", chunk_content: "힘C", score: 7, kind: "viral" },
  { chunk_id: "d", chunk_content: "형식A", score: 6, kind: "writing" },
  { chunk_id: "e", chunk_content: "형식B", score: 5, kind: "writing" },
  { chunk_id: "f", chunk_content: "형식C", score: 4, kind: "writing" },
];
const capped = capTheoryChunks(many);
assert.equal(capped.filter((c) => c.kind === "viral").length, 2);
assert.equal(capped.filter((c) => c.kind === "writing").length, 2);

const skipBlock = theoryChunksForModel([]);
assert.match(skipBlock, /COLLECTION: none/);

const libOrder = readFileSync("lib/intelligence/agent-seung.ts", "utf8");
const edgeOrder = readFileSync("supabase/functions/weekly-plan/agent-seung.ts", "utf8");
function grabOrder(src) {
  const start = src.indexOf("export const AGENT_SEUNG_OPERATING_ORDER");
  const end = src.indexOf("export const AGENT_SEUNG_OPERATING_STRUCTURE");
  return src.slice(start, end);
}
assert.equal(grabOrder(libOrder), grabOrder(edgeOrder));
assert.match(libOrder, /힘 이름·카드 번호를 확정하지 마라/);
assert.match(libOrder, /THIS CALL: POST|POST 호출/);
assert.match(libOrder, /장기적인 X 계정 성장/);
assert.match(libOrder, /별도 Writer 사고 주체는 없다/);
assert.doesNotMatch(libOrder, /평범한 시드가 아니다\. 이미 힘이 있다/);
assert.doesNotMatch(libOrder, /Writer는 지시대로 본문만 쓴다/);
assert.match(libOrder, /UNDERSTAND/);
assert.match(libOrder, /Creator Thinking → THINK → Core Thought → COLLECTION_READY_HOOK → WRITE/);
assert.match(edgeOrder, /searchAgentSeungTheories/);
assert.match(libOrder, /Editorial Mode · 시드 배치/);
assert.match(libOrder, /Batch transport는 허용/);
assert.match(libOrder, /subject만으로 검색하지 마라/);
assert.match(libOrder, /칸 · 날짜 · 시각/);
assert.match(libOrder, /USER_DIRECT와 AP_PIPELINE을 따로/);
assert.match(libOrder, /고정 하루 시간표로 만들지 마라/);
assert.doesNotMatch(libOrder, /POST는 칸마다 독립 호출이다/);
assert.doesNotMatch(libOrder, /칸 단위 순차는 Judge 거절/);
assert.match(libOrder, /AGENT_SEUNG_WRITES_FINAL_POST/);
assert.match(edgeOrder, /AGENT_SEUNG_WRITES_FINAL_POST/);

const writer = readFileSync("supabase/functions/weekly-plan/engine-dna.ts", "utf8");
assert.match(writer, /function writerPromptHead/);
assert.match(writer, /writerPromptHead\(\)/);
assert.match(writer, /function postAgentSeungPromptHead/);
assert.match(writer, /THIS CALL: POST/);
assert.match(writer, /Post Agent승 thinks and writes/);

const postGen = readFileSync("supabase/functions/weekly-plan/independent-post-generation.ts", "utf8");
assert.match(postGen, /POST AGENT승 ROLE/);
assert.doesNotMatch(postGen, /WRITER ROLE: You are Grok 4.6 writing/);

const pipe = readFileSync("lib/intelligence/engine-architecture.ts", "utf8");
assert.match(pipe, /Post Agent승 thinks then writes/);
assert.match(pipe, /reject returns that slot to Post Agent승/);
console.log("agent-seung-theory-search ok");
