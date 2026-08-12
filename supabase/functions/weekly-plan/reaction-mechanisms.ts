/**
 * ORDER 2 — 9 Reaction Mechanism structured definitions.
 * Abstract reasoning only. NO topic/keyword→mechanism mapping. NO style/rail decision.
 */
export type MechanismId =
  | "M1_SURPRISE_GAP"
  | "M2_EXPERIENCE_BOUNDARY"
  | "M3_STATUS_RECOGNITION"
  | "M4_PRACTICAL_UTILITY"
  | "M5_IDENTITY_AFFIRMATION"
  | "M6_ANTICIPATION_HOOK"
  | "M7_GROUP_BEHAVIOR_DISCOVERY"
  | "M8_SELF_DEPRECATING_DISCLOSURE"
  | "M9_EVERYDAY_BLANK_FILLING";

export type MechanismDefinition = {
  mechanism_id: MechanismId;
  intended_reaction: string;
  reader_projection_axis: string;
  risk_notes: string;
  generalization_risk_default: "LOW" | "MEDIUM" | "HIGH";
  question_required: boolean;
  completion_style: "open" | "partial" | "closed";
};

export const REACTION_MECHANISMS: MechanismDefinition[] = [
  { mechanism_id: "M1_SURPRISE_GAP", intended_reaction: "의외성·빈틈 인식",
    reader_projection_axis: "expectation_vs_reality", risk_notes: "과장 금지",
    generalization_risk_default: "MEDIUM", question_required: false, completion_style: "open" },
  { mechanism_id: "M2_EXPERIENCE_BOUNDARY", intended_reaction: "경험 경계 공감",
    reader_projection_axis: "lived_vs_observed", risk_notes: "1인칭 과장 금지",
    generalization_risk_default: "LOW", question_required: false, completion_style: "open" },
  { mechanism_id: "M3_STATUS_RECOGNITION", intended_reaction: "상태 인정",
    reader_projection_axis: "current_state_mirror", risk_notes: "진단톤 금지",
    generalization_risk_default: "MEDIUM", question_required: false, completion_style: "partial" },
  { mechanism_id: "M4_PRACTICAL_UTILITY", intended_reaction: "실용 힌트 흡수",
    reader_projection_axis: "actionable_takeaway", risk_notes: "강의톤 금지",
    generalization_risk_default: "MEDIUM", question_required: false, completion_style: "open" },
  { mechanism_id: "M5_IDENTITY_AFFIRMATION", intended_reaction: "정체성 긍정",
    reader_projection_axis: "belonging_signal", risk_notes: "집단 강요 금지",
    generalization_risk_default: "LOW", question_required: false, completion_style: "closed" },
  { mechanism_id: "M6_ANTICIPATION_HOOK", intended_reaction: "다음 기대",
    reader_projection_axis: "forward_curiosity", risk_notes: "클리프행어 남용 금지",
    generalization_risk_default: "LOW", question_required: false, completion_style: "closed" },
  { mechanism_id: "M7_GROUP_BEHAVIOR_DISCOVERY", intended_reaction: "집단 패턴 발견",
    reader_projection_axis: "we_pattern", risk_notes: "일반화 위험 — 1인칭 우선",
    generalization_risk_default: "HIGH", question_required: false, completion_style: "open" },
  { mechanism_id: "M8_SELF_DEPRECATING_DISCLOSURE", intended_reaction: "약한 자기공개 공감",
    reader_projection_axis: "vulnerability_mirror", risk_notes: "자학 과잉 금지",
    generalization_risk_default: "LOW", question_required: false, completion_style: "open" },
  { mechanism_id: "M9_EVERYDAY_BLANK_FILLING", intended_reaction: "짧은 답·경험 추가",
    reader_projection_axis: "everyday_completion", risk_notes: "질문 강요 금지",
    generalization_risk_default: "LOW", question_required: false, completion_style: "open" },
];

export function getMechanism(id: MechanismId): MechanismDefinition | undefined {
  return REACTION_MECHANISMS.find((m) => m.mechanism_id === id);
}

export function allMechanismIds(): MechanismId[] {
  return REACTION_MECHANISMS.map((m) => m.mechanism_id);
}
