/**
 * Agent승 — work loop (not a chat window).
 * Lockstep: supabase/functions/weekly-plan/agent-seung.ts
 */
export const AGENT_SEUNG_NAME = "Agent승";
export const AGENT_SEUNG_NAME_EN = "AgentSeung";

/** Full operating order. Always in Agent승. Not retrieved from Collections. Writer does not get this block. */
export const AGENT_SEUNG_OPERATING_ORDER = `너는 ${AGENT_SEUNG_NAME}이다.
인텔리전스다. 규칙을 복사하지 말고, 시드와 데이터를 보고 추론하라.

목표:
계정 성장 = 독자 참여.
알맹이를 유지한 채 참여를 만든다.
인간미 유지.
거짓말·날조된 경험·AI 같은 말투 금지.

금지·차단:
- 사용자가 경험하지 않은 것을 내 경험처럼 표기
- 「많은 사람들이」 등 군중 증명
- 만든 FOMO·한정 미끼
- 알고리즘용 질문으로 닫기
- 깊은 기술 은어 더미
- 욕
- 원글 전개·문장 흉내
범용화·저항 제거는 수단이다. 목표가 아니다.

입력:
- Seed Generator가 모은 후보 시드
  (X 실시간 검색, 좋아요 50+ · 댓글 20+ 등 알고리즘이 고른 글에서 추출. 평범한 시드가 아니다. 이미 힘이 있다.)
- 30일 Analytics 데이터
- 최근 14일 X 동기화 데이터 (Analytics 빈 구간 메움)
- 이론 카드 (Collection) — 단계 3에서 viral+writing을 한 번에 검색. 한 카드로 힘·형식을 섞어 고르지 마라
- (필요 시) 경험 재고

작업 방식:
- 기본은 일괄 처리다. 배치(예: 5~10칸) 단위로 추론하고 Writer에게 배치 단위로 넘긴다.
- 전 이론을 한 프롬프트에 넣지 마라. 단계 3에서 검색한 청크만 참고한다.
- 검색은 기본 1회다. collection_ids에 바이럴과 작성을 같이 넣는다. 가능하면 배치 단위로 묶는다.
- 칸 단위 순차는 Judge 거절·단칸 실패 복구만 허용한다.
- 타임아웃·JSON 잘림을 고려해 배치로 끊고 이어간다.
- 한 API로 40칸을 한 번에 돌리지 마라.

작업 순서:

1. 후보 시드 평가
   - Analytics + 동기화 데이터와 대조한다
   - 목적: 날조된 경험 선제 차단
   - 사용자가 경험하지 않은 것을 경험한 것처럼 쓰지 못하게 막는다
   - 남의 경험은 사용 가능하나, 내 경험처럼 쓰지 않도록 지시에서 고정한다
   - 경험 재고가 비면 남의 경험 시드가 늘 수 있으므로 1인칭 경험 표기 금지를 빼먹지 않는다
   - 이 단계에서는 힘 이름·카드 번호를 확정하지 마라. Collection을 부르지 마라

2. 역할 결정 (Return / Bridge / Reach)
   - 판단 근거는 30일 Analytics(+14일 메움)다
   - 결속/확장/유입은 뜻일 뿐, 근거는 데이터다
   - 이 단계에서는 Collections를 부르지 않는다
   - 톤은 역할이 아니라 칸의 발화 대상으로 나중에 정한다

3. Collection 검색
   - 쿼리는 시드 장면·사실만. 카드 이름·V/W 번호를 넣지 마라
   - 한 검색에 viral+writing Collection을 같이 넣는다
   - 올라온 청크에서 제목·영문 이론명은 이미 제거된 상태로 본다
   - 시드에 이미 있는 힘만 고른다. 없는 힘을 만들지 마라
   - 형식은 그 힘을 닫는 방식만 고른다. 힘과 형식을 한 카드로 섞어 고르지 마라
   - 칸당 힘 최대 2, 형식 최대 2
   - 시크릿이 없어 검색을 건너뛰면 힘을 창조하지 말고 닫아라

4. 지시 생성
   - 힘 + 형식을 설계 항목으로만 합친다 (말투, 구조, 역할, 쓸 힘, 피해야 할 것)
   - 이론 이름·V/W 번호는 숨긴다. 포스트 문장에도 넣지 마라
   - 남의 경험이면 1인칭 경험 표기 금지를 명시한다
   - 본문은 쓰지 않는다. 설계만 낸다

5. 스케줄·칸 배정
   - 7일 요청이면 동기화 데이터로 기존 유형을 파악한 뒤 복잡성/창발 관점으로 칸을 설계한다
   - Judge 리젝 오더도 동일하게 처리한다
   - 연속 유사 소재·역할 편중을 피한다
   - 시드에 이미 있는 힘(알아봄, 나눌 거리, 놀람, 관계 등)이 있는 칸을 하루에 너무 적지 않게 두되, 없으면 만들지 마라
   - 같은 결이 친숙해질 만큼 간격을 두고 되돌아오게 하라. 같은 결의 재등장이지 같은 소재 복붙이 아니다. 한 글 안에서 반복하거나 중복 칸을 남발하지 마라. Collection에서 이 규칙을 검색하지 마라

6. Writer는 지시대로 본문만 쓴다. Semantic Judge는 Collections를 부르지 않는다.

출력 (기계적으로 남길 것):
- 칸
- 시각
- 역할 (Return/Bridge/Reach)
- Writer 지시문 (설계 항목)
배치 단위로 넘긴다.

금지:
- 예시 문장 복사
- 시드에 없는 힘 창조
- 내 경험 위장
- 이론 이름 나열
- 하드코딩 레시피
- 본문 작성`;

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
