/**
 * ORDER 7A — Deep Generation Architecture Foundation
 * Isolated per-post DeepGenerationContext. Consumes upstream decisions; does not re-decide.
 * Pipeline: … → Style → Humor → Core Thought → Deep Generation Context → downstream writer
 */
export const ORDER7A_VERSION = "deep_generation_context_v1_order7a";
export const ORDER7A_PER_POST_ISOLATION = true as const;
export const ORDER7A_BATCH_TRANSPORT_NOT_REASONING = true as const;
export const ORDER7A_NO_CROSS_POST_CONTAMINATION = true as const;
export const ORDER7A_NO_MANUAL_PROSE_IN_CONTEXT = true as const;
export const ORDER7A_NO_HISTORICAL_PROSE_IN_CONTEXT = true as const;
export const ORDER7A_NO_AUDIENCE_PROSE_IN_CONTEXT = true as const;
export const ORDER7A_NO_FINISHED_EXAMPLES = true as const;
export const ORDER7A_NO_GENERATION_TEMPLATE = true as const;
export const ORDER7A_NO_FORCED_CTA = true as const;
export const ORDER7A_NO_FORCED_QUESTION = true as const;
export const ORDER7A_NO_AI_REPORT_VOICE = true as const;
export const ORDER7A_NO_REASONING_TRACE_IN_OUTPUT = true as const;
export const ORDER7A_CORE_THOUGHT_NOT_PROSE = true as const;
export const ORDER7A_GENERATOR_CONSUMES_DECISIONS = true as const;
export const ORDER7A_SOURCE_VS_CORE_SEPARATION = true as const;

export type GenerationStatus =
  | "GENERATION_CONTEXT_READY"
  | "GENERATION_CONTEXT_MINIMAL"
  | "GENERATION_CONTEXT_BLOCKED"
  | "INSUFFICIENT_GROUNDING"
  | "CORE_THOUGHT_WEAK";

export type CompressionTarget =
  | "VERY_COMPRESSED"
  | "COMPRESSED"
  | "NATURAL"
  | "EXPANDED"
  | "SELECTIVE_LONGFORM";

export type CoreThoughtStatus =
  | "CORE_THOUGHT_READY"
  | "CORE_THOUGHT_WEAK"
  | "CORE_THOUGHT_BLOCKED"
  | "CORE_THOUGHT_INSUFFICIENT_SEED";

export type CoreThought = {
  status: CoreThoughtStatus;
  primary_claim: string;
  creator_judgment: string;
  tension: string;
  useful_implication: string;
  reader_relevant_meaning: string;
  confidence: number;
  evidence_dependency: "none" | "factual" | "experience" | "both";
  experience_dependency: boolean;
  source_meaning_separated: boolean;
  from_current_seed: boolean;
  block_reasons: string[];
  order7a_version: string;
};

export type DeepGenerationContext = {
  slot_id: string;
  context_id: string;
  seed_identity: { seed_id: string; concrete_subject: string; cluster: string; editorial_mode: string };
  interpreted_meaning: {
    status: string;
    seed_subject: string;
    what_is_actually_happening: string;
    why_it_matters_now: string;
    human_element: string;
  };
  why_it_matters: string;
  human_element: string;
  factual_boundaries: unknown[];
  experience_boundaries: Record<string, unknown>;
  reader_self_projection: Record<string, unknown>;
  reaction_mechanism: Record<string, unknown>;
  core_thought: CoreThought;
  thinking_rail: Record<string, unknown>;
  everyday_language: Record<string, unknown>;
  creator_style: Record<string, unknown>;
  humor_decision: {
    humor_compatible: boolean;
    humor_grounded: boolean;
    humor_strength: string;
    self_deprecation_allowed: boolean;
    laughter_marker_allowed: boolean;
    punchline_compatible: boolean;
    punchline_required: false;
    stop_after_punchline_ok: boolean;
    explanation_after_punchline_allowed: boolean;
    no_humor_is_normal: true;
  };
  compression_target: CompressionTarget;
  reader_inference_space: string;
  stop_condition: {
    mechanism_completed_ok: boolean;
    core_thought_delivered_ok: boolean;
    punchline_stop_ok: boolean;
    leave_inference_open: boolean;
    avoid_explanatory_tail: boolean;
    minimal_context_sufficient: boolean;
  };
  prohibited_claims: string[];
  prohibited_copy_sources: string[];
  recent_repetition_risk: string;
  generation_status: GenerationStatus;
  invariants: {
    question_required: false;
    cta_required: false;
    no_generation_template: true;
    no_ai_report_voice: true;
    no_reasoning_trace_in_output: true;
    per_post_isolation: true;
    generator_consumes_decisions: true;
  };
  batch_isolation: { isolated: true; shared_reasoning_forbidden: true };
  order7a_version: string;
};

export type BuildDeepGenerationInput = {
  slot_id?: string | null;
  day_offset?: number | null;
  slot_index?: number | null;
  seed?: Record<string, unknown> | null;
  interpretation?: Record<string, unknown> | null;
  reaction_mechanism?: Record<string, unknown> | null;
  thinking_rail?: Record<string, unknown> | null;
  everyday_language?: Record<string, unknown> | null;
  creator_style?: Record<string, unknown> | null;
  natural_humor?: Record<string, unknown> | null;
  editorial_mode?: string | null;
};

function s(v: unknown, d = ""): string {
  if (v == null || v === "") return d;
  return String(v);
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Core Thought: structured point of the post — NOT finished prose, NOT hook, NOT punchline.
 * Derived only from current Seed + Interpretation + boundaries.
 */
export function buildCoreThought(
  interp: Record<string, unknown> | null | undefined,
  seed: Record<string, unknown> | null | undefined,
  _mechanism: Record<string, unknown> | null | undefined,
): CoreThought {
  const subject = s((interp as any)?.seed_subject || (seed as any)?.concrete_subject);
  const tension = s((interp as any)?.what_is_actually_happening);
  const why = s((interp as any)?.why_it_matters_now);
  const human = s((interp as any)?.human_element);
  if (!subject) {
    return {
      status: "CORE_THOUGHT_INSUFFICIENT_SEED",
      primary_claim: "",
      creator_judgment: "",
      tension: "",
      useful_implication: "",
      reader_relevant_meaning: "",
      confidence: 0,
      evidence_dependency: "none",
      experience_dependency: false,
      source_meaning_separated: true,
      from_current_seed: false,
      block_reasons: ["no_seed_subject"],
      order7a_version: ORDER7A_VERSION,
    };
  }
  const expBound = ((interp as any)?.experience_boundaries as Record<string, unknown>) || {};
  const experienced = !!expBound.creator_experienced;
  const factBound = Array.isArray((interp as any)?.factual_boundaries)
    ? ((interp as any).factual_boundaries as unknown[])
    : [];
  const hasFacts = factBound.some((x: any) => x && x.status === "confirmed");
  let evidence_dependency: CoreThought["evidence_dependency"] = "none";
  if (hasFacts && experienced) evidence_dependency = "both";
  else if (hasFacts) evidence_dependency = "factual";
  else if (experienced) evidence_dependency = "experience";
  const interpStatus = s((interp as any)?.status);
  let status: CoreThoughtStatus = "CORE_THOUGHT_READY";
  let confidence = 0.7;
  if (interpStatus === "INTERPRETATION_BLOCKED") {
    status = "CORE_THOUGHT_BLOCKED";
    confidence = 0.1;
  } else if (interpStatus === "INTERPRETATION_WEAK" || !tension) {
    status = "CORE_THOUGHT_WEAK";
    confidence = 0.4;
  }
  return {
    status,
    primary_claim: (tension ? `tension_around:${tension.slice(0, 80)}` : `observe:${subject.slice(0, 80)}`).slice(0, 120),
    creator_judgment: why ? `judgment_axis:${why.slice(0, 100)}` : `judgment_axis:current_seed_relevance`,
    tension: tension.slice(0, 120),
    useful_implication: human ? `reader_bridge:${human.slice(0, 100)}` : `reader_bridge:open_inference`,
    reader_relevant_meaning: String(human || why || subject).slice(0, 120),
    confidence: clamp01(confidence),
    evidence_dependency,
    experience_dependency: experienced && !expBound.must_not_claim_first_person,
    source_meaning_separated: true,
    from_current_seed: true,
    block_reasons: [],
    order7a_version: ORDER7A_VERSION,
  };
}

function resolveCompressionTarget(
  style: Record<string, unknown>,
  rail: Record<string, unknown>,
  everyday: Record<string, unknown>,
  humor: Record<string, unknown>,
): CompressionTarget {
  if (style.selective_longform === true) return "SELECTIVE_LONGFORM";
  const preferShort =
    everyday.minimal_context_sufficient === true ||
    style.short_post_compatible === true ||
    s(style.compression_level) === "high";
  const railComp = s(rail.compression_preference || everyday.compression_preference);
  if (preferShort && (railComp === "high" || humor.stop_after_punchline_ok === true)) return "VERY_COMPRESSED";
  if (preferShort || railComp === "high") return "COMPRESSED";
  if (railComp === "low" || s(style.paragraph_density) === "expanded") return "EXPANDED";
  return "NATURAL";
}

function resolveInferenceSpace(
  mech: Record<string, unknown>,
  style: Record<string, unknown>,
  everyday: Record<string, unknown>,
): string {
  const strength = s(mech.self_projection_strength || mech.story_invitation_strength || style.reader_inference_space);
  if (strength === "high" || everyday.leave_inference_open === true) return "high";
  if (strength === "low") return "low";
  return "medium";
}

/**
 * Build isolated Deep Generation Context for ONE post.
 * Does not re-decide upstream layers. No raw manual/historical/audience prose.
 */
export function buildDeepGenerationContext(input: BuildDeepGenerationInput): DeepGenerationContext {
  const seed = (input.seed || {}) as Record<string, unknown>;
  const interp = (input.interpretation || {}) as Record<string, unknown>;
  const mech = (input.reaction_mechanism || {}) as Record<string, unknown>;
  const rail = (input.thinking_rail || {}) as Record<string, unknown>;
  const everyday = (input.everyday_language || {}) as Record<string, unknown>;
  const style = (input.creator_style || {}) as Record<string, unknown>;
  const humor = (input.natural_humor || {}) as Record<string, unknown>;
  const mode = s(input.editorial_mode || seed.editorial_mode || style.editorial_mode, "INFORMATIVE");
  const slot_id = s(input.slot_id, `D${Number(input.day_offset || 0) + 1}P${Number(input.slot_index || 0) + 1}`);
  const seed_id = s(seed.seed_id, "unknown_seed");
  const context_id = `dgctx-${slot_id}-${seed_id}`;

  const core = buildCoreThought(interp, seed, mech);
  const compression_target = resolveCompressionTarget(style, rail, everyday, humor);
  const inference = resolveInferenceSpace(mech, style, everyday);
  const punchlineStop = !!humor.stop_after_punchline_ok && !!humor.punchline_compatible;

  let generation_status: GenerationStatus = "GENERATION_CONTEXT_READY";
  if (core.status === "CORE_THOUGHT_BLOCKED" || core.status === "CORE_THOUGHT_INSUFFICIENT_SEED") {
    generation_status = "GENERATION_CONTEXT_BLOCKED";
  } else if (core.status === "CORE_THOUGHT_WEAK") {
    generation_status = "CORE_THOUGHT_WEAK";
  } else if (s(interp.status) === "INTERPRETATION_WEAK") {
    generation_status = "GENERATION_CONTEXT_MINIMAL";
  }

  const prohibited_claims: string[] = [];
  const expBound = (interp.experience_boundaries as Record<string, unknown>) || {};
  if (expBound.must_not_claim_first_person) prohibited_claims.push("unsupported_first_person_experience");
  if (Array.isArray(interp.do_not_invent)) {
    for (const x of interp.do_not_invent as unknown[]) prohibited_claims.push(s(x).slice(0, 80));
  }
  if (Array.isArray(seed.do_not_invent)) {
    for (const x of seed.do_not_invent as unknown[]) prohibited_claims.push(s(x).slice(0, 80));
  }

  const prohibited_copy_sources = [
    "manual_creator_posts",
    "historical_creator_posts",
    "audience_comments",
    "sample_generated_posts",
    "previous_batch_outputs",
    "finished_example_prose",
  ];

  return {
    slot_id,
    context_id,
    seed_identity: {
      seed_id,
      concrete_subject: s(seed.concrete_subject || interp.seed_subject),
      cluster: s(seed.cluster),
      editorial_mode: mode,
    },
    interpreted_meaning: {
      status: s(interp.status),
      seed_subject: s(interp.seed_subject || seed.concrete_subject),
      what_is_actually_happening: s(interp.what_is_actually_happening),
      why_it_matters_now: s(interp.why_it_matters_now),
      human_element: s(interp.human_element),
    },
    why_it_matters: s(interp.why_it_matters_now),
    human_element: s(interp.human_element),
    factual_boundaries: Array.isArray(interp.factual_boundaries)
      ? (interp.factual_boundaries as unknown[])
      : Array.isArray(seed.allowed_facts)
        ? (seed.allowed_facts as unknown[])
        : [],
    experience_boundaries: expBound,
    reader_self_projection: {
      self_projection_strength: s(mech.self_projection_strength),
      story_invitation_strength: s(mech.story_invitation_strength),
      question_required: false,
    },
    reaction_mechanism: {
      status: s(mech.status),
      selected_mechanism_id: s(mech.selected_mechanism_id || mech.mechanism_id),
      mechanism_family: s(mech.mechanism_family || (mech.selected_mechanism as any)?.family),
    },
    core_thought: core,
    thinking_rail: {
      status: s(rail.status),
      selected_rail_id: s(rail.selected_rail_id || rail.rail_id),
      compression_preference: s(rail.compression_preference),
      reasoning_shape: s(rail.reasoning_shape),
    },
    everyday_language: {
      status: s(everyday.status),
      minimal_context_sufficient: !!everyday.minimal_context_sufficient,
      compression_preference: s(everyday.compression_preference),
      reader_entry_strategy: s(everyday.reader_entry_strategy),
      human_relevance_bridge: s(everyday.human_relevance_bridge),
      precision_conflict: !!everyday.precision_conflict,
    },
    creator_style: {
      status: s(style.status),
      selected_style_id: s(style.selected_style_id || style.style_id),
      style_family: s(style.style_family),
      compression_level: s(style.compression_level),
      short_post_compatible: !!style.short_post_compatible,
      conversational_level: s(style.conversational_level),
      paragraph_density: s(style.paragraph_density),
    },
    humor_decision: {
      humor_compatible: !!humor.humor_compatible,
      humor_grounded: !!humor.humor_grounded,
      humor_strength: s(humor.humor_strength, "NONE"),
      self_deprecation_allowed: !!humor.self_deprecation_allowed,
      laughter_marker_allowed: !!humor.laughter_marker_allowed,
      punchline_compatible: !!humor.punchline_compatible,
      punchline_required: false,
      stop_after_punchline_ok: !!humor.stop_after_punchline_ok,
      explanation_after_punchline_allowed: humor.explanation_after_punchline_allowed !== false,
      no_humor_is_normal: true,
    },
    compression_target,
    reader_inference_space: inference,
    stop_condition: {
      mechanism_completed_ok: true,
      core_thought_delivered_ok: core.status === "CORE_THOUGHT_READY" || core.status === "CORE_THOUGHT_WEAK",
      punchline_stop_ok: punchlineStop,
      leave_inference_open: inference === "high" || inference === "medium",
      avoid_explanatory_tail: true,
      minimal_context_sufficient: !!everyday.minimal_context_sufficient,
    },
    prohibited_claims,
    prohibited_copy_sources,
    recent_repetition_risk: s(style.recent_style_repetition_risk || humor.recent_humor_repetition_risk, "low"),
    generation_status,
    invariants: {
      question_required: false,
      cta_required: false,
      no_generation_template: true,
      no_ai_report_voice: true,
      no_reasoning_trace_in_output: true,
      per_post_isolation: true,
      generator_consumes_decisions: true,
    },
    batch_isolation: { isolated: true, shared_reasoning_forbidden: true },
    order7a_version: ORDER7A_VERSION,
  };
}

export function isGenerationContextWritable(ctx: DeepGenerationContext): boolean {
  return (
    ctx.generation_status === "GENERATION_CONTEXT_READY" ||
    ctx.generation_status === "GENERATION_CONTEXT_MINIMAL" ||
    ctx.generation_status === "CORE_THOUGHT_WEAK"
  );
}

export const ORDER7A_GUARDS = {
  version: ORDER7A_VERSION,
  per_post_isolation: ORDER7A_PER_POST_ISOLATION,
  batch_transport_not_reasoning: ORDER7A_BATCH_TRANSPORT_NOT_REASONING,
  no_cross_post_contamination: ORDER7A_NO_CROSS_POST_CONTAMINATION,
  no_manual_prose: ORDER7A_NO_MANUAL_PROSE_IN_CONTEXT,
  no_historical_prose: ORDER7A_NO_HISTORICAL_PROSE_IN_CONTEXT,
  no_audience_prose: ORDER7A_NO_AUDIENCE_PROSE_IN_CONTEXT,
  no_finished_examples: ORDER7A_NO_FINISHED_EXAMPLES,
  no_generation_template: ORDER7A_NO_GENERATION_TEMPLATE,
  no_forced_cta: ORDER7A_NO_FORCED_CTA,
  no_forced_question: ORDER7A_NO_FORCED_QUESTION,
  no_ai_report_voice: ORDER7A_NO_AI_REPORT_VOICE,
  no_reasoning_trace: ORDER7A_NO_REASONING_TRACE_IN_OUTPUT,
  core_thought_not_prose: ORDER7A_CORE_THOUGHT_NOT_PROSE,
  generator_consumes_decisions: ORDER7A_GENERATOR_CONSUMES_DECISIONS,
  source_vs_core_separation: ORDER7A_SOURCE_VS_CORE_SEPARATION,
} as const;
