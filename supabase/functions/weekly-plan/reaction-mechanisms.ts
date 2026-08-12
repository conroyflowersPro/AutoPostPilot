/**
 * ORDER 2 — 9 Reaction Mechanism structured definitions.
 * Abstract reasoning only. NO topic/keyword→mechanism mapping. NO style/rail decision.
 */
export type MechanismId =
  | "M1_SURPRISE_DEBATE_CHANGE" | "M2_EXPERIENCE_EMPATHY" | "M3_EVIDENCE_JUDGMENT"
  | "M4_LIFE_PATTERN_EXPOSURE" | "M5_SHARED_TENSION_REVERSAL" | "M6_SELF_REFERENTIAL_OBVIOUSNESS"
  | "M7_GROUP_BEHAVIOR_DISCOVERY" | "M8_SELF_DEPRECATING_DISCLOSURE" | "M9_EVERYDAY_BLANK_FILLING"
  | "NONE";

export type MechanismDefinition = {
  mechanism_id: MechanismId;
  intended_reaction: string;
  reasoning_logic: string;
  reader_entry_point: string;
  suitable_context: string[];
  unsuitable_context: string[];
  audience_scope: "broad" | "community" | "niche";
  first_person_option: boolean;
  generalization_risk_default: "LOW" | "MEDIUM" | "HIGH";
  question_required: boolean;
  completion_style: "open" | "closed" | "partial";
};

export const REACTION_MECHANISMS: MechanismDefinition[] = [
  { mechanism_id: "M1_SURPRISE_DEBATE_CHANGE", intended_reaction: "놀람·의견·판단·토론",
    reasoning_logic: "구체 변화/규모 + 예상 밖 지점 → 판단·긴장. 자동 macro conclusion 금지.",
    reader_entry_point: "규모/반전에서 자기 판단", suitable_context: ["measurable_change","scale_contrast","expectation_gap","debate_worthy_claim"],
    unsuitable_context: ["pure_routine","no_contrast"], audience_scope: "broad", first_person_option: false,
    generalization_risk_default: "MEDIUM", question_required: false, completion_style: "open" },
  { mechanism_id: "M2_EXPERIENCE_EMPATHY", intended_reaction: "나도·공감·생활 비교",
    reasoning_logic: "생활 장면→작은 습관→인간 디테일. experience grounding 없으면 1인칭 금지.",
    reader_entry_point: "생활 장면에서 자기 경험", suitable_context: ["lived_scene","habit_shift","human_detail"],
    unsuitable_context: ["no_experience_evidence","forced_emotion"], audience_scope: "broad", first_person_option: true,
    generalization_risk_default: "LOW", question_required: false, completion_style: "open" },
  { mechanism_id: "M3_EVIDENCE_JUDGMENT", intended_reaction: "의견·판단·반론",
    reasoning_logic: "인상과 사실/기준 분리, 일반화 없이 판단 여지. default 금지.",
    reader_entry_point: "인상 vs 근거 분리", suitable_context: ["judgment_problem","rule_vs_feel","evidence_available"],
    unsuitable_context: ["pure_empathy","no_evaluative_axis"], audience_scope: "broad", first_person_option: false,
    generalization_risk_default: "MEDIUM", question_required: false, completion_style: "partial" },
  { mechanism_id: "M4_LIFE_PATTERN_EXPOSURE", intended_reaction: "나도 저럼·주변 사례",
    reasoning_logic: "익숙한 행동에서 반복 패턴 압축 관찰. Topic 자동 매핑 금지.",
    reader_entry_point: "패턴 인식→자기/주변 사례", suitable_context: ["repeated_behavior","familiar_standard","observable_pattern"],
    unsuitable_context: ["one_off_event","no_pattern"], audience_scope: "broad", first_person_option: true,
    generalization_risk_default: "MEDIUM", question_required: false, completion_style: "open" },
  { mechanism_id: "M5_SHARED_TENSION_REVERSAL", intended_reaction: "웃음·기억·비슷한 상황",
    reasoning_logic: "공유 긴장→예상→반전→숨은 디테일. Punchline 후 강제 설명 금지.",
    reader_entry_point: "긴장→반전에서 상황 회상", suitable_context: ["shared_tension","expectation_set","reversal_available"],
    unsuitable_context: ["no_tension","flat_fact_list"], audience_scope: "broad", first_person_option: true,
    generalization_risk_default: "LOW", question_required: false, completion_style: "closed" },
  { mechanism_id: "M6_SELF_REFERENTIAL_OBVIOUSNESS", intended_reaction: "피식·역할/취미 경험",
    reasoning_logic: "외부 놀람이 Creator 역할상 당연한 이유로 재구성. 매우 특정 상황만.",
    reader_entry_point: "당연함 공개→자기 역할 경험", suitable_context: ["role_obviousness","outsider_surprise"],
    unsuitable_context: ["no_role_contrast","generic_news"], audience_scope: "community", first_person_option: true,
    generalization_risk_default: "LOW", question_required: false, completion_style: "closed" },
  { mechanism_id: "M7_GROUP_BEHAVIOR_DISCOVERY", intended_reaction: "나도 봤음·추가 사례",
    reasoning_logic: "공동 상황 반복 행동→가벼운 재해석, 원인 미완. 고일반화 시 first-person.",
    reader_entry_point: "집단 반복 행동→관찰 추가", suitable_context: ["shared_place","repeated_group_behavior"],
    unsuitable_context: ["single_person_only","high_stigma_generalization"], audience_scope: "broad", first_person_option: true,
    generalization_risk_default: "HIGH", question_required: false, completion_style: "open" },
  { mechanism_id: "M8_SELF_DEPRECATING_DISCLOSURE", intended_reaction: "자기 이야기·습관·취향",
    reasoning_logic: "범용 소재에서 Creator가 먼저 불완전 사례 공개. 강제 self-deprecation 금지.",
    reader_entry_point: "자기공개 후 낮은 장벽 공유", suitable_context: ["universal_small_topic","creator_safe_disclosure"],
    unsuitable_context: ["forced_self_deprecation","high_stakes_identity"], audience_scope: "broad", first_person_option: true,
    generalization_risk_default: "LOW", question_required: false, completion_style: "open" },
  { mechanism_id: "M9_EVERYDAY_BLANK_FILLING", intended_reaction: "짧은 답·경험 추가",
    reasoning_logic: "작은 일상 빈칸(이름/이유/방법). 전문가 전용 질문 제외.",
    reader_entry_point: "작은 빈칸에 짧은 답", suitable_context: ["everyday_small_gap","name_or_method_unknown"],
    unsuitable_context: ["expert_only_answer","no_blank"], audience_scope: "broad", first_person_option: false,
    generalization_risk_default: "LOW", question_required: false, completion_style: "open" },
];

export function getMechanismById(id: MechanismId): MechanismDefinition | undefined {
  if (id === "NONE") return undefined;
  return REACTION_MECHANISMS.find((m) => m.mechanism_id === id);
}
export function allMechanismIds(): MechanismId[] {
  return REACTION_MECHANISMS.map((m) => m.mechanism_id);
}
