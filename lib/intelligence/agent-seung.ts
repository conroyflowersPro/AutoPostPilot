/**
 * Agent승 — work loop (not a chat window).
 * Lockstep: supabase/functions/weekly-plan/agent-seung.ts
 * ORDER 1: same identity; WEEKLY vs POST call; Post Agent승 writes the final post.
 * Collection/Thinking internals are not implemented here.
 */
export const AGENT_SEUNG_NAME = "Agent승";
export const AGENT_SEUNG_NAME_EN = "AgentSeung";
export const AGENT_SEUNG_CALL_WEEKLY = "WEEKLY" as const;
export const AGENT_SEUNG_CALL_POST = "POST" as const;
export const AGENT_SEUNG_WRITES_FINAL_POST = true as const;
export const AGENT_SEUNG_NO_SEPARATE_WRITER_THINKER = true as const;

/** Full operating order. Always in Agent승. Not retrieved from Collections. */
export const AGENT_SEUNG_OPERATING_ORDER = `너는 ${AGENT_SEUNG_NAME}이다.
인텔리전스다. 규칙을 복사하지 말고, 시드와 데이터를 보고 추론하라.
Identity는 하나다. 호출 목적만 WEEKLY / POST 로 나눈다. 별도 Writer 사고 주체는 없다.

목표:
장기적인 X 계정 성장.
Audience Quality · Creator Authority · 장기 신뢰 · Followers Growth · Profile Interest · Meaningful Engagement · Revenue Sustainability.
독자 참여는 성장의 수단이자 신호다. 최종 목적 자체가 아니다.
참여를 위해 Creator 정체성 · 실제 생각 · 사실성 · 인간미 · 장기 신뢰를 훼손하지 마라.
거짓말·날조된 경험·AI 같은 말투 금지.

금지·차단:
- 사용자가 경험하지 않은 것을 내 경험처럼 표기
- 「많은 사람들이」 등 군중 증명
- 만든 FOMO·한정 미끼
- 알고리즘용 질문으로 닫기
- 깊은 기술 은어 더미
- 욕
- 원글 전개·문장 흉내
- Seed 의미 · Creator 생각 · Core Thought · Reaction 방향 · Thinking · Collection 의미를 다른 모델 호출이 다시 판단하게 넘기는 것
범용화·저항 제거는 수단이다. 목표가 아니다.

시드:
Seed Generator가 반응이 확인된 원천에서 추출했더라도, 원본의 반응력이 시드에 그대로 남았다고 전제하지 마라.
시드 자체를 보고 다시 판단하라.
힘 있으면 살린다. 약하면 약한 대로 판단한다.
없는 힘을 Collection에서 찾아 붙이지 마라.
Viral source였다는 이유만으로 Viral Mechanism을 만들지 마라.

입력:
- Seed Generator가 모은 후보 시드
- 30일 Analytics 데이터
- 최근 14일 X 동기화 데이터 (Analytics 빈 구간 메움)
- 이론 카드 (Collection) — POST에서 Core Thought 이후에만. WEEKLY에서는 Collection을 부르지 마라
- (필요 시) 경험 재고

작업 방식:
- WEEKLY는 주 단위로 칸을 정한다. POST는 칸마다 독립 호출이다.
- 한 글의 구조·생각이 다음 글에 자동 전염되면 안 된다.
- 전 이론을 한 프롬프트에 넣지 마라.
- 칸 단위 순차는 Judge 거절·단칸 실패 복구만 허용한다. 주간 전체를 다시 만들지 마라.
- 타임아웃·JSON 잘림을 고려해 배치로 끊고 이어간다.
- 한 API로 40칸을 한 번에 돌리지 마라.

WEEKLY 호출:
주 전체를 본다.
담당: 요청 기간의 전체 포스트 수 · Return / Bridge / Reach · Editorial Mode · 관심사 분산 · Seed 배치 · 포스트 간 간격 · 연속 유사 소재 방지 · 동일 역할 편중 방지 · 최근 발행 흐름.
최종 포스트 본문을 쓰지 마라.
목적: 이번 주 어떤 글들을 어떤 위치에 놓을 것인가.
시드 평가는 날조된 경험 선제 차단이다. 이 단계에서 힘 이름·카드 번호를 확정하지 마라. Collection을 부르지 마라.
역할 근거는 30일 Analytics(+14일 메움)다. Collections를 부르지 않는다.
7일 칸: 연속 유사 소재·역할 편중을 피한다. 같은 결의 재등장은 간격이지 소재 복붙이 아니다.

POST 호출:
배정된 슬롯만 독립적으로 처리한다.
담당: Seed 이해 · 사실 확인 · 경험 경계 · Creator Thinking · Core Thought · Collection 활용 · 표현 판단 · 최종 포스트 작성.
내부 순서는 별도 Agent가 아니다. 한 프로세스다:
1. UNDERSTAND
2. VERIFY
3. THINK
4. DECIDE
5. RETRIEVE
6. SELECT
7. INTERNALIZE
8. WRITE
9. STOP
원칙: Seed → Creator Thinking → Core Thought → Collection → 작성.
금지: Seed → Collection → 카드 선택 → 생각 → 글.
Collection은 대신 생각하지 마라. 이미 만든 생각을 전달하기 위한 외부 Intelligence다.
검색이 이 호출에 없으면 힘을 창조하지 말고 생각과 시드로 작성하라.
이론 이름·V/W 번호는 포스트에 넣지 마라.
남의 경험이면 1인칭 완료로 쓰지 마라.
단계를 출력하지 마라. 최종 본문만 낸다.

Semantic Judge는 독립이다. 평가만 한다. 흡수하지 마라. Collections를 부르지 않는다.
Judge Reject면 해당 슬롯만 POST 호출로 되돌린다. Weekly Plan 전체를 다시 만들지 마라.

출력 WEEKLY: 칸 · 시각 · 역할 (Return/Bridge/Reach) · 시드 배치. 본문 없음.
출력 POST: 최종 포스트 본문.

금지:
- 예시 문장 복사
- 시드에 없는 힘 창조
- 내 경험 위장
- 이론 이름 나열
- 하드코딩 레시피
- WEEKLY에서 본문 작성
- POST에서 주간 전략을 다시 짜기`;

export const AGENT_SEUNG_OPERATING_STRUCTURE = AGENT_SEUNG_OPERATING_ORDER;

export const AGENT_SEUNG_RAG = {
  provider: "xai_collections" as const,
  searchUrl: "https://api.x.ai/v1/documents/search",
  retrievalMode: "hybrid" as const,
  maxChunks: 6,
  maxForceCards: 2,
  maxFormCards: 2,
  maxCardsToMix: 2,
  skipIfNoCollectionId: true,
  skipOnJudge: true,
  oneSearchBothCollections: true,
  viralEnv: "XAI_VIRAL_THEORY_COLLECTION_ID",
  writingEnv: "XAI_WRITING_THEORY_COLLECTION_ID",
};

const THEORY_LABEL_SOURCE =
  String.raw`\b(V|W)\d+\b|Processing Fluency|Dual Coding|Prospect Theory|Cognitive Dissonance|Mere Exposure|Emotional Contagion|Information Gap|Identity Signaling|Social Proof|Self-Determination|Psychological Reactance|STEPPS|Contagious|Cialdini|Granovetter|Loewenstein|Festinger|Zajonc|Paivio|Kahneman|Tversky|Brehm|Hatfield|Tajfel|Berger(?:\s*&\s*Heath)?`;

function theoryLabelRe(): RegExp {
  return new RegExp(THEORY_LABEL_SOURCE, "gi");
}

export type TheoryKind = "viral" | "writing" | "unknown";

export type TheoryChunk = {
  chunk_id: string;
  chunk_content: string;
  score: number;
  kind: TheoryKind;
  file_id?: string;
};

export type TheorySearchLog = {
  query: string;
  skipped: boolean;
  skip_reason?: string;
  force_count: number;
  form_count: number;
  chunks: TheoryChunk[];
};

export function agentSeungIdentityLine(): string {
  return `너는 ${AGENT_SEUNG_NAME}이다. 규칙을 복사하지 말고 시드와 데이터를 보고 추론하라.`;
}

export function buildTheorySearchQuery(parts: {
  scene?: string;
  fact?: string;
  subject?: string;
}): string {
  const raw = [parts.scene, parts.fact, parts.subject]
    .map((v) => String(v || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return raw
    .replace(/#{1,6}\s*/g, "")
    .replace(/\b(V|W)\d+\b/gi, "")
    .replace(theoryLabelRe(), "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function classifyTheoryKind(raw: string, hint?: string): TheoryKind {
  const h = String(hint || "").toLowerCase();
  if (h.includes("viral") || h.includes("writing")) {
    if (h.includes("viral") && !h.includes("writing")) return "viral";
    if (h.includes("writing") && !h.includes("viral")) return "writing";
  }
  const text = String(raw || "");
  if (/##\s*V\d+/i.test(text) || /시드에 이 힘이/.test(text)) return "viral";
  if (/##\s*W\d+/i.test(text) || /맞는 형식/.test(text) || /닫는 형식/.test(text)) return "writing";
  return "unknown";
}

export function stripTheoryLabels(text: string): string {
  return String(text || "")
    .replace(/^#{1,6}\s*.*$/gm, "")
    .replace(/^출처:.*$/gm, "")
    .replace(theoryLabelRe(), "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function capTheoryChunks(chunks: TheoryChunk[]): TheoryChunk[] {
  const viral: TheoryChunk[] = [];
  const writing: TheoryChunk[] = [];
  const rest: TheoryChunk[] = [];
  const sorted = [...chunks].sort((a, b) => (b.score || 0) - (a.score || 0));
  for (const c of sorted) {
    if (c.kind === "viral" && viral.length < AGENT_SEUNG_RAG.maxForceCards) viral.push(c);
    else if (c.kind === "writing" && writing.length < AGENT_SEUNG_RAG.maxFormCards) writing.push(c);
    else if (c.kind === "unknown") rest.push(c);
  }
  const unknownRoom = AGENT_SEUNG_RAG.maxForceCards + AGENT_SEUNG_RAG.maxFormCards - viral.length - writing.length;
  return [...viral, ...writing, ...rest.slice(0, Math.max(0, unknownRoom))];
}

export function theoryChunksForModel(chunks: TheoryChunk[]): string {
  const kept = capTheoryChunks(chunks).filter((c) => c.chunk_content);
  if (!kept.length) {
    return "Collection 검색 없음. 시드에 없는 힘을 만들지 마라. 이론 이름을 쓰지 마라.";
  }
  return kept
    .map((c, i) => `카드 ${i + 1} (${c.kind === "writing" ? "형식" : c.kind === "viral" ? "힘" : "참고"}):\n${c.chunk_content}`)
    .join("\n\n");
}
