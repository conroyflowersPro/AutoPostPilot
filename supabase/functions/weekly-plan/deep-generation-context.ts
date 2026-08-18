/**
 * ORDER 7A — Deep Generation Architecture Foundation
 * Isolated per-post DeepGenerationContext.
 * Pipeline: Interpretation(boundaries) → Writer closes thought then writes → optional delivery telemetry.
 * Mechanism / Rail / Style do not pick the thought.
 */
import { getMechanismById, type MechanismId } from "./reaction-mechanisms.ts";

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
/** Marker: raw_prose_rejected — manual_text / manual_post_text never enter Core Thought */
export const ORDER7A_RAW_PROSE_REJECTED = true as const;
/** Marker: prefer_broad_simple structural strategy from ORDER 5 (no fixed vocab list) */
export const ORDER7A_PREFER_BROAD_SIMPLE = true as const;
/** Marker: sample_punchline never stored in context */
export const ORDER7A_NO_SAMPLE_PUNCHLINE = true as const;
/** Marker: first_person_lived_experience_without_evidence blocked */
export const ORDER7A_FIRST_PERSON_WITHOUT_EVIDENCE_BLOCKED = true as const;

export type GenerationStatus =
  | "GENERATION_CONTEXT_READY"
  | "GENERATION_CONTEXT_MINIMAL"
  | "GENERATION_CONTEXT_BLOCKED"
  | "INSUFFICIENT_GROUNDING"
  | "CORE_THOUGHT_WEAK"
  | "CORE_THOUGHT_HOLD";

export type CompressionTarget =
  | "VERY_COMPRESSED"
  | "COMPRESSED"
  | "NATURAL"
  | "EXPANDED"
  | "SELECTIVE_LONGFORM";

export type CoreThoughtStatus =
  | "CORE_THOUGHT_READY"
  | "CORE_THOUGHT_OPEN"
  | "CORE_THOUGHT_WEAK"
  | "CORE_THOUGHT_HOLD"
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
  fact_confidence: number;
  opinion_confidence: number;
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
  planner_intent: {
    strategy_slot_id: string;
    strategic_role: string;
    intent: string;
  };
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
  cite_episode_hint?: string;
  source_type?: string;
  source_kind?: string;
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
    sample_punchline: null;
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
  /** Abstract week signatures only — no prior post wording. */
  week_structural_signatures?: Array<Record<string, unknown>>;
  seed_packet?: Record<string, unknown>;
  post_thought?: {
    observation: string;
    creator_interpretation: string;
    core_thought: string;
    reader_entry: string;
    stop_point: string;
  };
  thinking_intelligence?: Record<string, unknown>;
  collection_block?: string;
  collection_hook?: Record<string, unknown>;
  experience_packet?: Record<string, unknown>;
  generation_status: GenerationStatus;
  voice_register?: {
    n: number;
    window_days: number;
    median_chars: number;
    question_ending_allowed: boolean;
    constraint_line: string;
  } | null;
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
  planner_intent?: {
    strategy_slot_id?: string | null;
    strategic_role?: string | null;
    intent?: string | null;
  } | null;
  voice_register?: {
    n: number;
    window_days: number;
    median_chars: number;
    question_ending_allowed: boolean;
    constraint_line: string;
  } | null;
  week_structural_signatures?: Array<Record<string, unknown>> | null;
  seed_packet?: Record<string, unknown> | null;
  post_thought?: {
    observation: string;
    creator_interpretation: string;
    core_thought: string;
    reader_entry: string;
    stop_point: string;
  } | null;
  thinking_intelligence?: Record<string, unknown> | null;
  collection_block?: string | null;
  collection_hook?: Record<string, unknown> | null;
  experience_packet?: Record<string, unknown> | null;
  agent_core_thought?: {
    core_thought?: string | null;
    from_current_seed?: boolean;
    boundary_ok?: boolean;
  } | null;
};

function s(v: unknown, d = ""): string {
  if (v == null || v === "") return d;
  return String(v);
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isAssembledThoughtLabel(v: unknown): boolean {
  return /^(judgment_axis|tension_around|reader_bridge)\s*:/i.test(String(v || "").trim());
}

/**
 * Seed/evidence gate only. Does NOT assemble Core Thought from interpretation fields.
 * Agent승 decides the thought after THINK. Labels like tension_around: are metadata, not the thought.
 */
export function buildCoreThought(
  interp: Record<string, unknown> | null | undefined,
  seed: Record<string, unknown> | null | undefined,
  _mechanism: Record<string, unknown> | null | undefined,
  agent?: { core_thought?: string | null; from_current_seed?: boolean; boundary_ok?: boolean } | null,
): CoreThought {
  const subject = s((interp as any)?.seed_subject || (seed as any)?.concrete_subject);
  const tension = s((interp as any)?.what_is_actually_happening);
  const why = s((interp as any)?.why_it_matters_now || (interp as any)?.why_it_might_matter_to_creator);
  const human = s(
    (interp as any)?.human_element ||
      (interp as any)?.concrete_human_element ||
      (interp as any)?.possible_reader_connection,
  );
  if (!subject) {
    return {
      status: "CORE_THOUGHT_INSUFFICIENT_SEED",
      primary_claim: "",
      creator_judgment: "",
      tension: "",
      useful_implication: "",
      reader_relevant_meaning: "",
      confidence: 0,
      fact_confidence: 0,
      opinion_confidence: 0,
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
  const block_reasons: string[] = [];
  const fact_confidence = hasFacts ? 0.7 : 0.2;
  const opinion_confidence = why ? 0.6 : 0.25;
  let status: CoreThoughtStatus = "CORE_THOUGHT_OPEN";
  let confidence = 0.5;
  if (interpStatus === "INTERPRETATION_BLOCKED") {
    status = "CORE_THOUGHT_BLOCKED";
    confidence = 0.1;
    block_reasons.push("interpretation_blocked");
  } else if (s((interp as any)?.not_worth_publishing) === "true" || s((interp as any)?.hold_reason) === "not_worth_publishing") {
    status = "CORE_THOUGHT_HOLD";
    confidence = 0.2;
    block_reasons.push("not_worth_publishing");
  }

  const agentText = s(agent?.core_thought).slice(0, 220);
  const usable = agentText.length >= 4 && !isAssembledThoughtLabel(agentText);
  if (usable && status !== "CORE_THOUGHT_BLOCKED") {
    return {
      status: "CORE_THOUGHT_READY",
      primary_claim: agentText.slice(0, 160),
      creator_judgment: agentText.slice(0, 160),
      tension: tension.slice(0, 160),
      useful_implication: "",
      reader_relevant_meaning: human.slice(0, 160),
      confidence: clamp01(0.75),
      fact_confidence: clamp01(fact_confidence),
      opinion_confidence: clamp01(opinion_confidence),
      evidence_dependency,
      experience_dependency: experienced && !expBound.must_not_claim_first_person,
      source_meaning_separated: true,
      from_current_seed: agent?.from_current_seed !== false,
      block_reasons: agent?.boundary_ok === false ? ["agent_boundary_flag"] : [],
      order7a_version: ORDER7A_VERSION,
    };
  }

  return {
    status,
    primary_claim: "",
    creator_judgment: "",
    tension: tension.slice(0, 160),
    useful_implication: "",
    reader_relevant_meaning: human.slice(0, 160),
    confidence: clamp01(confidence),
    fact_confidence: clamp01(fact_confidence),
    opinion_confidence: clamp01(opinion_confidence),
    evidence_dependency,
    experience_dependency: experienced && !expBound.must_not_claim_first_person,
    source_meaning_separated: true,
    from_current_seed: true,
    block_reasons,
    order7a_version: ORDER7A_VERSION,
  };
}

export function applyAgentSeungCoreThought(
  core: CoreThought,
  agent: { core_thought?: string | null; from_current_seed?: boolean; boundary_ok?: boolean } | null | undefined,
): CoreThought {
  const agentText = s(agent?.core_thought).slice(0, 220);
  if (core.status === "CORE_THOUGHT_BLOCKED" || core.status === "CORE_THOUGHT_INSUFFICIENT_SEED") {
    return core;
  }
  if (agentText.length < 4 || isAssembledThoughtLabel(agentText)) {
    return core;
  }
  const reasons = [...(core.block_reasons || [])];
  if (agent?.boundary_ok === false && !reasons.includes("agent_boundary_flag")) {
    reasons.push("agent_boundary_flag");
  }
  return {
    ...core,
    status: "CORE_THOUGHT_READY",
    primary_claim: agentText.slice(0, 160),
    creator_judgment: agentText.slice(0, 160),
    from_current_seed: agent?.from_current_seed !== false,
    confidence: clamp01(Math.max(core.confidence, 0.75)),
    block_reasons: reasons,
  };
}

function resolveCompressionTarget(
  style: Record<string, unknown>,
  rail: Record<string, unknown>,
  everyday: Record<string, unknown>,
  humor: Record<string, unknown>,
  editorialMode?: string,
): CompressionTarget {
  if (style.selective_longform === true) return "SELECTIVE_LONGFORM";
  const mode = s(editorialMode).toUpperCase();
  if (mode && mode !== "CASUAL_OBSERVATION") {
    const railComp = s(rail.compression_preference || everyday.compression_preference);
    if (railComp === "low" || s(style.paragraph_density) === "expanded") return "EXPANDED";
    return "NATURAL";
  }
  const preferShort =
    everyday.minimal_context_sufficient === true ||
    style.short_post_compatible === true ||
    s(style.compression_level) === "high";
  const railComp = s(rail.compression_preference || everyday.compression_preference);
  if (preferShort && (railComp === "high" || humor.stop_after_punchline_ok === true)) return "COMPRESSED";
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

  const core = applyAgentSeungCoreThought(
    buildCoreThought(interp, seed, mech, input.agent_core_thought),
    input.agent_core_thought,
  );
  const compression_target = resolveCompressionTarget(style, rail, everyday, humor, mode);
  const inference = resolveInferenceSpace(mech, style, everyday);
  const punchlineStop = !!humor.stop_after_punchline_ok && !!humor.punchline_compatible;

  let generation_status: GenerationStatus = "GENERATION_CONTEXT_READY";
  if (core.status === "CORE_THOUGHT_BLOCKED" || core.status === "CORE_THOUGHT_INSUFFICIENT_SEED") {
    generation_status = "GENERATION_CONTEXT_BLOCKED";
  } else if (core.status === "CORE_THOUGHT_HOLD") {
    generation_status = "CORE_THOUGHT_HOLD";
  } else if (core.status === "CORE_THOUGHT_WEAK") {
    generation_status = "CORE_THOUGHT_WEAK";
  } else if (s(interp.status) === "INTERPRETATION_WEAK") {
    generation_status = "GENERATION_CONTEXT_MINIMAL";
  }

  const prohibited_claims: string[] = [];
  const expBound = (interp.experience_boundaries as Record<string, unknown>) || {};
  if (expBound.must_not_claim_first_person) {
    prohibited_claims.push("unsupported_first_person_experience");
    prohibited_claims.push("first_person_lived_experience_without_evidence");
  }
  if (Array.isArray(interp.do_not_invent)) {
    for (const x of interp.do_not_invent as unknown[]) prohibited_claims.push(s(x).slice(0, 80));
  }
  if (Array.isArray(seed.do_not_invent)) {
    for (const x of seed.do_not_invent as unknown[]) prohibited_claims.push(s(x).slice(0, 80));
  }

  const prohibited_copy_sources = [
    "manual_creator_posts", // manual_text / manual_post_text / raw_prose_rejected
    "historical_creator_posts",
    "audience_comments",
    "sample_generated_posts",
    "previous_batch_outputs",
    "finished_example_prose",
    "same_lived_episode_retell",
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
    planner_intent: {
      strategy_slot_id: s(input.planner_intent?.strategy_slot_id),
      strategic_role: s(input.planner_intent?.strategic_role),
      intent: s(input.planner_intent?.intent),
    },
    interpreted_meaning: {
      status: s(interp.status),
      seed_subject: s(interp.seed_subject || seed.concrete_subject),
      what_is_actually_happening: s(interp.what_is_actually_happening),
      why_it_matters_now: s(interp.why_it_matters_now || interp.why_it_might_matter_to_creator),
      human_element: s(interp.human_element || interp.concrete_human_element || interp.possible_reader_connection),
    },
    why_it_matters: s(interp.why_it_matters_now || interp.why_it_might_matter_to_creator),
    human_element: s(interp.human_element || interp.concrete_human_element || interp.possible_reader_connection),
    factual_boundaries: Array.isArray(interp.factual_boundaries)
      ? (interp.factual_boundaries as unknown[])
      : Array.isArray(seed.allowed_facts)
        ? (seed.allowed_facts as unknown[])
        : [],
    experience_boundaries: expBound,
    cite_episode_hint: s((seed as any).cite_episode_hint),
    source_type: s((seed as any).source_type || (seed as any).source_kind || seed.primary_source),
    source_kind: s((seed as any).source_kind),
    reader_self_projection: {
      self_projection_strength: s(mech.self_projection_strength),
      story_invitation_strength: s(mech.story_invitation_strength),
      question_required: false,
    },
    reaction_mechanism: (() => {
      const rawId = s(
        mech.selected_mechanism_id ||
          mech.mechanism_id ||
          (typeof mech.selected_mechanism === "string" ? mech.selected_mechanism : ""),
      );
      const def = rawId && rawId !== "NONE" ? getMechanismById(rawId as MechanismId) : undefined;
      return {
        flexible: true,
        status: s(mech.status),
        selected_mechanism_id: rawId,
        selected_mechanism: rawId,
        mechanism_family: s(mech.mechanism_family || def?.mechanism_id || ""),
        intended_reaction: s(mech.intended_reaction || def?.intended_reaction),
        reader_entry_point: s(mech.reader_entry_point || def?.reader_entry_point),
        reasoning_logic: s(mech.reasoning_logic || def?.reasoning_logic),
        completion_style: s(mech.completion_style || def?.completion_style),
        selection_reason: s(mech.selection_reason),
      };
    })(),
    core_thought: core,
    thinking_rail: {
      flexible: true,
      status: s(rail.status, "RAIL_NONE"),
      selected_rail_id: s(rail.selected_rail_id || rail.rail_id),
      compression_preference: s(rail.compression_preference),
      reasoning_shape: s(rail.reasoning_shape),
      required_reasoning_beats: [],
      static_library_is_not_creator_dna: true,
    },
    everyday_language: {
      prefer_broad_simple: true,
      status: s(everyday.status),
      minimal_context_sufficient: !!everyday.minimal_context_sufficient,
      compression_preference: s(everyday.compression_preference),
      reader_entry_strategy: s(everyday.reader_entry_strategy),
      human_relevance_bridge: s(everyday.human_relevance_bridge),
      precision_conflict: !!everyday.precision_conflict,
      protected_meaning: Array.isArray(everyday.protected_meaning) ? everyday.protected_meaning : [],
      forbidden_simplifications: Array.isArray(everyday.forbidden_simplifications)
        ? everyday.forbidden_simplifications
        : [],
    },
    creator_style: {
      status: s(style.status),
      selected_style_id: s(style.selected_style_id || style.style_id),
      style_family: s(style.style_family),
      compression_level: s(style.compression_level),
      short_post_compatible: !!style.short_post_compatible,
      conversational_level: s(style.conversational_level),
      paragraph_density: s(style.paragraph_density),
      politeness_level: s(style.politeness_level),
      directness: s(style.directness),
      reflection_level: s(style.reflection_level),
      technical_density: s(style.technical_density),
      punchline_compatible: !!style.punchline_compatible,
      prohibited_surface_behaviors: Array.isArray(style.prohibited_surface_behaviors)
        ? style.prohibited_surface_behaviors
        : [],
    },
    humor_decision: {
      humor_compatible: !!humor.humor_compatible,
      humor_grounded: !!humor.humor_grounded,
      humor_strength: s(humor.humor_strength, "NONE"),
      self_deprecation_allowed: !!humor.self_deprecation_allowed,
      laughter_marker_allowed: !!humor.laughter_marker_allowed,
      punchline_compatible: !!humor.punchline_compatible,
      punchline_required: false,
      sample_punchline: null,
      stop_after_punchline_ok: !!humor.stop_after_punchline_ok,
      explanation_after_punchline_allowed: humor.explanation_after_punchline_allowed !== false,
      no_humor_is_normal: true,
    },
    compression_target,
    reader_inference_space: inference,
    stop_condition: {
      mechanism_completed_ok: true,
      core_thought_delivered_ok: core.status === "CORE_THOUGHT_READY" || core.status === "CORE_THOUGHT_OPEN" || core.status === "CORE_THOUGHT_WEAK",
      punchline_stop_ok: punchlineStop,
      leave_inference_open: inference === "high" || inference === "medium",
      avoid_explanatory_tail: true,
      minimal_context_sufficient: !!everyday.minimal_context_sufficient,
    },
    prohibited_claims,
    prohibited_copy_sources,
    recent_repetition_risk: s(style.recent_style_repetition_risk || humor.recent_humor_repetition_risk, "low"),
    week_structural_signatures: Array.isArray(input.week_structural_signatures)
      ? input.week_structural_signatures
      : [],
    seed_packet: input.seed_packet || undefined,
    post_thought: input.post_thought || undefined,
    thinking_intelligence: input.thinking_intelligence || undefined,
    collection_block: input.collection_block || undefined,
    collection_hook: input.collection_hook || undefined,
    experience_packet: input.experience_packet || undefined,
    generation_status,
    voice_register: input.voice_register || null,
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
    ctx.generation_status === "CORE_THOUGHT_WEAK" ||
    ctx.generation_status === "CORE_THOUGHT_HOLD"
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
