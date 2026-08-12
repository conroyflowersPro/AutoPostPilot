/**
 * ORDER 2 — 9 Reaction Mechanism structured definitions.
 * Abstract reasoning only. NO topic/keyword mapping. NO style/rail.
 */

export type MechanismId =
  | "NONE"
  | "M1_SHARED_EXPERIENCE_INVITE"
  | "M2_BOUNDARY_CLARITY"
  | "M3_PRACTICAL_TIP_SHARE"
  | "M4_OBSERVATION_SPARK"
  | "M5_LIGHT_HUMOR_RELAY"
  | "M6_CURIOSITY_OPEN"
  | "M7_GROUP_BEHAVIOR_DISCOVERY"
  | "M8_SELF_DEPRECATING_DISCLOSURE"
  | "M9_EVERYDAY_BLANK_FILLING";

export interface MechanismDefinition {
  mechanism_id: MechanismId;
  intended_reaction: string;
  participation_barrier: "low" | "medium" | "high";
  comprehension_barrier: "low" | "medium" | "high";
  self_projection_strength: "low" | "medium" | "high";
  story_invitation: boolean;
  question_required: boolean;
  selection_hint: string;
}

export const REACTION_MECHANISMS: MechanismDefinition[] = [
  { mechanism_id: "NONE", intended_reaction: "없음 (정보/기록만)",
    participation_barrier: "high", comprehension_barrier: "low", self_projection_strength: "low",
    story_invitation: false, question_required: false,
    selection_hint: "독자 참여 유도 없이 정보·관찰 전달" },
  { mechanism_id: "M1_SHARED_EXPERIENCE_INVITE", intended_reaction: "비슷한 경험 공유",
    participation_barrier: "low", comprehension_barrier: "low", self_projection_strength: "high",
    story_invitation: true, question_required: false,
    selection_hint: "독자가 자신의 비슷한 경험을 떠올리기 쉬운 장면" },
  { mechanism_id: "M2_BOUNDARY_CLARITY", intended_reaction: "동의/경계 인식",
    participation_barrier: "medium", comprehension_barrier: "medium", self_projection_strength: "medium",
    story_invitation: false, question_required: false,
    selection_hint: "사실과 의견 경계를 분명히 할 때" },
  { mechanism_id: "M3_PRACTICAL_TIP_SHARE", intended_reaction: "팁 저장·적용 의향",
    participation_barrier: "low", comprehension_barrier: "low", self_projection_strength: "medium",
    story_invitation: false, question_required: false,
    selection_hint: "바로 쓸 수 있는 실용 정보" },
  { mechanism_id: "M4_OBSERVATION_SPARK", intended_reaction: "관찰에 대한 짧은 반응",
    participation_barrier: "low", comprehension_barrier: "low", self_projection_strength: "medium",
    story_invitation: false, question_required: false,
    selection_hint: "일상 관찰로 공감·댓글 유도" },
  { mechanism_id: "M5_LIGHT_HUMOR_RELAY", intended_reaction: "웃음·릴레이",
    participation_barrier: "low", comprehension_barrier: "low", self_projection_strength: "medium",
    story_invitation: false, question_required: false,
    selection_hint: "가벼운 유머로 분위기 전달" },
  { mechanism_id: "M6_CURIOSITY_OPEN", intended_reaction: "궁금증·추가 질문",
    participation_barrier: "medium", comprehension_barrier: "medium", self_projection_strength: "medium",
    story_invitation: false, question_required: false,
    selection_hint: "열린 호기심을 남기는 관찰" },
  { mechanism_id: "M7_GROUP_BEHAVIOR_DISCOVERY", intended_reaction: "집단 행동 인식",
    participation_barrier: "medium", comprehension_barrier: "medium", self_projection_strength: "high",
    story_invitation: true, question_required: false,
    selection_hint: "우리/그들 패턴을 발견하게 함" },
  { mechanism_id: "M8_SELF_DEPRECATING_DISCLOSURE", intended_reaction: "공감·자기 고백",
    participation_barrier: "low", comprehension_barrier: "low", self_projection_strength: "high",
    story_invitation: true, question_required: false,
    selection_hint: "가벼운 자기 비하로 거리 좁히기" },
  { mechanism_id: "M9_EVERYDAY_BLANK_FILLING", intended_reaction: "짧은 답·경험 추가",
    participation_barrier: "low", comprehension_barrier: "low", self_projection_strength: "high",
    story_invitation: true, question_required: false,
    selection_hint: "빈칸을 독자가 채우기 쉬운 일상 장면" },
];

export function getMechanismById(id: MechanismId): MechanismDefinition | undefined {
  return REACTION_MECHANISMS.find((m) => m.mechanism_id === id);
}

export function listMechanismIds(): MechanismId[] {
  return REACTION_MECHANISMS.map((m) => m.mechanism_id);
}
