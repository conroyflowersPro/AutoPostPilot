/**
 * ORDER 5A Foundation + ORDER 5B Pipeline Integration — Everyday Language Runtime
 *
 * Core: Keep the depth of the thought. Lower the barrier of entry.
 * This is NOT a style layer. style_decision remains null.
 * No humor engine. No final hooks. No fixed vocabulary tables.
 * No topic → entry strategy mapping. No raw manual / audience text.
 *
 * Pipeline position (ORDER 5B operational):
 * Seed → Interpretation → Reader Self-Projection → Reaction Mechanism
 * → Thinking Rail → Everyday Language Decision → (downstream)
 *
 * ORDER 0B / 1 / 2 / 3 / 4 protections preserved.
 */

import type { SeedInterpretation } from "./seed-interpretation.ts";

export const ORDER5A_VERSION = "everyday_language_reasoning_v1_order5a";
export const ORDER5B_VERSION = "everyday_language_pipeline_v1_order5b";
export const ORDER5B_PIPELINE_INTEGRATED = true as const;
export const ORDER5A_STYLE_ALWAYS_NULL = true as const;
export const ORDER5A_NO_TOPIC_ENTRY_MAP = true as const;
export const ORDER5A_NO_FIXED_VOCAB_TABLE = true as const;
export const ORDER5A_NO_HUMOR_ENGINE = true as const;
export const ORDER5A_RAW_MANUAL_TEXT_BLOCKED = true as const;
export const ORDER5A_RAW_AUDIENCE_TEXT_BLOCKED = true as const;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type BarrierLevel = "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";

export type LanguageStatus =
  | "LANGUAGE_OK"
  | "TRANSLATION_NEEDED"
  | "LOW_BARRIER_READY"
  | "PRECISION_CONFLICT"
  | "INSUFFICIENT_CONTEXT"
  | "NO_TRANSLATION_NEEDED"
  | "BLOCKED";

export type ReaderEntryStrategy =
  | "DIRECT_CONCRETE"
  | "HUMAN_RELEVANCE_BRIDGE"
  | "FAMILIAR_ANCHOR_THEN_DEPTH"
  | "MINIMAL_CONTEXT_FIRST"
  | "PRESERVE_AS_IS"
  | "NONE";

export type BroadConcreteAnchorType =
  | "EVERYDAY_OBJECT"
  | "COMMON_SITUATION"
  | "FELT_SCALE"
  | "TIME_HABIT"
  | "NONE";

export type CompressionPreference = "high" | "medium" | "low";

/**
 * Structured communication decision only.
 * Never stores finished sentences, hooks, punchlines, or style choices.
 */
export type EverydayLanguageDecision = {
  status: LanguageStatus;
  comprehension_barrier: BarrierLevel;
  participation_barrier: BarrierLevel;
  jargon_risk: BarrierLevel;
  abstraction_risk: BarrierLevel;
  niche_context_risk: BarrierLevel;
  everyday_translation_needed: boolean;
  reader_entry_strategy: ReaderEntryStrategy;
  broad_concrete_anchor_needed: boolean;
  broad_concrete_anchor_type: BroadConcreteAnchorType;
  terminology_simplification_needed: boolean;
  context_explanation_needed: boolean;
  human_relevance_bridge: boolean;
  attention_reengagement_needed: boolean;
  self_projection_preservation: boolean;
  compression_preference: CompressionPreference;
  /** Meaning that must not be diluted */
  protected_meaning: string[];
  /** Simplifications that would distort accuracy — blocked */
  forbidden_simplifications: string[];
  confidence: number;
  minimal_context_sufficient: boolean;
  /** Hard rule: never selects surface style */
  style_decision: null;
  /** Humor is out of scope for 5A */
  humor_engine_active: false;
  /** Relevance gate for any attention strategy */
  attention_relevance_ok: boolean;
  sensationalism_blocked: boolean;
  precision_conflict: boolean;
  fit_signals: string[];
  block_reasons: string[];
  order5a_version: string;
  order5b_version: string;
};

export type AudienceBarrierSignals = {
  participation_barrier_tendency?: BarrierLevel | null;
  comprehension_barrier_tendency?: BarrierLevel | null;
  strong_self_projection_rate?: number | null;
  story_invitation_strength?: string | null;
};

export type CreatorCommunicationPreference = {
  prefers_broad_concrete_when_accurate?: boolean;
  avoids_unnecessary_jargon?: boolean;
  allows_attention_reentry?: boolean;
};

export type EverydayLanguageInput = {
  interpretation: SeedInterpretation;
  /** Structured only — never raw comments */
  audience_signals?: AudienceBarrierSignals | null;
  /** Abstract strategy only — never raw post text */
  creator_comm_pref?: CreatorCommunicationPreference | null;
  editorial_mode?: string | null;
  /** From Thinking Rail — compression / preserve hints only */
  thinking_rail?: {
    compression_preference?: CompressionPreference;
    preserve_reader_entry?: boolean;
    status?: string;
  } | null;
  /** From Reaction Mechanism — soft signal only */
  mechanism?: {
    story_invitation_strength?: string;
    status?: string;
  } | null;
  planner_constraints?: {
    prefer_short?: boolean;
  };
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function hasText(s: unknown): boolean {
  return String(s || "").trim().length >= 3;
}

function maxBarrier(a: BarrierLevel, b: BarrierLevel): BarrierLevel {
  const rank: Record<BarrierLevel, number> = { LOW: 1, MODERATE: 2, HIGH: 3, UNKNOWN: 0 };
  return rank[a] >= rank[b] ? a : b;
}

/** Detect technical / niche density from interpretation signals only — no topic table */
function assessJargonRisk(interp: SeedInterpretation): BarrierLevel {
  const facts = interp.factual_boundaries || [];
  const confirmed = facts.filter((f) => f.status === "confirmed");
  const techish = confirmed.filter((f) =>
    /api|sdk|latency|throughput|firmware|ota|fsd|hw\d|v\d+\.\d|파라미터|스펙|벤치|프로토콜|엔드포인트/i.test(
      f.item || "",
    ),
  ).length;
  const abstractHeavy =
    hasText(interp.possible_macro_implication) &&
    !hasText(interp.concrete_human_element) &&
    !hasText(interp.possible_reader_connection);

  if (techish >= 3 || (techish >= 2 && abstractHeavy)) return "HIGH";
  if (techish >= 1 || abstractHeavy) return "MODERATE";
  return "LOW";
}

function assessAbstractionRisk(interp: SeedInterpretation): BarrierLevel {
  const hasHuman =
    hasText(interp.concrete_human_element) || hasText(interp.possible_reader_connection);
  const hasMacro = hasText(interp.possible_macro_implication);
  const novelty = interp.novelty_signal || "NONE";

  if (hasMacro && !hasHuman && (novelty === "HIGH" || novelty === "MEDIUM")) return "HIGH";
  if (hasMacro && !hasHuman) return "MODERATE";
  if (!hasHuman && novelty === "NONE") return "MODERATE";
  return "LOW";
}

function assessNicheContextRisk(interp: SeedInterpretation): BarrierLevel {
  const exp = interp.experience_boundaries;
  if (exp && exp.must_not_claim_first_person && !exp.evidence_supported) {
    // niche ownership claims blocked — still may need context for outsiders
    return "MODERATE";
  }
  const facts = (interp.factual_boundaries || []).filter((f) => f.status === "confirmed");
  if (facts.length >= 4 && !hasText(interp.possible_reader_connection)) return "HIGH";
  if (facts.length >= 2 && !hasText(interp.concrete_human_element)) return "MODERATE";
  return "LOW";
}

/**
 * Comprehension barrier from CURRENT seed interpretation — not topic label.
 * Technical topic can be LOW if human consequence is simple.
 */
function assessComprehensionBarrier(
  interp: SeedInterpretation,
  jargon: BarrierLevel,
  abstraction: BarrierLevel,
  niche: BarrierLevel,
  audience?: AudienceBarrierSignals | null,
): BarrierLevel {
  let level: BarrierLevel = "LOW";
  level = maxBarrier(level, jargon);
  level = maxBarrier(level, abstraction);
  level = maxBarrier(level, niche);

  // Soft audience signal only (structured)
  if (audience?.comprehension_barrier_tendency === "HIGH") {
    level = maxBarrier(level, "MODERATE");
  }

  // Human anchor already present → can lower friction
  if (
    hasText(interp.concrete_human_element) &&
    hasText(interp.possible_reader_connection) &&
    jargon !== "HIGH"
  ) {
    if (level === "HIGH") level = "MODERATE";
    else if (level === "MODERATE") level = "LOW";
  }

  if (interp.status === "INTERPRETATION_WEAK" || interp.status === "INTERPRETATION_BLOCKED") {
    return level === "LOW" ? "UNKNOWN" : level;
  }
  return level;
}

/**
 * Participation barrier: does the reader need specialist credentials / ownership
 * to respond meaningfully?
 */
function assessParticipationBarrier(
  interp: SeedInterpretation,
  audience?: AudienceBarrierSignals | null,
  mechanism?: EverydayLanguageInput["mechanism"],
): BarrierLevel {
  const exp = interp.experience_boundaries;
  const requiresLived =
    !!(exp && exp.creator_experienced && !exp.must_not_claim_first_person);
  const hasOpenInvite =
    hasText(interp.possible_reader_connection) ||
    (mechanism &&
      (mechanism.story_invitation_strength === "HIGH" ||
        mechanism.story_invitation_strength === "MEDIUM"));

  if (requiresLived && !hasOpenInvite) return "HIGH";
  if (requiresLived && hasOpenInvite) return "MODERATE";

  if (audience?.participation_barrier_tendency === "HIGH") return "MODERATE";
  if (audience?.participation_barrier_tendency === "VERY_LOW" || audience?.participation_barrier_tendency === "LOW") {
    return "LOW";
  }

  if (hasOpenInvite) return "LOW";
  if (hasText(interp.concrete_human_element)) return "LOW";
  return "MODERATE";
}

/**
 * Broad vs narrow: prefer broader accurate expression when precision is not lost.
 * No word A → word B dictionary.
 */
function evaluateBroadPreference(interp: SeedInterpretation): {
  prefer_broad: boolean;
  anchor_needed: boolean;
  anchor_type: BroadConcreteAnchorType;
  reasons: string[];
} {
  const reasons: string[] = [];
  const hasHuman = hasText(interp.concrete_human_element);
  const hasReader = hasText(interp.possible_reader_connection);
  const hasMacro = hasText(interp.possible_macro_implication);
  const facts = (interp.factual_boundaries || []).filter((f) => f.status === "confirmed");

  // If human element already concrete → less need for extra anchor
  if (hasHuman && hasReader) {
    reasons.push("human_element_already_concrete");
    return { prefer_broad: true, anchor_needed: false, anchor_type: "NONE", reasons };
  }

  // Abstract / macro without human bridge → broad concrete anchor helps entry
  if (hasMacro && !hasHuman) {
    reasons.push("macro_without_human_bridge");
    return {
      prefer_broad: true,
      anchor_needed: true,
      anchor_type: "COMMON_SITUATION",
      reasons,
    };
  }

  // Many confirmed technical facts, no reader connection
  if (facts.length >= 2 && !hasReader) {
    reasons.push("technical_facts_without_reader_bridge");
    return {
      prefer_broad: true,
      anchor_needed: true,
      anchor_type: "FELT_SCALE",
      reasons,
    };
  }

  if (!hasHuman && !hasReader) {
    reasons.push("no_immediate_human_entry");
    return {
      prefer_broad: true,
      anchor_needed: true,
      anchor_type: "EVERYDAY_OBJECT",
      reasons,
    };
  }

  reasons.push("entry_already_accessible");
  return { prefer_broad: true, anchor_needed: false, anchor_type: "NONE", reasons };
}

/**
 * Precision conflict: broader language would change meaning → block.
 */
function evaluatePrecisionConflict(interp: SeedInterpretation): {
  conflict: boolean;
  protected: string[];
  forbidden: string[];
} {
  const protected: string[] = [];
  const forbidden: string[] = [];

  for (const f of interp.factual_boundaries || []) {
    if (f.status === "confirmed" && hasText(f.item)) {
      protected.push(f.item.trim().slice(0, 120));
      // Do not allow stripping numeric / product precision when present
      if (/[0-9]|v\d|hw\d|fsd|스펙|버전|가격|거리|시간|비율/i.test(f.item)) {
        forbidden.push(`strip_precision:${f.item.trim().slice(0, 60)}`);
      }
    }
  }

  if (interp.experience_boundaries?.must_not_claim_first_person) {
    forbidden.push("claim_unverified_first_person");
    protected.push("experience_boundary_no_first_person");
  }

  // If interpretation marks something as essential novelty, protect it
  if (hasText(interp.what_is_new_or_interesting)) {
    protected.push(String(interp.what_is_new_or_interesting).trim().slice(0, 120));
  }

  const conflict = forbidden.length > 0 && protected.length > 0;
  return { conflict, protected, forbidden };
}

/**
 * Attention / re-engagement strategy foundation.
 * Must be relevant to Seed. Never sensationalism.
 */
function evaluateAttentionStrategy(
  interp: SeedInterpretation,
  broad: ReturnType<typeof evaluateBroadPreference>,
  creatorPref?: CreatorCommunicationPreference | null,
): {
  needed: boolean;
  relevance_ok: boolean;
  sensationalism_blocked: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const hasHuman =
    hasText(interp.concrete_human_element) || hasText(interp.possible_reader_connection);

  // Relevance: only when seed already has concrete human or scale signal
  const relevance_ok =
    hasHuman ||
    broad.anchor_needed ||
    hasText(interp.what_is_new_or_interesting);

  if (!relevance_ok) {
    reasons.push("no_relevant_attention_anchor_in_seed");
    return {
      needed: false,
      relevance_ok: false,
      sensationalism_blocked: true,
      reasons,
    };
  }

  // Creator abstract preference may allow re-entry, never forces sensationalism
  const allow = creatorPref?.allows_attention_reentry !== false;
  const needed =
    allow &&
    broad.anchor_needed &&
    (assessJargonRisk(interp) !== "LOW" || assessAbstractionRisk(interp) !== "LOW");

  if (needed) reasons.push("relevant_concrete_reentry_helps_access");
  else reasons.push("attention_reentry_not_required");

  return {
    needed,
    relevance_ok: true,
    sensationalism_blocked: true, // always block exaggeration / fear / urgency fabrication
    reasons,
  };
}

function pickEntryStrategy(
  status: LanguageStatus,
  comprehension: BarrierLevel,
  broad: ReturnType<typeof evaluateBroadPreference>,
  attention: ReturnType<typeof evaluateAttentionStrategy>,
  preserve: boolean,
): ReaderEntryStrategy {
  if (status === "PRECISION_CONFLICT" || status === "BLOCKED") return "PRESERVE_AS_IS";
  if (status === "NO_TRANSLATION_NEEDED" || comprehension === "LOW") {
    return preserve ? "DIRECT_CONCRETE" : "PRESERVE_AS_IS";
  }
  if (broad.anchor_needed && attention.needed) return "FAMILIAR_ANCHOR_THEN_DEPTH";
  if (broad.anchor_needed) return "HUMAN_RELEVANCE_BRIDGE";
  if (comprehension === "HIGH" || comprehension === "MODERATE") return "MINIMAL_CONTEXT_FIRST";
  return "DIRECT_CONCRETE";
}

/* -------------------------------------------------------------------------- */
/* Main decision                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Runtime Everyday Language decision.
 * Reasoning-driven. No topic maps. No fixed viral word lists.
 * style_decision always null. humor_engine always false.
 */
export function decideEverydayLanguage(input: EverydayLanguageInput): EverydayLanguageDecision {
  const interp = input.interpretation;
  const audience = input.audience_signals || null;
  const creatorPref = input.creator_comm_pref || null;
  const mechanism = input.mechanism || null;
  const rail = input.thinking_rail || null;

  if (interp.status === "INTERPRETATION_BLOCKED") {
    return {
      status: "BLOCKED",
      comprehension_barrier: "UNKNOWN",
      participation_barrier: "UNKNOWN",
      jargon_risk: "UNKNOWN",
      abstraction_risk: "UNKNOWN",
      niche_context_risk: "UNKNOWN",
      everyday_translation_needed: false,
      reader_entry_strategy: "NONE",
      broad_concrete_anchor_needed: false,
      broad_concrete_anchor_type: "NONE",
      terminology_simplification_needed: false,
      context_explanation_needed: false,
      human_relevance_bridge: false,
      attention_reengagement_needed: false,
      self_projection_preservation: false,
      compression_preference: "high",
      protected_meaning: [],
      forbidden_simplifications: ["interpretation_blocked"],
      confidence: 0,
      minimal_context_sufficient: false,
      style_decision: null,
      humor_engine_active: false,
      attention_relevance_ok: false,
      sensationalism_blocked: true,
      precision_conflict: false,
      fit_signals: [],
      block_reasons: ["interpretation_blocked"],
      order5a_version: ORDER5A_VERSION,
      order5b_version: ORDER5B_VERSION,
    };
  }

  const jargon = assessJargonRisk(interp);
  const abstraction = assessAbstractionRisk(interp);
  const niche = assessNicheContextRisk(interp);
  const comprehension = assessComprehensionBarrier(interp, jargon, abstraction, niche, audience);
  const participation = assessParticipationBarrier(interp, audience, mechanism);
  const broad = evaluateBroadPreference(interp);
  const precision = evaluatePrecisionConflict(interp);
  const attention = evaluateAttentionStrategy(interp, broad, creatorPref);

  const preserve =
    hasText(interp.possible_reader_connection) ||
    !!(rail && rail.preserve_reader_entry) ||
    !!(mechanism &&
      (mechanism.story_invitation_strength === "HIGH" ||
        mechanism.story_invitation_strength === "MEDIUM"));

  // Status resolution
  let status: LanguageStatus = "LANGUAGE_OK";
  const fit: string[] = [...broad.reasons, ...attention.reasons];
  const blocks: string[] = [];

  if (precision.conflict && precision.forbidden.some((f) => f.startsWith("strip_precision"))) {
    // Precision must win over forced simplification
    status = "PRECISION_CONFLICT";
    blocks.push("precision_would_be_lost");
    fit.push("accuracy_blocks_over_simplification");
  } else if (comprehension === "LOW" && jargon === "LOW" && !broad.anchor_needed) {
    status = "NO_TRANSLATION_NEEDED";
    fit.push("entry_already_low_barrier");
  } else if (comprehension === "HIGH" || jargon === "HIGH" || abstraction === "HIGH") {
    status = "TRANSLATION_NEEDED";
    fit.push("high_barrier_needs_everyday_bridge");
  } else if (broad.anchor_needed || comprehension === "MODERATE") {
    status = "LOW_BARRIER_READY";
    fit.push("moderate_barrier_with_broad_option");
  } else {
    status = "LANGUAGE_OK";
  }

  // Creator abstract preference: prefer broad when accurate
  if (creatorPref?.prefers_broad_concrete_when_accurate && !precision.conflict) {
    fit.push("creator_pref_broad_when_accurate");
  }

  const translationNeeded =
    status === "TRANSLATION_NEEDED" ||
    status === "LOW_BARRIER_READY" ||
    (status === "LANGUAGE_OK" && broad.anchor_needed);

  const terminologyNeeded =
    jargon === "HIGH" || jargon === "MODERATE" || (status === "TRANSLATION_NEEDED" && !precision.conflict);

  const contextNeeded =
    niche === "HIGH" ||
    niche === "MODERATE" ||
    (abstraction === "HIGH" && !hasText(interp.concrete_human_element));

  const entry = pickEntryStrategy(status, comprehension, broad, attention, preserve);

  let compression: CompressionPreference = "medium";
  if (input.planner_constraints?.prefer_short) compression = "high";
  if (rail?.compression_preference === "high") compression = "high";
  if (status === "NO_TRANSLATION_NEEDED") compression = "high";

  const confidence = Math.max(
    0.25,
    Math.min(
      0.92,
      0.5 +
        (comprehension === "LOW" ? 0.15 : 0) +
        (precision.conflict ? -0.1 : 0.1) +
        (hasText(interp.concrete_human_element) ? 0.1 : 0) -
        (interp.status === "INTERPRETATION_WEAK" ? 0.15 : 0),
    ),
  );

  return {
    status,
    comprehension_barrier: comprehension,
    participation_barrier: participation,
    jargon_risk: jargon,
    abstraction_risk: abstraction,
    niche_context_risk: niche,
    everyday_translation_needed: translationNeeded && status !== "PRECISION_CONFLICT",
    reader_entry_strategy: entry,
    broad_concrete_anchor_needed: broad.anchor_needed && status !== "PRECISION_CONFLICT",
    broad_concrete_anchor_type:
      status === "PRECISION_CONFLICT" ? "NONE" : broad.anchor_type,
    terminology_simplification_needed: terminologyNeeded && status !== "PRECISION_CONFLICT",
    context_explanation_needed: contextNeeded && status !== "PRECISION_CONFLICT",
    human_relevance_bridge:
      (broad.anchor_needed || preserve) && status !== "PRECISION_CONFLICT",
    attention_reengagement_needed: attention.needed && attention.relevance_ok,
    self_projection_preservation: preserve,
    compression_preference: compression,
    protected_meaning: precision.protected,
    forbidden_simplifications: precision.forbidden,
    confidence,
    minimal_context_sufficient:
      comprehension === "LOW" || status === "NO_TRANSLATION_NEEDED",
    style_decision: null,
    humor_engine_active: false,
    attention_relevance_ok: attention.relevance_ok,
    sensationalism_blocked: true,
    precision_conflict: status === "PRECISION_CONFLICT",
    fit_signals: fit,
    block_reasons: blocks,
    order5a_version: ORDER5A_VERSION,
    order5b_version: ORDER5B_VERSION,
  };
}

export function isEverydayLanguagePassable(d: EverydayLanguageDecision): boolean {
  return d.status !== "BLOCKED";
}

export function isPrecisionBlocked(d: EverydayLanguageDecision): boolean {
  return d.status === "PRECISION_CONFLICT" || d.precision_conflict;
}

/** Structural guards for tests / diagnostics */
export const ORDER5A_GUARDS = {
  style_always_null: ORDER5A_STYLE_ALWAYS_NULL,
  no_topic_entry_map: ORDER5A_NO_TOPIC_ENTRY_MAP,
  no_fixed_vocab_table: ORDER5A_NO_FIXED_VOCAB_TABLE,
  no_humor_engine: ORDER5A_NO_HUMOR_ENGINE,
  raw_manual_blocked: ORDER5A_RAW_MANUAL_TEXT_BLOCKED,
  raw_audience_blocked: ORDER5A_RAW_AUDIENCE_TEXT_BLOCKED,
  version: ORDER5A_VERSION,
} as const;
