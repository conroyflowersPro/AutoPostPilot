/**
 * ORDER 6A/6B/6C — Contextual Creator Style Decision (hardened)
 *
 * Decides surface writing *tendencies* for this specific post while preserving
 * one coherent creator identity. Style ≠ template, ≠ wording, ≠ humor engine.
 *
 * Pipeline position (conceptual):
 *   … → Thinking Rail → Everyday Language → Creator Style Decision → Natural Humor → downstream
 *
 * Forbidden deterministic shortcuts:
 *   Topic → Style | Editorial Mode → Style | Mechanism → Style | Rail → Style | Everyday status → Style
 *
 * Primary evidence: structured Creator / Writing DNA tendencies only.
 * ORDER 6B: multi-signal contextual scoring without any direct map.
 * ORDER 6C: profile coherence > diversity; no persona rotation; no style templates;
 * authenticity over diversity; no AI/report voice surface guidance.
 * Raw manual posts, historical full text, audience comments, few-shot examples: BLOCKED.
 *
 * Humor surface generation is NOT in this module (see natural-humor-decision.ts).
 */

export const ORDER6A_VERSION = "creator_style_decision_v1_order6a";
export const ORDER6B_STYLE_VERSION = "creator_style_decision_v1_order6b_contextual";
export const ORDER6C_STYLE_VERSION = "creator_style_decision_v1_order6c_hardened";
export const ORDER6C_PROFILE_COHERENCE = true as const;
export const ORDER6C_NO_PERSONA_ROTATION = true as const;
export const ORDER6C_NO_STYLE_TEMPLATE = true as const;
export const ORDER6C_NO_FORCED_ROTATION = true as const;
export const ORDER6C_AUTHENTICITY_OVER_DIVERSITY = true as const;
export const ORDER6C_NO_AI_REPORT_VOICE = true as const;
export const ORDER6C_SURFACE_ONLY_FAMILIES = true as const;
export const ORDER6A_STYLE_LAYER = true as const;
export const ORDER6A_NO_TOPIC_STYLE_MAP = true as const;
export const ORDER6A_NO_EDITORIAL_STYLE_MAP = true as const;
export const ORDER6A_NO_MECHANISM_STYLE_MAP = true as const;
export const ORDER6A_NO_RAIL_STYLE_MAP = true as const;
export const ORDER6A_NO_EVERYDAY_STATUS_STYLE_MAP = true as const;
export const ORDER6A_RAW_MANUAL_TEXT_BLOCKED = true as const;
export const ORDER6A_RAW_AUDIENCE_TEXT_BLOCKED = true as const;
export const ORDER6A_NO_FINISHED_EXAMPLES = true as const;
export const ORDER6A_NO_HUMOR_GENERATION = true as const;
export const ORDER6A_NO_AUTO_KKK = true as const;
export const ORDER6A_NO_AUTO_SELF_DEPRECATION = true as const;
export const ORDER6A_CREATOR_COHERENCE_FIRST = true as const;

export type StyleStatus =
  | "STYLE_READY"
  | "STYLE_LOW_CONFIDENCE"
  | "STYLE_MINIMAL"
  | "STYLE_NEUTRAL"
  | "STYLE_BLOCKED";

export type StyleFamily =
  | "COMPRESSED_CONVERSATIONAL"
  | "REFLECTIVE_CONVERSATIONAL"
  | "TECHNICAL_PRACTICAL"
  | "CASUAL_OBSERVATION"
  | "COMMUNITY_NATIVE_COMPRESSED"
  | "SELECTIVE_LONGFORM_REFLECTION"
  | "NEUTRAL_CREATOR_DEFAULT";

export type StyleId =
  | "compressed_conversational"
  | "reflective_conversational"
  | "technical_practical"
  | "casual_observation"
  | "community_native_compressed"
  | "selective_longform_reflection"
  | "neutral_creator_default";

export type HumorDecisionPlaceholder =
  | "HUMOR_NOT_EVALUATED"
  | "HUMOR_COMPATIBLE"
  | "HUMOR_UNSUPPORTED"
  | "UNKNOWN";

export type DensityLevel = "low" | "medium" | "high";
export type Level3 = "low" | "medium" | "high";

export type CreatorStyleDecision = {
  status: StyleStatus;
  selected_style_id: StyleId;
  style_family: StyleFamily;
  confidence: number;
  creator_fit: number;
  context_fit: number;
  compression_level: Level3;
  conversational_level: Level3;
  reflection_level: Level3;
  technical_density: DensityLevel;
  paragraph_density: DensityLevel;
  directness: Level3;
  politeness_level: Level3;
  community_native_level: Level3;
  storytelling_level: Level3;
  dialogue_compatible: boolean;
  punchline_compatible: boolean;
  reader_inference_space: Level3;
  recent_style_repetition_risk: Level3;
  humor_decision: HumorDecisionPlaceholder;
  prohibited_surface_behaviors: string[];
  fit_signals: string[];
  block_reasons: string[];
  preserves_low_barrier: boolean;
  short_post_compatible: boolean;
  selective_longform: boolean;
  order6a_version: string;
};

export type CreatorWritingDnaSignals = {
  prefers_compression?: boolean | null;
  prefers_conversational?: boolean | null;
  prefers_reflective?: boolean | null;
  allows_technical_density?: boolean | null;
  community_native_ok?: boolean | null;
  longform_selective_ok?: boolean | null;
  politeness_default?: "polite" | "mixed" | "casual" | null;
  identity_stable?: boolean | null;
};

export type StyleContextInput = {
  creator_dna?: CreatorWritingDnaSignals | null;
  interpretation_status?: string | null;
  interpretation_confidence?: number | null;
  has_lived_reflection?: boolean | null;
  has_personal_history_signal?: boolean | null;
  has_relationship_context?: boolean | null;
  mechanism_status?: string | null;
  mechanism_id?: string | null;
  story_invitation_strength?: string | null;
  self_projection_strength?: string | null;
  reader_inference_preference?: "high" | "medium" | "low" | null;
  rail_status?: string | null;
  rail_compression_preference?: "high" | "medium" | "low" | null;
  rail_reasoning_shape?: string | null;
  everyday_language_status?: string | null;
  everyday_minimal_context_sufficient?: boolean | null;
  everyday_precision_conflict?: boolean | null;
  editorial_mode?: string | null;
  topic_cluster?: string | null;
  prefer_short?: boolean | null;
  has_factual_grounding?: boolean | null;
  has_experience_grounding?: boolean | null;
  recent_style_counts?: Record<string, number> | null;
};

export type CreatorStyleInput = {
  context?: StyleContextInput | null;
};

function rejectRawStyleSurfaces(input: Record<string, unknown>): string[] {
  const blocks: string[] = [];
  const banned = [
    "raw_text",
    "manual_text",
    "audience_text",
    "comment_text",
    "sample_style",
    "example_sentence",
    "few_shot",
    "finished_post",
    "historical_post_text",
    "creator_phrase",
    "sample_hook",
    "sample_punchline",
  ];
  for (const k of banned) {
    if (input[k] != null && String(input[k]).trim().length > 0) {
      blocks.push(`raw_style_surface_rejected:${k}`);
    }
  }
  return blocks;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function repetitionRisk(
  styleId: StyleId,
  counts: Record<string, number> | null | undefined,
): Level3 {
  const n = counts?.[styleId] ?? 0;
  if (n >= 4) return "high";
  if (n >= 2) return "medium";
  return "low";
}

type FamilyProfile = {
  id: StyleId;
  family: StyleFamily;
  compression_level: Level3;
  conversational_level: Level3;
  reflection_level: Level3;
  technical_density: DensityLevel;
  paragraph_density: DensityLevel;
  directness: Level3;
  politeness_level: Level3;
  community_native_level: Level3;
  storytelling_level: Level3;
  dialogue_compatible: boolean;
  punchline_compatible: boolean;
  reader_inference_space: Level3;
  short_post_compatible: boolean;
  selective_longform: boolean;
};

const FAMILY_PROFILES: FamilyProfile[] = [
  {
    id: "compressed_conversational",
    family: "COMPRESSED_CONVERSATIONAL",
    compression_level: "high",
    conversational_level: "high",
    reflection_level: "low",
    technical_density: "low",
    paragraph_density: "low",
    directness: "high",
    politeness_level: "medium",
    community_native_level: "medium",
    storytelling_level: "low",
    dialogue_compatible: true,
    punchline_compatible: true,
    reader_inference_space: "high",
    short_post_compatible: true,
    selective_longform: false,
  },
  {
    id: "reflective_conversational",
    family: "REFLECTIVE_CONVERSATIONAL",
    compression_level: "medium",
    conversational_level: "high",
    reflection_level: "high",
    technical_density: "low",
    paragraph_density: "medium",
    directness: "medium",
    politeness_level: "medium",
    community_native_level: "low",
    storytelling_level: "medium",
    dialogue_compatible: true,
    punchline_compatible: false,
    reader_inference_space: "high",
    short_post_compatible: true,
    selective_longform: false,
  },
  {
    id: "technical_practical",
    family: "TECHNICAL_PRACTICAL",
    compression_level: "medium",
    conversational_level: "medium",
    reflection_level: "low",
    technical_density: "high",
    paragraph_density: "medium",
    directness: "high",
    politeness_level: "medium",
    community_native_level: "low",
    storytelling_level: "low",
    dialogue_compatible: false,
    punchline_compatible: false,
    reader_inference_space: "medium",
    short_post_compatible: true,
    selective_longform: false,
  },
  {
    id: "casual_observation",
    family: "CASUAL_OBSERVATION",
    compression_level: "high",
    conversational_level: "high",
    reflection_level: "low",
    technical_density: "low",
    paragraph_density: "low",
    directness: "medium",
    politeness_level: "low",
    community_native_level: "medium",
    storytelling_level: "low",
    dialogue_compatible: true,
    punchline_compatible: true,
    reader_inference_space: "high",
    short_post_compatible: true,
    selective_longform: false,
  },
  {
    id: "community_native_compressed",
    family: "COMMUNITY_NATIVE_COMPRESSED",
    compression_level: "high",
    conversational_level: "high",
    reflection_level: "low",
    technical_density: "medium",
    paragraph_density: "low",
    directness: "high",
    politeness_level: "low",
    community_native_level: "high",
    storytelling_level: "low",
    dialogue_compatible: true,
    punchline_compatible: true,
    reader_inference_space: "high",
    short_post_compatible: true,
    selective_longform: false,
  },
  {
    id: "selective_longform_reflection",
    family: "SELECTIVE_LONGFORM_REFLECTION",
    compression_level: "low",
    conversational_level: "medium",
    reflection_level: "high",
    technical_density: "low",
    paragraph_density: "high",
    directness: "medium",
    politeness_level: "high",
    community_native_level: "low",
    storytelling_level: "high",
    dialogue_compatible: false,
    punchline_compatible: false,
    reader_inference_space: "medium",
    short_post_compatible: false,
    selective_longform: true,
  },
  {
    id: "neutral_creator_default",
    family: "NEUTRAL_CREATOR_DEFAULT",
    compression_level: "medium",
    conversational_level: "medium",
    reflection_level: "medium",
    technical_density: "low",
    paragraph_density: "medium",
    directness: "medium",
    politeness_level: "medium",
    community_native_level: "low",
    storytelling_level: "low",
    dialogue_compatible: true,
    punchline_compatible: false,
    reader_inference_space: "high",
    short_post_compatible: true,
    selective_longform: false,
  },
];

function scoreFamily(
  profile: FamilyProfile,
  ctx: StyleContextInput,
  dna: CreatorWritingDnaSignals,
): { score: number; reasons: string[] } {
  let score = 0.35;
  const reasons: string[] = ["creator_identity_base"];

  if (dna.prefers_compression === true && profile.compression_level === "high") {
    score += 0.12;
    reasons.push("dna_prefers_compression");
  }
  if (dna.prefers_conversational === true && profile.conversational_level === "high") {
    score += 0.1;
    reasons.push("dna_prefers_conversational");
  }
  if (dna.prefers_reflective === true && profile.reflection_level === "high") {
    score += 0.1;
    reasons.push("dna_prefers_reflective");
  }
  if (dna.allows_technical_density === true && profile.technical_density === "high") {
    score += 0.08;
    reasons.push("dna_allows_technical");
  }
  if (dna.community_native_ok === true && profile.community_native_level === "high") {
    score += 0.08;
    reasons.push("dna_community_native_ok");
  }
  if (dna.longform_selective_ok === true && profile.selective_longform) {
    score += 0.05;
    reasons.push("dna_longform_selective_ok");
  }
  if (dna.politeness_default === "polite" && profile.politeness_level === "high") {
    score += 0.05;
    reasons.push("dna_politeness_default");
  }

  if (ctx.prefer_short || ctx.everyday_minimal_context_sufficient) {
    if (profile.short_post_compatible) {
      score += 0.12;
      reasons.push("short_or_minimal_context_fit");
    } else {
      score -= 0.25;
      reasons.push("longform_penalized_when_short_preferred");
    }
  }

  const el = String(ctx.everyday_language_status || "");
  if (
    (el === "TRANSLATION_NEEDED" || el === "LOW_BARRIER_READY") &&
    profile.technical_density === "high"
  ) {
    score -= 0.18;
    reasons.push("everyday_barrier_penalizes_high_tech_surface");
  }
  if (ctx.everyday_precision_conflict && profile.technical_density === "low") {
    score += 0.02;
    reasons.push("precision_conflict_allows_measured_density");
  }

  if (profile.selective_longform) {
    const reflectiveContext =
      !!ctx.has_lived_reflection ||
      !!ctx.has_personal_history_signal ||
      String(ctx.story_invitation_strength || "").toUpperCase() === "HIGH";
    if (reflectiveContext && dna.longform_selective_ok !== false) {
      score += 0.15;
      reasons.push("selective_longform_context_supported");
    } else {
      score -= 0.3;
      reasons.push("selective_longform_not_supported_by_context");
    }
  }

  if (ctx.rail_compression_preference === "high" && profile.compression_level === "high") {
    score += 0.06;
    reasons.push("rail_compression_soft_align");
  }
  if (ctx.rail_compression_preference === "low" && profile.compression_level === "low") {
    score += 0.04;
    reasons.push("rail_expansion_soft_align");
  }

  if (
    profile.community_native_level === "high" &&
    dna.community_native_ok === true &&
    (ctx.prefer_short || ctx.everyday_minimal_context_sufficient)
  ) {
    score += 0.06;
    reasons.push("community_native_context_fit");
  }

  const risk = repetitionRisk(profile.id, ctx.recent_style_counts || null);
  if (risk === "high") {
    score -= 0.08;
    reasons.push("recent_repetition_soft_penalty_high");
  } else if (risk === "medium") {
    score -= 0.03;
    reasons.push("recent_repetition_soft_penalty_medium");
  }

  const dnaSparse =
    dna.prefers_compression == null &&
    dna.prefers_conversational == null &&
    dna.prefers_reflective == null &&
    dna.allows_technical_density == null;
  if (dnaSparse && profile.id === "neutral_creator_default") {
    score += 0.1;
    reasons.push("sparse_dna_prefers_neutral_identity");
  }

  const proj = String(ctx.self_projection_strength || "").toUpperCase();
  if (proj === "HIGH" && profile.reader_inference_space === "high") {
    score += 0.05;
    reasons.push("self_projection_soft_align");
  }
  if (ctx.reader_inference_preference === "high" && profile.reader_inference_space === "high") {
    score += 0.04;
    reasons.push("reader_inference_soft_align");
  }
  if (ctx.has_relationship_context && profile.reflection_level === "high") {
    score += 0.05;
    reasons.push("relationship_context_soft_reflective");
  }
  if (ctx.has_experience_grounding && profile.storytelling_level !== "low") {
    score += 0.04;
    reasons.push("experience_grounding_soft_story");
  }
  if (ctx.has_factual_grounding && profile.technical_density === "high") {
    score += 0.03;
    reasons.push("factual_grounding_soft_tech");
  }
  const ic = typeof ctx.interpretation_confidence === "number" ? ctx.interpretation_confidence : null;
  if (ic != null && ic >= 0.7 && profile.directness === "high") {
    score += 0.03;
    reasons.push("high_interp_confidence_soft_direct");
  }

  void ctx.topic_cluster;
  void ctx.editorial_mode;
  void ctx.mechanism_status;
  void ctx.mechanism_id;
  void ctx.rail_status;
  void ctx.rail_reasoning_shape;

  return { score: clamp01(score), reasons };
}

function blockedDecision(reasons: string[]): CreatorStyleDecision {
  return {
    status: "STYLE_BLOCKED",
    selected_style_id: "neutral_creator_default",
    style_family: "NEUTRAL_CREATOR_DEFAULT",
    confidence: 0,
    creator_fit: 0,
    context_fit: 0,
    compression_level: "medium",
    conversational_level: "medium",
    reflection_level: "medium",
    technical_density: "low",
    paragraph_density: "medium",
    directness: "medium",
    politeness_level: "medium",
    community_native_level: "low",
    storytelling_level: "low",
    dialogue_compatible: true,
    punchline_compatible: false,
    reader_inference_space: "high",
    recent_style_repetition_risk: "low",
    humor_decision: "HUMOR_NOT_EVALUATED",
    prohibited_surface_behaviors: [
      "no_auto_humor",
      "no_auto_kkk",
      "no_auto_self_deprecation",
      "no_finished_examples",
      ...reasons,
    ],
    fit_signals: [],
    block_reasons: reasons,
    preserves_low_barrier: true,
    short_post_compatible: true,
    selective_longform: false,
    order6a_version: ORDER6A_VERSION,
  };
}

export function decideCreatorStyle(input: CreatorStyleInput = {}): CreatorStyleDecision {
  const rawBlocks = rejectRawStyleSurfaces(input as Record<string, unknown>);
  if (rawBlocks.length) return blockedDecision(rawBlocks);

  const ctx: StyleContextInput = input.context || {};
  const dna: CreatorWritingDnaSignals = ctx.creator_dna || {
    prefers_compression: true,
    prefers_conversational: true,
    prefers_reflective: null,
    allows_technical_density: true,
    community_native_ok: true,
    longform_selective_ok: true,
    politeness_default: "mixed",
    identity_stable: true,
  };

  let best = FAMILY_PROFILES[FAMILY_PROFILES.length - 1];
  let bestScore = -1;
  let bestReasons: string[] = [];
  for (const profile of FAMILY_PROFILES) {
    const { score, reasons } = scoreFamily(profile, ctx, dna);
    if (score > bestScore) {
      bestScore = score;
      best = profile;
      bestReasons = reasons;
    }
  }

  const risk = repetitionRisk(best.id, ctx.recent_style_counts || null);
  const creatorFit = clamp01(
    0.55 +
      (dna.identity_stable === false ? -0.2 : 0.15) +
      (dna.prefers_conversational != null ? 0.1 : 0),
  );
  const contextFit = clamp01(bestScore);

  let status: StyleStatus = "STYLE_READY";
  if (bestScore < 0.35) status = "STYLE_LOW_CONFIDENCE";
  if (bestScore < 0.25) status = "STYLE_MINIMAL";
  if (best.id === "neutral_creator_default" && bestScore < 0.45) status = "STYLE_NEUTRAL";

  let humor: HumorDecisionPlaceholder = "HUMOR_NOT_EVALUATED";
  if (best.punchline_compatible && best.conversational_level === "high") {
    humor = "HUMOR_COMPATIBLE";
  } else if (best.selective_longform || best.reflection_level === "high") {
    humor = "HUMOR_UNSUPPORTED";
  } else {
    humor = "UNKNOWN";
  }

  const prohibited = [
    "no_auto_humor",
    "no_auto_kkk",
    "no_auto_self_deprecation",
    "no_finished_examples",
    "no_topic_style_map",
    "no_editorial_style_map",
    "no_mechanism_style_map",
    "no_rail_style_map",
    "no_force_rotation",
    "no_persona_rotation",
    "no_style_template",
    "no_ai_report_voice",
    "no_academic_surface",
    "no_corporate_summary_voice",
    "authenticity_over_diversity",
  ];

  let preservesLowBarrier = true;
  const el = String(ctx.everyday_language_status || "");
  if (
    (el === "TRANSLATION_NEEDED" || el === "LOW_BARRIER_READY") &&
    best.technical_density === "high"
  ) {
    const safer =
      FAMILY_PROFILES.find((p) => p.id === "compressed_conversational") ||
      FAMILY_PROFILES.find((p) => p.id === "neutral_creator_default")!;
    best = safer;
    bestReasons = [...bestReasons, "reselected_to_preserve_low_barrier"];
    preservesLowBarrier = true;
  }

  return {
    status,
    selected_style_id: best.id,
    style_family: best.family,
    confidence: clamp01(bestScore),
    creator_fit: creatorFit,
    context_fit: contextFit,
    compression_level: best.compression_level,
    conversational_level: best.conversational_level,
    reflection_level: best.reflection_level,
    technical_density: best.technical_density,
    paragraph_density: best.paragraph_density,
    directness: best.directness,
    politeness_level: best.politeness_level,
    community_native_level: best.community_native_level,
    storytelling_level: best.storytelling_level,
    dialogue_compatible: best.dialogue_compatible,
    punchline_compatible: best.punchline_compatible,
    reader_inference_space: best.reader_inference_space,
    recent_style_repetition_risk: risk,
    humor_decision: humor,
    prohibited_surface_behaviors: prohibited,
    fit_signals: bestReasons,
    block_reasons: [],
    preserves_low_barrier: preservesLowBarrier,
    short_post_compatible: best.short_post_compatible,
    selective_longform: best.selective_longform,
    order6a_version: ORDER6A_VERSION,
  };
}

export function isStyleReady(d: CreatorStyleDecision): boolean {
  return d.status === "STYLE_READY" || d.status === "STYLE_NEUTRAL" || d.status === "STYLE_MINIMAL";
}

export const ORDER6A_GUARDS = {
  version: ORDER6A_VERSION,
  style_layer: ORDER6A_STYLE_LAYER,
  no_topic_style_map: ORDER6A_NO_TOPIC_STYLE_MAP,
  no_editorial_style_map: ORDER6A_NO_EDITORIAL_STYLE_MAP,
  no_mechanism_style_map: ORDER6A_NO_MECHANISM_STYLE_MAP,
  no_rail_style_map: ORDER6A_NO_RAIL_STYLE_MAP,
  no_everyday_status_style_map: ORDER6A_NO_EVERYDAY_STATUS_STYLE_MAP,
  raw_manual_blocked: ORDER6A_RAW_MANUAL_TEXT_BLOCKED,
  raw_audience_blocked: ORDER6A_RAW_AUDIENCE_TEXT_BLOCKED,
  no_finished_examples: ORDER6A_NO_FINISHED_EXAMPLES,
  no_humor_generation: ORDER6A_NO_HUMOR_GENERATION,
  no_auto_kkk: ORDER6A_NO_AUTO_KKK,
  no_auto_self_deprecation: ORDER6A_NO_AUTO_SELF_DEPRECATION,
  creator_coherence_first: ORDER6A_CREATOR_COHERENCE_FIRST,
  order6b_contextual: true,
  order6b_style_version: ORDER6B_STYLE_VERSION,
  order6c_hardened: true,
  order6c_style_version: ORDER6C_STYLE_VERSION,
  profile_coherence: ORDER6C_PROFILE_COHERENCE,
  no_persona_rotation: ORDER6C_NO_PERSONA_ROTATION,
  no_style_template: ORDER6C_NO_STYLE_TEMPLATE,
  no_forced_rotation: ORDER6C_NO_FORCED_ROTATION,
  authenticity_over_diversity: ORDER6C_AUTHENTICITY_OVER_DIVERSITY,
  no_ai_report_voice: ORDER6C_NO_AI_REPORT_VOICE,
  surface_only_families: ORDER6C_SURFACE_ONLY_FAMILIES,
} as const;
