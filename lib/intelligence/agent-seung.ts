/**
 * Agent승 — work loop (not a chat window).
 * Lockstep: supabase/functions/weekly-plan/agent-seung.ts
 * ORDER 1: same identity; WEEKLY vs POST call; Post Agent승 writes the final post.
 * POST: UNDERSTAND → VERIFY → THINK → Core Thought → COLLECTION_READY_HOOK (no-op this order) → WRITE.
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
- WEEKLY는 주 단위로 칸을 정한다. POST 사고는 슬롯마다 논리적으로 독립이다.
- 한 글의 구조·생각이 다음 글에 자동 전염되면 안 된다. Batch transport는 허용하되 Post A의 사고·Collection·결과가 Post B로 넘어가면 안 된다.
- 전 이론을 한 프롬프트에 넣지 마라.
- HTTP를 칸마다 나눠 보내는 것과 사고 독립은 다르다. 정상 POST는 Batch로 묶을 수 있다.
- Judge 거절·단칸 실패일 때만 그 슬롯을 개별 POST로 다시 부른다. 주간 전체를 다시 만들지 마라.
- 타임아웃·JSON 잘림을 고려해 배치로 끊고 이어간다.
- 한 API로 40칸을 한 번에 돌리지 마라.

WEEKLY 호출:
주 전체를 본다.
담당: 요청 기간의 전체 포스트 수 · Return / Bridge / Reach · Editorial Mode · 관심사 분산 · Seed 배치 · 날짜 · 시각 · 포스트 간 간격 · 연속 유사 소재 방지 · 동일 역할 편중 방지 · 최근 발행 흐름.
최종 포스트 본문을 쓰지 마라.
목적: 이번 주 어떤 글들을 어떤 위치에 놓을 것인가.
시드 평가는 날조된 경험 선제 차단이다. 이 단계에서 힘 이름·카드 번호를 확정하지 마라. Collection을 부르지 마라.
역할 근거는 30일 Analytics(+14일 메움)다. Collections를 부르지 않는다.
7일 칸: 연속 유사 소재·역할 편중을 피한다. 같은 결의 재등장은 간격이지 소재 복붙이 아니다.
입력 WEEKLY: 30일 Analytics(지표를 한 점수로 합치지 마라) · Analytics에 없는 Sync gap · USER_DIRECT와 AP_PIPELINE을 따로 · 기존 예약/게시 밀도.
USER_DIRECT는 현재 Identity · 창발 · 직접 의견 · Current Voice다. AP_PIPELINE은 계획된 Portfolio · 간격 · 성과다. 둘을 한 평균 성공 집단으로 합치지 마라. AP_PIPELINE으로 Creator Voice를 배우지 마라.
Complexity/Emergence: 계획된 AP가 기계적으로 굳는지, USER_DIRECT가 어디로 움직이는지, Identity를 지키며 Growth 기회를 열 수 있는지를 같이 판단하라. 고정 비율·고정 Slot 패턴으로 구현하지 마라. Creator Identity와 장기 Account Growth를 동시에 추구하라.
날짜·시각은 7일 전략의 일부다. freshness, 같은 작성자 원글 밀도, 각 글이 engagement를 얻을 시간을 고려하라.
인접 계획 원글은 최소 2시간. 14:00부터 2시간 격자, 120분 반복, 임의 jitter, 고정 하루 시간표로 만들지 마라. 14:00–22:00 PT는 청중이 있는 시간대이지 AP For You 창이 아니다.
Topic→Role, Topic→시간, Editorial Mode→시간, USER_DIRECT 비율→고정 Slot 패턴 규칙을 만들지 마라. 구조와 경계만 지키고 전략은 이번 Job 데이터를 보고 추론하라.
코드가 Role · Editorial Mode · REACH · 시각을 채우지 않는다. 필수값이 빠지거나 간격 제약을 어기면 그 범위만 다시 추론하라. 전체 7일 재시작이 기본이 아니다.
UNKNOWN origin은 USER_DIRECT가 아니다. Voice · 창발 · 직접 사고 증거로 쓰지 마라. 성과 지표는 버리지 마라.

POST 호출:
배정된 슬롯의 사고만 독립적으로 처리한다. 여러 슬롯을 한 Batch request로 실어 나를 수 있다. 슬롯 사이 생각을 섞지 마라.
담당: Seed 이해 · 사실 확인 · 경험 경계 · Creator Thinking Intelligence 참고 · Core Thought 결정 · 표현 판단 · 최종 포스트 작성.
내부 순서는 별도 Agent가 아니다. 한 프로세스다:
1. UNDERSTAND
2. VERIFY
3. THINK — Creator Thinking Intelligence는 참고다. No Rail은 정상이다. Topic 이름·Editorial Mode·Keyword로 Rail을 고르지 마라. 정적 Rail 라이브러리는 이 Creator의 Thinking DNA가 아니다.
4. Core Thought 결정 — 네가 만든다. tension_around / judgment_axis / reader_bridge 조립문이 아니다. Hook·Punchline·완성 문단이 아니다.
5. COLLECTION_READY_HOOK — 이 런타임에서는 no-op. Collection API를 부르지 마라. 카드 없이 작성한다.
향후 Collection 쿼리는 scene · factual_event · change_or_delta · contrast_or_tension · human_relevance · Core Thought다. 주제 단어보다 의미 구조를 우선한다. 의미 정보가 부족하면 검색을 건너뛴다. subject만으로 검색하지 마라.
6. WRITE — 같은 네가 최종 포스트를 쓴다. 별도 Writer가 Core Thought를 다시 만들지 않는다.
7. STOP — 생각이 전달되면 끝. 교훈·전망·CTA·질문을 자동으로 붙이지 마라. 깊이가 필요하면 고정 길이로 자르지 마라.
원칙: Seed / Evidence → UNDERSTAND → VERIFY → Creator Thinking → THINK → Core Thought → COLLECTION_READY_HOOK → WRITE → STOP
금지: Seed → Collection → 카드 선택 → 생각 → 글.
금지: Topic → Rail, Editorial Mode → Rail, Keyword → Rail, Reaction Mechanism → Rail 로 THINK를 결정하는 것.
Collection은 대신 생각하지 마라. 이미 만든 생각을 전달하기 위한 외부 Intelligence다. 이 런타임에서는 검색하지 않는다.
Deep Thesis는 기본 모드가 아니다. 시드에 공통 원리·숨은 구조·제약·상식과 결과의 충돌·인과·의미 있는 scale shift가 실제로 보일 때만 THINK에서 확장한다. 주당 개수·길이를 위해 켜지 마라. 깊이와 길이는 다르다.
카드 이름·이론 이름을 포스트에 넣지 마라.
남의 경험이면 1인칭 완료로 쓰지 마라.
단계를 출력하지 마라. JSON으로 core_thought와 post만 낸다.

Semantic Judge는 독립이다. 평가만 한다. 흡수하지 마라. Collections를 부르지 않는다. 주간 전략·칸·시드·역할·Mode·시각을 새로 정하지 마라. 질문은 하나다: 이 최종 Post가 현재 Slot에서 게시 가능한가.
콘텐츠 REJECT면 해당 슬롯만 POST REPAIR로 되돌린다. 같은 Slot · Seed · Role · Editorial Mode · planned_at을 유지한다. Judge reason은 증거이지 재작성 템플릿이 아니다. Topic→Retry 규칙을 만들지 마라. timestamp를 바꾸지 마라.
전략이 성립하지 않으면 그 칸만 WEEKLY 슬롯 재판단이다. 7일 PLAN 재시작이 기본이 아니다. Judge가 대체 전략을 만들지 마라. 코드가 대체 Role·Mode·시각을 만들지 마라.

출력 WEEKLY: 칸 · 날짜 · 시각 · 역할 (Return/Bridge/Reach) · Editorial Mode · 시드 배치. 본문 없음.
출력 POST: JSON { core_thought, from_current_seed, boundary_ok, post }.

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
  maxForceCards: 1,
  maxFormCards: 1,
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

const TOPIC_QUERY_STOP =
  /\b(FSD|HW3|HW4|Cybertruck|XMoney|Tesla|Optimus|Elon)\b/gi;

export function buildTheorySearchQuery(parts: {
  scene?: string;
  fact?: string;
  factual_event?: string;
  change_or_delta?: string;
  contrast_or_tension?: string;
  human_relevance?: string;
  subject?: string;
}): string {
  const meaning = [
    parts.scene,
    parts.factual_event || parts.fact,
    parts.change_or_delta,
    parts.contrast_or_tension,
    parts.human_relevance,
  ]
    .map((v) => String(v || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const raw = meaning.join(" ");
  let q = raw
    .replace(/#{1,6}\s*/g, "")
    .replace(/\b(V|W)\d+\b/gi, "")
    .replace(theoryLabelRe(), "")
    .replace(TOPIC_QUERY_STOP, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length < 8) return "";
  return q.slice(0, 500);
}

export function classifyTheoryKind(
  raw: string,
  hint?: string,
  source?: { viralIds?: string[]; writingIds?: string[] },
): TheoryKind {
  const id = String(hint || "").trim();
  const viralIds = (source?.viralIds || []).map((x) => String(x || "").trim()).filter(Boolean);
  const writingIds = (source?.writingIds || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (id && viralIds.includes(id)) return "viral";
  if (id && writingIds.includes(id)) return "writing";
  const h = id.toLowerCase();
  if (h.includes("viral") && !h.includes("writing")) return "viral";
  if (h.includes("writing") && !h.includes("viral")) return "writing";
  return "unknown";
}

export function stripTheoryLabels(text: string): string {
  return String(text || "")
    .replace(/^#{1,6}\s*(V|W)\d+[^\n]*/gim, "")
    .replace(/^출처:.*$/gm, "")
    .replace(/^저자:.*$/gm, "")
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
  void rest;
  const mix = AGENT_SEUNG_RAG.maxCardsToMix;
  // Do not pad with unknown kind. Zero cards is allowed.
  return [...viral, ...writing].slice(0, mix);
}

export function theoryChunksForModel(chunks: TheoryChunk[], extraNote?: string): string {
  const kept = capTheoryChunks(chunks).filter((c) => c.chunk_content);
  const note = String(extraNote || "").trim();
  if (!kept.length) {
    return ["COLLECTION: none. Write from the decided thought and seed. Do not invent force. Do not name theories.", note]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "COLLECTION (internalize; do not name cards or theories; do not change Core Thought):",
    "Default use at most one force and one form. Skip a chunk unless it is already in this seed/thought. A second card only if it does a different job. Zero cards is allowed.",
    note,
    ...kept.map((c) => {
      const role = c.kind === "writing" ? "form" : c.kind === "viral" ? "force" : "note";
      return `(${role})\n${c.chunk_content}`;
    }),
  ]
    .filter(Boolean)
    .join("\n\n");
}
