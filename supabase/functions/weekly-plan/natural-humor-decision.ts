/**
 * ORDER 6B — Natural Humor Intelligence
 *
 * Structured permission/compatibility decision only.
 * Answers: is there a naturally available humorous beat in this Seed/context,
 * and should the creator use it?
 * Does NOT answer: how can we make this post funny?
 *
 * No jokes, punchlines, ㅋㅋ, or finished prose are stored or generated.
 * No Topic/Mode/Mechanism/Rail → Humor maps.
 * No CASUAL → Humor. No EXPERIENCE → self-deprecation.
 * No humor quota. Humor must be earned from grounded context signals.
 */

export const ORDER6B_HUMOR_VERSION = "natural_humor_decision_v1_order6b";
export const ORDER6B_NO_HUMOR_QUOTA = true as const;
export const ORDER6B_NO_CASUAL_HUMOR_MAP = true as const;
export const ORDER6B_NO_EXPERIENCE_SELF_DEPRECATION_MAP = true as const;
export const ORDER6B_NO_MECHANISM_HUMOR_MAP = true as const;
export const ORDER6B_NO_RAIL_HUMOR_MAP = true as const;
export const ORDER6B_NO_TOPIC_HUMOR_MAP = true as const;
export const ORDER6B_NO_AUTO_KKK = true as const;
export const ORDER6B_NO_AUTO_PUNCHLINE = true as const;
export const ORDER6B_NO_FABRICATE_EXPERIENCE = true as const;
export const ORDER6B_NO_FABRICATE_FACTS = true as const;
export const ORDER6B_NO_FORCED_JOKE = true as const;
export const ORDER6B_RAW_TEXT_BLOCKED = true as const;

export type HumorStatus =
  | "HUMOR_UNSUPPORTED"
  | "HUMOR_COMPATIBLE"
  | "HUMOR_NATURAL_AVAILABLE"
  | "HUMOR_BLOCKED"
  | "HUMOR_NOT_EVALUATED";

export type HumorStrength = "none" | "light" | "moderate" | "strong";

export type HumorSourceType =
  | "none"
  | "irony"
  | "contradiction"
  | "anticlimax"
  | "obviousness"
  | "awkward_truth"
  | "shared_recognition"
  | "self_observed_imperfection"
  | "unexpected_reversal"
  | "repeated_behavior"
  | "absurd_detail"
  | "unknown";

export type HumorRisk = "low" | "medium" | "high";

export type NaturalHumorDecision = {
  humor_status: HumorStatus;
  humor_compatible: boolean;
  humor_strength: HumorStrength;
  humor_source_type: HumorSourceType;
  humor_grounded: boolean;
  self_deprecation_allowed: boolean;
  laughter_marker_allowed: boolean;
  punchline_compatible: boolean;
  punchline_required: boolean;
  stop_after_punchline_ok: boolean;
  explanation_after_punchline_allowed: boolean;
  humor_risk: HumorRisk;
  forced_humor_risk: HumorRisk;
  confidence: number;
  fit_signals: string[];
  block_reasons: string[];
  preserves_low_barrier: boolean;
  preserves_self_projection: boolean;
  recent_humor_repetition_risk: HumorRisk;
  order6b_humor_version: string;
};

export type HumorContextInput = {
  /** Soft structured signals only — never map keys */
  interpretation_status?: string | null;
  has_irony_signal?: boolean | null;
  has_contradiction_signal?: boolean | null;
  has_anticlimax_signal?: boolean | null;
  has_awkward_truth_signal?: boolean | null;
  has_shared_recognition_signal?: boolean | null;
  has_self_observed_imperfection?: boolean | null;
  has_unexpected_reversal?: boolean | null;
  has_repeated_behavior_signal?: boolean | null;
  has_absurd_detail_signal?: boolean | null;
  has_lived_experience_grounding?: boolean | null;
  has_factual_grounding?: boolean | null;
  editorial_mode?: string | null;
  mechanism_status?: string | null;
  mechanism_id?: string | null;
  rail_status?: string | null;
  everyday_language_status?: string | null;
  everyday_minimal_context_sufficient?: boolean | null;
  style_punchline_compatible?: boolean | null;
  style_dialogue_compatible?: boolean | null;
  style_conversational_level?: string | null;
  style_family?: string | null;
  prefer_short?: boolean | null;
  story_invitation_strength?: string | null;
  /** Soft recent usage — never forces rotation */
  recent_humor_counts?: Record<string, number> | null;
  recent_self_deprecation_count?: number | null;
  recent_punchline_count?: number | null;
  recent_laughter_marker_count?: number | null;
};

export type NaturalHumorInput = {
  context?: HumorContextInput | null;
};

function rejectRawHumorSurfaces(input: Record<string, unknown>): string[] {
  const blocks: string[] = [];
  const banned = [
    "raw_text",
    "manual_text",
    "audience_text",
    "comment_text",
    "sample_joke",
    "sample_punchline",
    "few_shot",
    "finished_post",
    "historical_post_text",
    "example_humor",
    "joke_text",
  ];
  for (const k of banned) {
    if (input[k] != null && String(input[k]).trim().length > 0) {
      blocks.push(`raw_humor_surface_rejected:${k}`);
    }
  }
  return blocks;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function detectNaturalSources(ctx: HumorContextInput): { types: HumorSourceType[]; score: number; reasons: string[] } {
  const types: HumorSourceType[] = [];
  const reasons: string[] = [];
  let score = 0;

  if (ctx.has_irony_signal) {
    types.push("irony");
    score += 0.22;
    reasons.push("grounded_irony");
  }
  if (ctx.has_contradiction_signal) {
    types.push("contradiction");
    score += 0.2;
    reasons.push("grounded_contradiction");
  }
  if (ctx.has_anticlimax_signal) {
    types.push("anticlimax");
    score += 0.18;
    reasons.push("grounded_anticlimax");
  }
  if (ctx.has_awkward_truth_signal) {
    types.push("awkward_truth");
    score += 0.2;
    reasons.push("grounded_awkward_truth");
  }
  if (ctx.has_shared_recognition_signal) {
    types.push("shared_recognition");
    score += 0.16;
    reasons.push("grounded_shared_recognition");
  }
  if (ctx.has_self_observed_imperfection) {
    types.push("self_observed_imperfection");
    score += 0.18;
    reasons.push("grounded_self_observed_imperfection");
  }
  if (ctx.has_unexpected_reversal) {
    types.push("unexpected_reversal");
    score += 0.2;
    reasons.push("grounded_unexpected_reversal");
  }
  if (ctx.has_repeated_behavior_signal) {
    types.push("repeated_behavior");
    score += 0.14;
    reasons.push("grounded_repeated_behavior");
  }
  if (ctx.has_absurd_detail_signal) {
    types.push("absurd_detail");
    score += 0.16;
    reasons.push("grounded_absurd_detail");
  }

  return { types, score: clamp01(score), reasons };
}

function blockedHumor(reasons: string[]): NaturalHumorDecision {
  return {
    humor_status: "HUMOR_BLOCKED",
    humor_compatible: false,
    humor_strength: "none",
    humor_source_type: "none",
    humor_grounded: false,
    self_deprecation_allowed: false,
    laughter_marker_allowed: false,
    punchline_compatible: false,
    punchline_required: false,
    stop_after_punchline_ok: false,
    explanation_after_punchline_allowed: true,
    humor_risk: "high",
    forced_humor_risk: "high",
    confidence: 0,
    fit_signals: [],
    block_reasons: reasons,
    preserves_low_barrier: true,
    preserves_self_projection: true,
    recent_humor_repetition_risk: "low",
    order6b_humor_version: ORDER6B_HUMOR_VERSION,
  };
}

/**
 * Runtime Natural Humor Decision (ORDER 6B).
 * Earned from grounded context signals only. No maps, no quota, no fabrication.
 */
export function decideNaturalHumor(input: NaturalHumorInput = {}): NaturalHumorDecision {
  const rawBlocks = rejectRawHumorSurfaces(input as Record<string, unknown>);
  if (rawBlocks.length) return blockedHumor(rawBlocks);

  const ctx: HumorContextInput = input.context || {};
  const { types, score: sourceScore, reasons } = detectNaturalSources(ctx);

  // Explicit non-maps: editorial mode / mechanism / rail never force humor
  void ctx.editorial_mode;
  void ctx.mechanism_status;
  void ctx.mechanism_id;
  void ctx.rail_status;

  // CASUAL must not imply humor
  const mode = String(ctx.editorial_mode || "").toUpperCase();
  if (mode === "CASUAL" && types.length === 0) {
    reasons.push("casual_does_not_imply_humor");
  }

  // EXPERIENCE does not imply self-deprecation
  let selfDepAllowed = false;
  if (ctx.has_self_observed_imperfection === true && ctx.has_lived_experience_grounding === true) {
    selfDepAllowed = true;
    reasons.push("self_deprecation_earned_from_grounded_imperfection");
  } else if (mode === "EXPERIENCE") {
    reasons.push("experience_does_not_imply_self_deprecation");
  }

  // Soft repetition
  const humorUses = Object.values(ctx.recent_humor_counts || {}).reduce((a, b) => a + (b || 0), 0);
  let recentRisk: HumorRisk = "low";
  if (humorUses >= 4 || (ctx.recent_punchline_count || 0) >= 3) recentRisk = "high";
  else if (humorUses >= 2 || (ctx.recent_punchline_count || 0) >= 2) recentRisk = "medium";

  const selfDepOver = (ctx.recent_self_deprecation_count || 0) >= 2;
  if (selfDepOver) {
    selfDepAllowed = false;
    reasons.push("self_deprecation_recent_overuse_soft_block");
  }

  const grounded = types.length > 0 && sourceScore >= 0.14;
  // Without grounded source → unsupported (not forced)
  if (!grounded) {
    return {
      humor_status: "HUMOR_UNSUPPORTED",
      humor_compatible: false,
      humor_strength: "none",
      humor_source_type: "none",
      humor_grounded: false,
      self_deprecation_allowed: false,
      laughter_marker_allowed: false,
      punchline_compatible: false,
      punchline_required: false,
      stop_after_punchline_ok: false,
      explanation_after_punchline_allowed: true,
      humor_risk: "low",
      forced_humor_risk: "low",
      confidence: clamp01(0.55 + (mode === "CASUAL" ? 0.05 : 0)),
      fit_signals: [...reasons, "no_grounded_humor_source"],
      block_reasons: [],
      preserves_low_barrier: true,
      preserves_self_projection: true,
      recent_humor_repetition_risk: recentRisk,
      order6b_humor_version: ORDER6B_HUMOR_VERSION,
    };
  }

  // Soft style alignment (never map)
  let fit = sourceScore;
  if (ctx.style_punchline_compatible === true) fit += 0.08;
  if (ctx.style_dialogue_compatible === true) fit += 0.04;
  if (String(ctx.style_conversational_level || "") === "high") fit += 0.05;
  if (ctx.prefer_short === true) fit += 0.04; // compressed humor ok
  if (recentRisk === "high") fit -= 0.12;
  else if (recentRisk === "medium") fit -= 0.05;

  // Barrier: obscure humor not preferred when minimal context
  let preservesBarrier = true;
  if (ctx.everyday_minimal_context_sufficient && types.includes("shared_recognition") === false && sourceScore < 0.3) {
    reasons.push("minimal_context_prefers_light_humor");
  }

  fit = clamp01(fit);

  let strength: HumorStrength = "light";
  if (fit >= 0.55) strength = "moderate";
  if (fit >= 0.75 && types.length >= 2) strength = "strong";
  if (fit < 0.25) strength = "none";

  const compatible = fit >= 0.22 && grounded;
  const natural = fit >= 0.4 && grounded;

  // Punchline optional — never required
  const punchlineCompatible =
    compatible &&
    (ctx.style_punchline_compatible !== false) &&
    (types.includes("anticlimax") ||
      types.includes("unexpected_reversal") ||
      types.includes("irony") ||
      types.includes("absurd_detail"));
  const punchlineRequired = false;
  const stopAfterOk = punchlineCompatible && (ctx.prefer_short === true || strength !== "none");
  // Do not auto-require explanation after punchline
  const explainAfter = !stopAfterOk;

  // Laughter marker (ㅋㅋ) permission only — never auto-insert
  let laughterOk = false;
  if (
    compatible &&
    strength !== "none" &&
    (ctx.recent_laughter_marker_count || 0) < 3 &&
    (String(ctx.style_conversational_level || "") === "high" || ctx.style_dialogue_compatible === true)
  ) {
    laughterOk = true;
    reasons.push("laughter_marker_permission_only");
  }

  // Forced humor risk stays low when grounded and no quota path
  const forcedRisk: HumorRisk = grounded ? "low" : "high";

  let status: HumorStatus = "HUMOR_COMPATIBLE";
  if (natural) status = "HUMOR_NATURAL_AVAILABLE";
  if (!compatible) status = "HUMOR_UNSUPPORTED";

  // Fact/experience boundary: cannot claim fabrication path
  if (ctx.has_factual_grounding === false && types.includes("absurd_detail")) {
    reasons.push("absurd_detail_must_not_invent_facts");
  }

  return {
    humor_status: status,
    humor_compatible: compatible,
    humor_strength: strength,
    humor_source_type: types[0] || "none",
    humor_grounded: grounded,
    self_deprecation_allowed: selfDepAllowed && compatible,
    laughter_marker_allowed: laughterOk,
    punchline_compatible: !!punchlineCompatible && compatible,
    punchline_required: punchlineRequired,
    stop_after_punchline_ok: !!stopAfterOk && compatible,
    explanation_after_punchline_allowed: explainAfter,
    humor_risk: recentRisk === "high" ? "medium" : "low",
    forced_humor_risk: forcedRisk,
    confidence: clamp01(fit),
    fit_signals: reasons,
    block_reasons: [],
    preserves_low_barrier: preservesBarrier,
    preserves_self_projection: true,
    recent_humor_repetition_risk: recentRisk,
    order6b_humor_version: ORDER6B_HUMOR_VERSION,
  };
}

export const ORDER6B_HUMOR_GUARDS = {
  version: ORDER6B_HUMOR_VERSION,
  no_humor_quota: ORDER6B_NO_HUMOR_QUOTA,
  no_casual_humor_map: ORDER6B_NO_CASUAL_HUMOR_MAP,
  no_experience_self_deprecation_map: ORDER6B_NO_EXPERIENCE_SELF_DEPRECATION_MAP,
  no_mechanism_humor_map: ORDER6B_NO_MECHANISM_HUMOR_MAP,
  no_rail_humor_map: ORDER6B_NO_RAIL_HUMOR_MAP,
  no_topic_humor_map: ORDER6B_NO_TOPIC_HUMOR_MAP,
  no_auto_kkk: ORDER6B_NO_AUTO_KKK,
  no_auto_punchline: ORDER6B_NO_AUTO_PUNCHLINE,
  no_fabricate_experience: ORDER6B_NO_FABRICATE_EXPERIENCE,
  no_fabricate_facts: ORDER6B_NO_FABRICATE_FACTS,
  no_forced_joke: ORDER6B_NO_FORCED_JOKE,
  raw_text_blocked: ORDER6B_RAW_TEXT_BLOCKED,
} as const;
