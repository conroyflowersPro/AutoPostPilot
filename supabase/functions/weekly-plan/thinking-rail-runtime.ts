/**
 * ORDER 3 — Thinking Rail Runtime Integration
 * Pipeline position: Seed → Interpretation → Reader Self-Projection → Reaction Mechanism → Thinking Rail → generation
 *
 * Core: choose/derive creator-like reasoning flow for THIS seed after interpretation + mechanism.
 * NOT wording, tone, style, template, or topic→rail lookup.
 * Writing DNA and Style remain separate (style_decision stays null).
 * Reaction Mechanism remains independent — no fixed mechanism↔rail table.
 * ORDER 0B / 1 / 2 protections preserved.
 */
import type { SeedInterpretation } from "./seed-interpretation.ts";
import type { MechanismSelectionResult } from "./reader-self-projection.ts";

export type RailStatus =
  | "RAIL_OK"
  | "RAIL_ADAPTED"
  | "RAIL_DERIVED"
  | "RAIL_MINIMAL"
  | "RAIL_NONE"
  | "RAIL_BLOCKED";

export type ReasoningShape =
  | "observation_only"
  | "expect_vs_actual"
  | "number_to_meaning"
  | "presence_over_finish"
  | "habit_shift"
  | "open_judgment"
  | "scale_aware"
  | "compare_axes"
  | "lightweight_note";

export type EndingBehavior =
  | "stop_on_mechanism"
  | "soft_open"
  | "closed_observation"
  | "invite_reader"
  | "none";

export type CompressionPreference = "high" | "medium" | "low";

/** Abstract library only — structure labels, never finished sentences or post templates */
export type AbstractRail = {
  id: string;
  label: string;
  reasoning_shape: ReasoningShape;
  structure_beats: string[]; // abstract step labels only
  optional_beats: string[];
  typical_scale_shift: boolean;
  typical_long_horizon: boolean;
  typical_personal_judgment: boolean;
  experience_sensitive: boolean;
};

export const ABSTRACT_RAIL_LIBRARY: AbstractRail[] = [
  {
    id: "expect_vs_reality",
    label: "기대와 실제의 차이",
    reasoning_shape: "expect_vs_actual",
    structure_beats: ["common_expectation", "observed_actual", "difference_signal"],
    optional_beats: ["why_gap_matters"],
    typical_scale_shift: false,
    typical_long_horizon: false,
    typical_personal_judgment: true,
    experience_sensitive: true,
  },
  {
    id: "concrete_to_meaning",
    label: "구체에서 의미로",
    reasoning_shape: "number_to_meaning",
    structure_beats: ["concrete_anchor", "felt_scale", "implication"],
    optional_beats: ["comparison_point"],
    typical_scale_shift: true,
    typical_long_horizon: false,
    typical_personal_judgment: false,
    experience_sensitive: false,
  },
  {
    id: "presence_over_perfection",
    label: "완성도보다 존재감",
    reasoning_shape: "presence_over_finish",
    structure_beats: ["acknowledge_gap", "remaining_presence", "value_as_signal"],
    optional_beats: ["audience_split"],
    typical_scale_shift: false,
    typical_long_horizon: false,
    typical_personal_judgment: true,
    experience_sensitive: false,
  },
  {
    id: "daily_habit_shift",
    label: "일상 기본값 변화",
    reasoning_shape: "habit_shift",
    structure_beats: ["previous_default", "new_default_signal", "shift_moment"],
    optional_beats: ["friction_or_ease"],
    typical_scale_shift: false,
    typical_long_horizon: false,
    typical_personal_judgment: true,
    experience_sensitive: true,
  },
  {
    id: "open_judgment",
    label: "열린 판단",
    reasoning_shape: "open_judgment",
    structure_beats: ["observation", "both_sides", "leave_open"],
    optional_beats: ["reader_space"],
    typical_scale_shift: false,
    typical_long_horizon: false,
    typical_personal_judgment: true,
    experience_sensitive: false,
  },
  {
    id: "scale_shift_conditional",
    label: "조건부 스케일 이동",
    reasoning_shape: "scale_aware",
    structure_beats: ["local_observation", "conditional_wider_frame"],
    optional_beats: ["time_horizon_if_supported"],
    typical_scale_shift: true,
    typical_long_horizon: true,
    typical_personal_judgment: false,
    experience_sensitive: false,
  },
  {
    id: "lightweight_observation",
    label: "가벼운 관찰",
    reasoning_shape: "lightweight_note",
    structure_beats: ["single_observation"],
    optional_beats: [],
    typical_scale_shift: false,
    typical_long_horizon: false,
    typical_personal_judgment: false,
    experience_sensitive: false,
  },
  {
    id: "compare_axes",
    label: "축 비교",
    reasoning_shape: "compare_axes",
    structure_beats: ["axis_a", "axis_b", "tension"],
    optional_beats: ["which_matters_more"],
    typical_scale_shift: false,
    typical_long_horizon: false,
    typical_personal_judgment: true,
    experience_sensitive: false,
  },
];

export type ThinkingRailDecision = {
  status: RailStatus;
  selected_rail_id: string | null;
  derived: boolean;
  adapted: boolean;
  confidence: number; // 0–1
  reasoning_shape: ReasoningShape;
  required_reasoning_beats: string[];
  optional_reasoning_beats: string[];
  scale_shift_allowed: boolean;
  long_horizon_allowed: boolean;
  personal_judgment_allowed: boolean;
  experience_required: boolean;
  experience_grounded: boolean;
  evidence_required: boolean;
  ending_behavior: EndingBehavior;
  compression_preference: CompressionPreference;
  recent_repetition_risk: "LOW" | "MEDIUM" | "HIGH";
  preserve_reader_entry: boolean;
  humor_compatible: boolean;
  style_decision: null; // ORDER 3 hard rule
  fit_signals: string[];
  block_reasons: string[];
  selection_mode: "existing" | "adapted" | "derived" | "minimal" | "none" | "blocked";
};

export type RecentRailUsage = {
  rail_id?: string;
  reasoning_shape?: string;
  long_horizon_used?: boolean;
};

export type SelectThinkingRailInput = {
  interpretation: SeedInterpretation;
  mechanism?: MechanismSelectionResult | null;
  editorial_mode?: string;
  recent_rail_usage?: RecentRailUsage[];
  planner_constraints?: {
    prefer_short?: boolean;
    allow_macro?: boolean;
  };
};

function hasText(s: unknown): boolean {
  return String(s || "").trim().length >= 4;
}

function expGrounded(interp: SeedInterpretation): boolean {
  const e = interp.experience_boundaries;
  if (!e) return false;
  if (e.must_not_claim_first_person) return false;
  return !!(e.creator_experienced && e.evidence_supported);
}

function expBlocked(interp: SeedInterpretation): boolean {
  const e = interp.experience_boundaries;
  return !!(e && e.must_not_claim_first_person);
}

function assessLongHorizonAllowed(interp: SeedInterpretation, constraints?: SelectThinkingRailInput["planner_constraints"]): boolean {
  if (constraints && constraints.allow_macro === false) return false;
  const macro = interp.possible_macro_implication;
  if (!hasText(macro)) return false;
  // Only when interpretation already surfaces a natural macro signal — never auto-escalate
  const novelty = interp.novelty_signal || "NONE";
  if (novelty === "NONE" || novelty === "LOW") return false;
  return true;
}

function assessRepetition(railId: string | null, recent: RecentRailUsage[]): "LOW" | "MEDIUM" | "HIGH" {
  if (!railId) return "LOW";
  const same = (recent || []).filter((r) => r.rail_id === railId);
  if (same.length >= 3) return "HIGH";
  if (same.length >= 2) return "MEDIUM";
  return "LOW";
}

function scoreRail(
  rail: AbstractRail,
  interp: SeedInterpretation,
  mechanism: MechanismSelectionResult | null | undefined,
  longHorizon: boolean,
  grounded: boolean,
  recent: RecentRailUsage[],
): { score: number; reasons: string[]; risks: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const risks: string[] = [];

  // Experience sensitivity
  if (rail.experience_sensitive) {
    if (grounded) {
      score += 2;
      reasons.push("experience_grounded");
    } else if (expBlocked(interp)) {
      score -= 4;
      risks.push("experience_blocked");
    } else {
      score -= 1;
      risks.push("experience_ungrounded");
    }
  }

  // Human / reader connection → prefer rails that leave room
  if (hasText(interp.concrete_human_element) || hasText(interp.possible_reader_connection)) {
    if (rail.reasoning_shape === "open_judgment" || rail.reasoning_shape === "expect_vs_actual" || rail.reasoning_shape === "habit_shift") {
      score += 2;
      reasons.push("human_element_fit");
    }
    if (rail.reasoning_shape === "scale_aware" && !longHorizon) {
      score -= 1;
      risks.push("scale_may_overweight_human");
    }
  }

  // Novelty / tension
  const novelty = interp.novelty_signal || "NONE";
  if (novelty === "HIGH" || novelty === "MEDIUM") {
    if (rail.reasoning_shape === "expect_vs_actual" || rail.reasoning_shape === "compare_axes" || rail.reasoning_shape === "open_judgment") {
      score += 2;
      reasons.push("novelty_supports_tension");
    }
  } else {
    if (rail.reasoning_shape === "lightweight_note" || rail.reasoning_shape === "number_to_meaning") {
      score += 1;
      reasons.push("low_novelty_simple_fit");
    }
  }

  // Factual anchors / numbers
  const hasConcrete = (interp.factual_boundaries || []).some(
    (f) => f.status === "confirmed" && /[0-9]|수치|규모|가격|시간|거리|비율/.test(f.item),
  );
  if (hasConcrete && rail.reasoning_shape === "number_to_meaning") {
    score += 2;
    reasons.push("concrete_anchor_present");
  }

  // Mechanism independence: soft preference only, never fixed map
  if (mechanism) {
    if (mechanism.story_invitation_strength === "HIGH" || mechanism.story_invitation_strength === "MEDIUM") {
      if (rail.reasoning_shape === "open_judgment" || rail.reasoning_shape === "expect_vs_actual") {
        score += 1;
        reasons.push("preserves_story_invitation");
      }
    }
    if (mechanism.status === "NO_MECHANISM_NEEDED" && rail.reasoning_shape === "lightweight_note") {
      score += 1;
      reasons.push("mechanism_none_minimal_rail");
    }
    if (mechanism.first_person_preference && rail.experience_sensitive && grounded) {
      score += 1;
      reasons.push("mechanism_fp_with_grounding");
    }
  }

  // Long horizon gate
  if (rail.typical_long_horizon) {
    if (longHorizon) {
      score += 1;
      reasons.push("long_horizon_supported");
    } else {
      score -= 3;
      risks.push("long_horizon_not_allowed");
    }
  }

  // Soft anti-repetition (fit still wins)
  const rep = assessRepetition(rail.id, recent);
  if (rep === "HIGH") {
    score -= 1.5;
    risks.push("recent_overuse");
  } else if (rep === "MEDIUM") {
    score -= 0.5;
    risks.push("recent_use");
  }

  // Weak interpretation → prefer minimal
  if (interp.status === "INTERPRETATION_WEAK" && rail.reasoning_shape === "lightweight_note") {
    score += 1;
    reasons.push("weak_interp_minimal");
  }

  return { score, reasons, risks };
}

function deriveLightweight(interp: SeedInterpretation, longHorizon: boolean, grounded: boolean): ThinkingRailDecision {
  const preserve =
    hasText(interp.concrete_human_element) ||
    hasText(interp.possible_reader_connection);
  return {
    status: "RAIL_MINIMAL",
    selected_rail_id: "lightweight_observation",
    derived: true,
    adapted: false,
    confidence: 0.55,
    reasoning_shape: "lightweight_note",
    required_reasoning_beats: ["single_observation"],
    optional_reasoning_beats: [],
    scale_shift_allowed: false,
    long_horizon_allowed: false,
    personal_judgment_allowed: !expBlocked(interp),
    experience_required: false,
    experience_grounded: grounded,
    evidence_required: (interp.factual_boundaries || []).some((f) => f.status === "confirmed"),
    ending_behavior: preserve ? "invite_reader" : "stop_on_mechanism",
    compression_preference: "high",
    recent_repetition_risk: "LOW",
    preserve_reader_entry: preserve,
    humor_compatible: true,
    style_decision: null,
    fit_signals: ["derived_minimal_for_simple_seed"],
    block_reasons: [],
    selection_mode: "minimal",
  };
}

/**
 * Runtime Thinking Rail decision.
 * No topic→rail table. No keyword forcing. No raw manual text.
 * Supports existing / adapted / derived / minimal / none.
 */
export function selectThinkingRail(input: SelectThinkingRailInput): ThinkingRailDecision {
  const interp = input.interpretation;
  const mechanism = input.mechanism || null;
  const recent = input.recent_rail_usage || [];
  const constraints = input.planner_constraints;

  if (interp.status === "INTERPRETATION_BLOCKED") {
    return {
      status: "RAIL_BLOCKED",
      selected_rail_id: null,
      derived: false,
      adapted: false,
      confidence: 0,
      reasoning_shape: "observation_only",
      required_reasoning_beats: [],
      optional_reasoning_beats: [],
      scale_shift_allowed: false,
      long_horizon_allowed: false,
      personal_judgment_allowed: false,
      experience_required: false,
      experience_grounded: false,
      evidence_required: false,
      ending_behavior: "none",
      compression_preference: "high",
      recent_repetition_risk: "LOW",
      preserve_reader_entry: false,
      humor_compatible: false,
      style_decision: null,
      fit_signals: [],
      block_reasons: ["interpretation_blocked"],
      selection_mode: "blocked",
    };
  }

  const grounded = expGrounded(interp);
  const longHorizon = assessLongHorizonAllowed(interp, constraints);
  const preferShort = !!(constraints && constraints.prefer_short);

  // Score all abstract rails from interpretation signals only
  const scored = ABSTRACT_RAIL_LIBRARY.map((rail) => {
    const s = scoreRail(rail, interp, mechanism, longHorizon, grounded, recent);
    return { rail, ...s };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const preserve =
    hasText(interp.concrete_human_element) ||
    hasText(interp.possible_reader_connection) ||
    !!(mechanism && (mechanism.story_invitation_strength === "HIGH" || mechanism.story_invitation_strength === "MEDIUM"));

  // Simple / weak seed → minimal
  const isSimple =
    interp.status === "INTERPRETATION_WEAK" ||
    (!hasText(interp.what_is_new_or_interesting) && (interp.novelty_signal === "NONE" || !interp.novelty_signal)) ||
    preferShort;

  if (isSimple && (!top || top.score < 2)) {
    return deriveLightweight(interp, longHorizon, grounded);
  }

  if (!top || top.score < 0.5) {
    return {
      status: "RAIL_NONE",
      selected_rail_id: null,
      derived: false,
      adapted: false,
      confidence: 0.3,
      reasoning_shape: "observation_only",
      required_reasoning_beats: ["single_observation"],
      optional_reasoning_beats: [],
      scale_shift_allowed: false,
      long_horizon_allowed: false,
      personal_judgment_allowed: !expBlocked(interp),
      experience_required: false,
      experience_grounded: grounded,
      evidence_required: false,
      ending_behavior: "stop_on_mechanism",
      compression_preference: "high",
      recent_repetition_risk: "LOW",
      preserve_reader_entry: preserve,
      humor_compatible: true,
      style_decision: null,
      fit_signals: ["no_strong_rail_fit"],
      block_reasons: [],
      selection_mode: "none",
    };
  }

  const rail = top.rail;
  const rep = assessRepetition(rail.id, recent);

  // Experience-sensitive rail without grounding → adapt or block first-person path
  let adapted = false;
  let experience_required = rail.experience_sensitive;
  let personal_judgment_allowed = rail.typical_personal_judgment;
  let status: RailStatus = "RAIL_OK";
  let selection_mode: ThinkingRailDecision["selection_mode"] = "existing";
  let required = [...rail.structure_beats];
  let optional = [...rail.optional_beats];

  if (rail.experience_sensitive && !grounded) {
    // Adapt: strip lived-experience beats, keep observation shape
    adapted = true;
    status = "RAIL_ADAPTED";
    selection_mode = "adapted";
    experience_required = false;
    personal_judgment_allowed = false;
    required = required.filter((b) => !/personal|lived|first_person|직접/.test(b));
    if (required.length === 0) required = ["single_observation"];
    optional = optional.filter((b) => !/personal|lived/.test(b));
  }

  // Long horizon not allowed → strip horizon beats
  let scale_shift_allowed = rail.typical_scale_shift && (longHorizon || rail.reasoning_shape === "number_to_meaning");
  let long_horizon_allowed = rail.typical_long_horizon && longHorizon;
  if (!long_horizon_allowed) {
    optional = optional.filter((b) => !/horizon|future|macro|장기|미래/.test(b));
    if (rail.typical_long_horizon) {
      adapted = true;
      status = status === "RAIL_OK" ? "RAIL_ADAPTED" : status;
      selection_mode = selection_mode === "existing" ? "adapted" : selection_mode;
      scale_shift_allowed = false;
    }
  }

  // Prefer high compression when mechanism already landed or short preferred
  let compression: CompressionPreference = "medium";
  if (preferShort || (mechanism && mechanism.status === "MECHANISM_OK")) compression = "high";
  if (rail.reasoning_shape === "lightweight_note") compression = "high";

  // Ending: mechanism completion wins over rail fullness
  let ending: EndingBehavior = "stop_on_mechanism";
  if (preserve && mechanism && mechanism.story_invitation_strength !== "NONE") ending = "invite_reader";
  else if (rail.reasoning_shape === "open_judgment") ending = "soft_open";
  else if (rail.reasoning_shape === "lightweight_note") ending = "closed_observation";

  const confidence = Math.max(0.2, Math.min(0.95, 0.4 + top.score * 0.12 - (rep === "HIGH" ? 0.15 : rep === "MEDIUM" ? 0.05 : 0)));

  return {
    status,
    selected_rail_id: rail.id,
    derived: false,
    adapted,
    confidence,
    reasoning_shape: rail.reasoning_shape,
    required_reasoning_beats: required,
    optional_reasoning_beats: optional,
    scale_shift_allowed,
    long_horizon_allowed,
    personal_judgment_allowed,
    experience_required,
    experience_grounded: grounded,
    evidence_required: (interp.factual_boundaries || []).some((f) => f.status === "confirmed"),
    ending_behavior: ending,
    compression_preference: compression,
    recent_repetition_risk: rep,
    preserve_reader_entry: preserve,
    humor_compatible: true, // optional downstream only; never forced
    style_decision: null,
    fit_signals: top.reasons,
    block_reasons: top.risks,
    selection_mode,
  };
}

export function isRailPassable(d: ThinkingRailDecision): boolean {
  return d.status !== "RAIL_BLOCKED";
}

export function isRailBlocked(d: ThinkingRailDecision): boolean {
  return d.status === "RAIL_BLOCKED";
}

/** Structural guard: ensure no topic→rail lookup symbols exist in this module surface */
export const ORDER3_NO_TOPIC_RAIL_MAP = true;
export const ORDER3_STYLE_ALWAYS_NULL = true;
export const ORDER3_VERSION = "thinking_rail_runtime_v1_order3";
