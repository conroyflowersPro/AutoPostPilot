/**
 * X Account Growth OS v10 — ORDER 1
 * Reaction Mechanism Library + Reasoning Selection
 *
 * NOT a sentence template library.
 * NOT Editorial Mode / Thinking Rail / Writing DNA / Creator DNA.
 * Only: where the reader can project their own story / opinion / memory.
 */

export type ReactionMechanismId =
  | "surprise_debate_shift"
  | "experience_empathy"
  | "evidence_judgment"
  | "life_pattern_expose"
  | "shared_tension_punch"
  | "self_reference_obvious"
  | "collective_pattern_report"
  | "self_deprecating_open"
  | "everyday_blank_fill";

export type ReactionMechanism = {
  id: ReactionMechanismId;
  label_ko: string;
  reader_moves: string[];
  select_when: string;
  avoid: string[];
};

export const REACTION_MECHANISM_LIBRARY: ReactionMechanism[] = [
  {
    id: "surprise_debate_shift",
    label_ko: "놀람·논쟁·변화형",
    reader_moves: ["놀람", "반박", "동의", "판단"],
    select_when: "기대와 다른 해석·변화가 있고, 의견이 갈릴 여지가 있을 때",
    avoid: ["질문 강제", "경험 발명", "정답 설교"],
  },
  {
    id: "experience_empathy",
    label_ko: "경험·공감형",
    reader_moves: ["공감", "자기 경험", "비슷하게 겪은 상황"],
    select_when: "일반인이 바로 이해할 생활/관찰 장면이 있고 1인칭 자기관찰이 자연스러울 때",
    avoid: ["집단 일반화 억지", "미검증 개인 경험 날조"],
  },
  {
    id: "evidence_judgment",
    label_ko: "근거 기반 판단형",
    reader_moves: ["판단", "자기 의견", "근거 비교"],
    select_when: "공개된 사실·숫자·비교축이 있고 독자가 자기 판단을 붙일 수 있을 때",
    avoid: ["사실 확장", "단정 강요"],
  },
  {
    id: "life_pattern_expose",
    label_ko: "생활 패턴 폭로형",
    reader_moves: ["자기 습관", "자기 발견", "웃음"],
    select_when: "일상 습관·반복 행동이 보이지만 설교가 아닌 관찰로 남을 때",
    avoid: ["훈계", "완벽한 해결책 제시"],
  },
  {
    id: "shared_tension_punch",
    label_ko: "공유 긴장 → 반전 → 숨은 디테일/펀치라인형",
    reader_moves: ["긴장", "반전", "기억", "웃음"],
    select_when: "작은 긴장이 있고 끝에 가벼운 디테일/반전이 자연스러울 때",
    avoid: ["같은 펀치라인 구조 반복", "예문 복제"],
  },
  {
    id: "self_reference_obvious",
    label_ko: "자기참조 당연함형",
    reader_moves: ["자기 발견", "동조", "짧은 맞장구"],
    select_when: "독자가 이미 알고 있던 것을 새 각도로 비출 때",
    avoid: ["거창한 결론", "장문 설명"],
  },
  {
    id: "collective_pattern_report",
    label_ko: "집단 행동 발견형 / 이상한 공통패턴 제보형",
    reader_moves: ["제보", "나도 봄", "패턴 공유"],
    select_when: "여러 사람에게서 보이는 이상하거나 재미있는 공통 행동이 관찰될 때",
    avoid: ["통계 없는 단정", "특정 집단 비하"],
  },
  {
    id: "self_deprecating_open",
    label_ko: "자조적 자기공개 → 참여 허들 하강형",
    reader_moves: ["자기 공개", "공감", "가벼운 참여"],
    select_when: "작성자가 완벽하지 않음을 드러내면 독자 참여 비용이 낮아질 때",
    avoid: ["과한 자학", "경험 조작"],
  },
  {
    id: "everyday_blank_fill",
    label_ko: "생활 속 빈칸 채우기형",
    reader_moves: ["한마디 답변", "아 그거", "짧은 경험"],
    select_when: "범용 생활 상황에 작은 궁금증/빈칸이 있고, 작성자가 완성 답을 안 줘도 독자가 짧게 답할 수 있을 때",
    avoid: ["직접 질문 강제", "정답 제시 후 질문", "높은 사고 비용"],
  },
];

export function buildReactionMechanismInstructions(): string {
  const catalog = REACTION_MECHANISM_LIBRARY.map(
    (m) => `- ${m.id} (${m.label_ko}): when=${m.select_when}`
  ).join("\n");

  return `
REACTION MECHANISM (v10 — separate from Editorial Mode / Thinking Rail / Writing DNA):

Purpose: design so the reader can naturally recall ONE of:
self-discovery | memory | habit | opinion | someone around them | similar situation.
Goal is NOT forcing comments. The post should feel like "나도 이런 야기 하나 해보고 싶다".

Do NOT pick a mechanism immediately from the seed name.
Internally reason first:
1) What human, everyday situation is understandable from this seed?
2) What experience might the reader project?
3) Easiest reader move: empathy | self-discovery | opinion | memory | laugh | surprise | judgment | short answer?
4) Does commenting require heavy thinking? Prefer lower cost when possible.
5) Is first-person self-observation more natural than group generalization?
6) Can readers share without an explicit question at the end?
7) Avoid repeating the same mechanism as recent posts if known.

Then choose ONE mechanism from:
${catalog}

Rules:
- Mechanism is NOT a sentence template. Do not copy past viral wording.
- Do not lock tone, length, or endings to a mechanism.
- Do not auto-append "여러분은 어떠신가요?" or any explicit ask-for-comments.
- Do not invent experiences for reaction.
- Do not force group generalization for fake empathy.
- everyday_blank_fill: leave a small blank; do not complete the answer yourself; keep reply cost very low.

OUTPUT field per post:
- reaction_mechanism: mechanism id
- reaction_reason: one short phrase (why this mechanism for this seed — reasoning, not template name)
`;
}

export function hintReactionMechanism(input: {
  topic?: string;
  editorial_mode?: string;
  recent_mechanism_ids?: string[];
}): ReactionMechanism {
  const topic = String(input.topic || "").toUpperCase();
  const mode = String(input.editorial_mode || "").toUpperCase();
  const recent = new Set(input.recent_mechanism_ids || []);

  let preferred: ReactionMechanismId = "experience_empathy";
  if (/FSD|AUTOPILOT|정체|습관/.test(topic) || mode === "CASUAL_OBSERVATION") {
    preferred = "life_pattern_expose";
  } else if (/TERAFAB|칩|숫자|투자|비교/.test(topic) || mode === "COMPARE") {
    preferred = "evidence_judgment";
  } else if (/CYBERTRUCK|디자인|호불호/.test(topic)) {
    preferred = "surprise_debate_shift";
  } else if (/OPTIMUS|로봇|디지털/.test(topic)) {
    preferred = "self_reference_obvious";
  } else if (mode === "OPINION") {
    preferred = "surprise_debate_shift";
  }

  const pick =
    REACTION_MECHANISM_LIBRARY.find((m) => m.id === preferred) ||
    REACTION_MECHANISM_LIBRARY[1];

  if (recent.has(pick.id)) {
    const alt = REACTION_MECHANISM_LIBRARY.find((m) => !recent.has(m.id));
    return alt || pick;
  }
  return pick;
}

export function isValidReactionMechanismId(id: string): boolean {
  return REACTION_MECHANISM_LIBRARY.some((m) => m.id === id);
}
