/**
 * ORDER 1 — Core Thought + Thinking Rail + Audience Translation
 * Lightweight stages only. No new independent engine.
 * Writing DNA remains final-expression only.
 */

export type CoreThought = {
  claim: string; // one short claim / observation / interpretation (not full post)
  type: "OBSERVATION" | "INTERPRETATION" | "CLAIM" | "COMPARISON";
};

export type ThinkingRailId =
  | "expect_vs_reality"
  | "concrete_number_to_meaning"
  | "presence_over_perfection"
  | "hardware_vs_digital"
  | "scale_shift"
  | "daily_habit_shift"
  | "polarizing_asset"
  | "open_judgment";

export type ThinkingRail = {
  id: ThinkingRailId;
  label: string;
  structure: string[]; // short step labels only
  when: string;
};

/** Static catalog — structure only, no finished sentences */
export const THINKING_RAIL_LIBRARY: ThinkingRail[] = [
  {
    id: "expect_vs_reality",
    label: "기대 → 실제",
    structure: ["일반적 기대", "실제 관찰", "차이 의미"],
    when: "사람들이 흔히 갖는 기대와 실제 경험이 다를 때",
  },
  {
    id: "concrete_number_to_meaning",
    label: "숫자 → 의미",
    structure: ["구체 숫자/규모", "체감 환산", "함의"],
    when: "규모·비용·성능 등 숫자가 핵심일 때",
  },
  {
    id: "presence_over_perfection",
    label: "완벽보다 존재감",
    structure: ["단점/미완성 인정", "그럼에도 남는 존재감", "자산으로 읽기"],
    when: "완성도보다 주목·기억·논쟁이 더 클 때",
  },
  {
    id: "hardware_vs_digital",
    label: "하드웨어 vs 디지털",
    structure: ["겁으로 보이는 것", "덟 보이는 축적", "장기 격차"],
    when: "로봇/AI/소프트웨어 경험 데이터가 핵심일 때",
  },
  {
    id: "scale_shift",
    label: "스케일 이동",
    structure: ["개인/제품 관찰", "산업·문화 의미로 확장"],
    when: "한 제품이 시장·디자인·경쟁 구도를 바꼀 수 있을 때",
  },
  {
    id: "daily_habit_shift",
    label: "일상 습관 변화",
    structure: ["이전 기본값", "새 기본값 징후", "전환 시점"],
    when: "FSD·자동화 등 ‘켜놓고 가는 게 편해지는’ 순간이 핵심일 때",
  },
  {
    id: "polarizing_asset",
    label: "호불호 = 자산",
    structure: ["호불호가 갈림", "그럼에도 다들 봄", "그 자체가 가치"],
    when: "디자인·제품이 강하게 갈라놓을 때",
  },
  {
    id: "open_judgment",
    label: "열린 판단",
    structure: ["관찰", "양면 인정", "단정 없이 여운"],
    when: "성공/실패를 단정하기 이르고 논쟁 여지를 남길 때",
  },
];

export function selectThinkingRailHint(input: {
  topic?: string;
  editorial_mode?: string;
  coreThoughtType?: string;
}): ThinkingRail {
  const topic = String(input.topic || "").toUpperCase();
  const mode = String(input.editorial_mode || "").toUpperCase();

  if (/OPTIMUS|로봇|DIGITAL/.test(topic)) return THINKING_RAIL_LIBRARY[3];
  if (/FSD|AUTOPILOT/.test(topic)) return THINKING_RAIL_LIBRARY[5];
  if (/CYBERTRUCK|CYBER/.test(topic)) return THINKING_RAIL_LIBRARY[6];
  if (/TERAFAB|칩|반도체|FAB/.test(topic)) return THINKING_RAIL_LIBRARY[1];
  if (mode === "COMPARE") return THINKING_RAIL_LIBRARY[0];
  if (mode === "OPINION") return THINKING_RAIL_LIBRARY[7];
  if (mode === "CASUAL_OBSERVATION") return THINKING_RAIL_LIBRARY[0];
  return THINKING_RAIL_LIBRARY[0];
}

/** Prompt fragment: forces Seed → Core Thought → Rail → Audience Translation → Writing */
export function buildThoughtStagesInstructions(): string {
  return `
GENERATION STAGES (must follow in order — do not skip to final sentences):

1) CORE THOUGHT (exactly one per post)
   - One short claim / observation / interpretation only
   - NOT a full paragraph, NOT a polished post
   - No invented experience, no unsupported fact expansion
   - Do not widen the seed beyond its scope

2) THINKING RAIL (structure only)
   - Choose one rail that fits Topic + Editorial Mode + Core Thought + available evidence
   - Use step labels only (e.g. 기대 → 실제 → 의미). Do NOT copy finished posts
   - Do not force long-term vision or strong opinion on every post

3) AUDIENCE TRANSLATION
   - Before final wording, translate the thought into everyday language where helpful:
     일상 / 사람 / 돈 / 시간 / 직장 / 생활 / 경쟁 / 익숙한 행동 / 구체 장면 / 보편 감정
   - Keep technical meaning intact. No forced metaphors. No distortion of facts.
   - If no good everyday bridge exists, keep the original precise term.

4) WRITING DNA (final expression only)
   - Apply only after stages 1–3: vocabulary, rhythm, sentence length, endings, emphasis
   - Writing DNA must NOT decide Core Thought, Rail, facts, or experience

DENSITY:
- One Core Thought, one main rail flow, at most one primary audience translation, one natural close
- Prefer X reading flow over exhaustive explanation. No repeated meaning.

OUTPUT per post must include:
- core_thought: short string (the one thought)
- thinking_rail: rail id or short label
- audience_translation: short note or null
- content: final Korean post
- score: 1-10
`;
}

export function validateCoreThought(raw: string): { ok: boolean; reason?: string } {
  const t = String(raw || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > 120) return { ok: false, reason: "too_long_for_core_thought" };
  if (/[.!?]{2,}/.test(t) || t.split(/[.!?]/).filter(Boolean).length > 2) {
    return { ok: false, reason: "looks_like_full_sentences" };
  }
  return { ok: true };
}
