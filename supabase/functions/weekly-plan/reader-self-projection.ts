/**
 * ORDER 2 — Reader Self-Projection Reasoning + Reaction Mechanism Selection
 * After Seed Interpretation. Before Thinking Rail / Style / Humor / Writing.
 * NO topic→mechanism. NO style/rail. NO forced questions. ORDER 0B/1 preserved.
 */
import type { SeedInterpretation } from "./seed-interpretation.ts";
import { REACTION_MECHANISMS, type MechanismId, type MechanismDefinition, getMechanismById } from "./reaction-mechanisms.ts";

export type SelfProjectionStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";
export type BarrierLevel = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH";
export type ComprehensionBarrier = "LOW" | "MEDIUM" | "HIGH";
export type MechanismStatus = "MECHANISM_OK" | "MECHANISM_WEAK" | "NO_MECHANISM_NEEDED" | "MECHANISM_BLOCKED";
export type SelfProjectionType =
  | "personal_experience" | "behavior_compare" | "similar_case" | "disagree_or_judge"
  | "shared_pattern" | "easy_answer" | "memory" | "community_identity"
  | "unspoken_connection" | "learn_without_projection";

export type MechanismCandidate = { mechanism_id: MechanismId; score: number; fit_reasons: string[]; risk_reasons: string[] };

export type MechanismSelectionResult = {
  self_projection_strength: SelfProjectionStrength;
  self_projection_types: SelfProjectionType[];
  participation_barrier: BarrierLevel;
  comprehension_barrier: ComprehensionBarrier;
  reader_entry_points: string[];
  story_invitation_strength: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  personal_memory_opening: boolean;
  opinion_opening: boolean;
  experience_opening: boolean;
  easy_reply_opening: boolean;
  mechanism_candidates: MechanismCandidate[];
  selected_mechanism: MechanismId;
  selection_reason: string;
  generalization_risk: "LOW" | "MEDIUM" | "HIGH";
  first_person_preference: boolean;
  question_required: boolean;
  completion_style: "open" | "closed" | "partial" | "none";
  mechanism_repetition_risk: "LOW" | "MEDIUM" | "HIGH";
  status: MechanismStatus;
  style_decision: null;
  thinking_rail_decision: null;
};

export type RecentMechanismUsage = { mechanism_id?: string; setup_hash?: string; punchline_direction?: string; ending_behavior?: string };
export type SelectMechanismInput = {
  interpretation: SeedInterpretation;
  editorial_mode?: string;
  recent_mechanism_usage?: RecentMechanismUsage[];
  creator_interest_signals?: string[];
  audience_context?: string[];
};

function hasText(s: unknown): boolean { return String(s || "").trim().length >= 4; }
function lower(s: unknown): string { return String(s || "").toLowerCase(); }

function assessReaderCapabilities(interp: SeedInterpretation) {
  const human = hasText(interp.concrete_human_element);
  const readerConn = hasText(interp.possible_reader_connection);
  const novelty = interp.novelty_signal || "NONE";
  const exp = interp.experience_boundaries;
  const subject = lower(interp.seed_subject + " " + interp.what_is_actually_happening);
  const why = lower(interp.why_it_might_matter_to_creator);
  const flags: Record<string, boolean> = {
    reader_can_recall_personal_experience: human || readerConn,
    reader_can_compare_own_behavior: /습관|행동|패턴|비교|선택/.test(subject + why) || readerConn,
    reader_can_add_similar_case: human || readerConn,
    reader_can_disagree_or_judge: /판단|의견|논쟁|맞는지|틀린|기준|규칙/.test(subject + why) || novelty === "HIGH",
    reader_can_recognize_shared_pattern: /패턴|반복|다들|사람들|공통/.test(subject + why) || human,
    reader_can_answer_easily: readerConn && !exp.must_not_claim_first_person,
    reader_can_share_memory: human,
    reader_can_identify_as_community_member: /차주|오너|팬|테슬라|fsd|운전|경기/.test(subject),
    reader_can_complete_unspoken_connection: readerConn && novelty !== "NONE",
    reader_can_learn_without_personal_projection: !human && !readerConn,
  };
  const types: SelfProjectionType[] = [];
  if (flags.reader_can_recall_personal_experience) types.push("personal_experience");
  if (flags.reader_can_compare_own_behavior) types.push("behavior_compare");
  if (flags.reader_can_add_similar_case) types.push("similar_case");
  if (flags.reader_can_disagree_or_judge) types.push("disagree_or_judge");
  if (flags.reader_can_recognize_shared_pattern) types.push("shared_pattern");
  if (flags.reader_can_answer_easily) types.push("easy_answer");
  if (flags.reader_can_share_memory) types.push("memory");
  if (flags.reader_can_identify_as_community_member) types.push("community_identity");
  if (flags.reader_can_complete_unspoken_connection) types.push("unspoken_connection");
  if (flags.reader_can_learn_without_personal_projection) types.push("learn_without_projection");
  const positive = types.filter((t) => t !== "learn_without_projection").length;
  let strength: SelfProjectionStrength = "NONE";
  if (positive >= 4) strength = "STRONG";
  else if (positive >= 2) strength = "MODERATE";
  else if (positive === 1) strength = "WEAK";
  return { flags, types, strength };
}

function assessParticipationBarrier(interp: SeedInterpretation, strength: SelfProjectionStrength, types: SelfProjectionType[]): BarrierLevel {
  let score = 0;
  if (interp.experience_boundaries.must_not_claim_first_person) score += 1;
  if ((interp.uncertainty || []).length >= 3) score += 1;
  if (interp.repetition_risk === "HIGH") score += 1;
  if (strength === "NONE") score += 2;
  if (strength === "WEAK") score += 1;
  if (types.includes("disagree_or_judge") && !types.includes("easy_answer")) score += 1;
  if (types.includes("easy_answer") || types.includes("memory")) score -= 1;
  if (types.includes("personal_experience")) score -= 1;
  if (score <= 0) return "VERY_LOW";
  if (score === 1) return "LOW";
  if (score === 2) return "MEDIUM";
  return "HIGH";
}

function assessComprehensionBarrier(interp: SeedInterpretation): ComprehensionBarrier {
  const text = lower(interp.seed_subject + " " + interp.what_is_actually_happening);
  const techHits = (text.match(/\b(e2e|inference|token|latency|api|chip|fab|대역폭|추론|파라미터)\b/gi) || []).length;
  if (techHits >= 3 && !hasText(interp.concrete_human_element)) return "HIGH";
  if (techHits >= 1 && !hasText(interp.possible_reader_connection)) return "MEDIUM";
  return "LOW";
}

function scoreMechanism(def: MechanismDefinition, interp: SeedInterpretation, strength: SelfProjectionStrength, types: SelfProjectionType[], flags: Record<string, boolean>, recent: RecentMechanismUsage[]): MechanismCandidate {
  const fit: string[] = []; const risk: string[] = []; let score = 0;
  if (def.mechanism_id === "M1_SURPRISE_DEBATE_CHANGE") {
    if (interp.novelty_signal === "HIGH" || interp.novelty_signal === "MEDIUM") { score += 3; fit.push("novelty_or_change_signal"); }
    if (types.includes("disagree_or_judge")) { score += 2; fit.push("judgment_opening"); }
    if (strength === "NONE") { score -= 2; risk.push("weak_self_projection_for_debate"); }
  }
  if (def.mechanism_id === "M2_EXPERIENCE_EMPATHY") {
    if (flags.reader_can_recall_personal_experience) { score += 3; fit.push("personal_experience_path"); }
    if (interp.experience_boundaries.evidence_supported) { score += 2; fit.push("experience_evidence"); }
    if (interp.experience_boundaries.must_not_claim_first_person) { score -= 4; risk.push("no_first_person_experience_allowed"); }
    if (interp.experience_boundaries.must_not_claim_first_person && !interp.experience_boundaries.evidence_supported) {
      score = Math.min(score, -2); risk.push("experience_boundary_blocks_m2");
    }
  }
  if (def.mechanism_id === "M3_EVIDENCE_JUDGMENT") {
    if (types.includes("disagree_or_judge")) { score += 3; fit.push("evaluative_axis"); }
    if ((interp.factual_boundaries || []).some((f) => f.status === "confirmed")) { score += 2; fit.push("confirmed_facts_available"); }
  }
  if (def.mechanism_id === "M4_LIFE_PATTERN_EXPOSURE") {
    if (types.includes("shared_pattern") || types.includes("behavior_compare")) { score += 3; fit.push("pattern_or_behavior_compare"); }
    if (flags.reader_can_add_similar_case) { score += 1; fit.push("similar_case_path"); }
  }
  if (def.mechanism_id === "M5_SHARED_TENSION_REVERSAL") {
    if (interp.novelty_signal === "HIGH" && hasText(interp.concrete_human_element)) { score += 3; fit.push("tension_with_human_detail"); }
    if (types.includes("memory") || types.includes("unspoken_connection")) { score += 2; fit.push("memory_or_completion_path"); }
  }
  if (def.mechanism_id === "M6_SELF_REFERENTIAL_OBVIOUSNESS") {
    if (types.includes("community_identity") && interp.novelty_signal !== "NONE") { score += 2; fit.push("role_community_with_novelty"); }
    else { score -= 1; risk.push("role_obviousness_not_clear"); }
  }
  if (def.mechanism_id === "M7_GROUP_BEHAVIOR_DISCOVERY") {
    if (types.includes("shared_pattern") && types.includes("similar_case")) { score += 3; fit.push("group_pattern_plus_case"); }
    risk.push("generalization_watch");
  }
  if (def.mechanism_id === "M8_SELF_DEPRECATING_DISCLOSURE") {
    if (types.includes("easy_answer") || types.includes("personal_experience")) { score += 2; fit.push("low_stakes_disclosure_path"); }
    if (interp.experience_boundaries.must_not_claim_first_person) { score -= 3; risk.push("cannot_fabricate_self_disclosure"); }
  }
  if (def.mechanism_id === "M9_EVERYDAY_BLANK_FILLING") {
    if (types.includes("easy_answer") && strength !== "NONE") { score += 3; fit.push("easy_blank_fill_path"); }
    if ((interp.uncertainty || []).length >= 1 && hasText(interp.concrete_human_element)) { score += 2; fit.push("small_uncertainty_with_human_scene"); }
  }
  const sameId = (recent || []).filter((r) => r.mechanism_id === def.mechanism_id).length;
  if (sameId >= 3) { score -= 1; risk.push("frequent_same_mechanism_id"); }
  if ((recent || []).some((r) => r.mechanism_id === def.mechanism_id && r.setup_hash && r.ending_behavior && r.punchline_direction)) {
    score -= 2; risk.push("similar_setup_punchline_ending");
  }
  return { mechanism_id: def.mechanism_id, score, fit_reasons: fit, risk_reasons: risk };
}

function assessRepetitionRisk(selected: MechanismId, recent: RecentMechanismUsage[]): "LOW" | "MEDIUM" | "HIGH" {
  const same = (recent || []).filter((r) => r.mechanism_id === selected);
  if (same.some((r) => r.setup_hash && r.punchline_direction && r.ending_behavior)) return "HIGH";
  if (same.length >= 3) return "MEDIUM";
  return "LOW";
}

export function selectReactionMechanism(input: SelectMechanismInput): MechanismSelectionResult {
  const interp = input.interpretation;
  const recent = input.recent_mechanism_usage || [];
  const { flags, types, strength } = assessReaderCapabilities(interp);
  const participation_barrier = assessParticipationBarrier(interp, strength, types);
  const comprehension_barrier = assessComprehensionBarrier(interp);
  const reader_entry_points: string[] = [];
  if (hasText(interp.concrete_human_element)) reader_entry_points.push("human_element:" + String(interp.concrete_human_element).slice(0, 80));
  if (hasText(interp.possible_reader_connection)) reader_entry_points.push("reader_connection:" + String(interp.possible_reader_connection).slice(0, 80));
  if (types.includes("disagree_or_judge")) reader_entry_points.push("judgment_axis");
  if (types.includes("shared_pattern")) reader_entry_points.push("pattern_recognition");
  if (types.includes("easy_answer")) reader_entry_points.push("low_cost_reply");
  const story_invitation_strength = strength === "STRONG" ? "HIGH" as const : strength === "MODERATE" ? "MEDIUM" as const : strength === "WEAK" ? "LOW" as const : "NONE" as const;
  const candidates = REACTION_MECHANISMS.map((def) => scoreMechanism(def, interp, strength, types, flags, recent)).sort((a, b) => b.score - a.score);
  const top = candidates[0];
  let selected: MechanismId = "NONE";
  let status: MechanismStatus = "NO_MECHANISM_NEEDED";
  let selection_reason = "no_natural_self_projection";
  if (strength === "NONE" || (top && top.score < 1)) {
    selected = "NONE"; status = "NO_MECHANISM_NEEDED";
    selection_reason = strength === "NONE" ? "self_projection_none_informative_ok" : "no_candidate_scored_positive";
  } else if (top.score >= 3) {
    selected = top.mechanism_id; status = "MECHANISM_OK"; selection_reason = top.fit_reasons.join(",") || "best_candidate";
  } else if (top.score >= 1) {
    selected = top.mechanism_id; status = "MECHANISM_WEAK"; selection_reason = top.fit_reasons.join(",") || "weak_but_usable";
  }
  if (interp.status === "INTERPRETATION_BLOCKED") {
    selected = "NONE"; status = "MECHANISM_BLOCKED"; selection_reason = "interpretation_blocked";
  }
  const def = getMechanismById(selected);
  let generalization_risk: "LOW" | "MEDIUM" | "HIGH" = def?.generalization_risk_default || "LOW";
  let first_person_preference = false;
  if (selected === "M7_GROUP_BEHAVIOR_DISCOVERY" && generalization_risk === "HIGH") {
    first_person_preference = true; generalization_risk = "MEDIUM";
    selection_reason += ";prefer_first_person_to_reduce_generalization";
  }
  if (selected === "M2_EXPERIENCE_EMPATHY") {
    first_person_preference = !!interp.experience_boundaries.evidence_supported && !interp.experience_boundaries.must_not_claim_first_person;
  }
  if (selected === "M8_SELF_DEPRECATING_DISCLOSURE") {
    first_person_preference = !interp.experience_boundaries.must_not_claim_first_person;
  }
  const question_required = false;
  return {
    self_projection_strength: strength, self_projection_types: types, participation_barrier, comprehension_barrier,
    reader_entry_points, story_invitation_strength,
    personal_memory_opening: types.includes("memory") || types.includes("personal_experience"),
    opinion_opening: types.includes("disagree_or_judge"),
    experience_opening: types.includes("personal_experience") || types.includes("similar_case"),
    easy_reply_opening: types.includes("easy_answer"),
    mechanism_candidates: candidates.slice(0, 5), selected_mechanism: selected, selection_reason,
    generalization_risk, first_person_preference, question_required,
    completion_style: def?.completion_style || "none",
    mechanism_repetition_risk: assessRepetitionRisk(selected, recent), status,
    style_decision: null, thinking_rail_decision: null,
  };
}

export function isMechanismPassable(r: MechanismSelectionResult): boolean {
  return r.status === "MECHANISM_OK" || r.status === "MECHANISM_WEAK" || r.status === "NO_MECHANISM_NEEDED";
}
export function isMechanismBlocked(r: MechanismSelectionResult): boolean {
  return r.status === "MECHANISM_BLOCKED";
}
