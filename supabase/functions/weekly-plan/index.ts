/**
 * Weekly Planner Edge — Production canonical (v9.1.2)
 * Expand: Evidence/Intent only. Language=Korean output; Location=Evidence only.
 * No production templates. Location never inferred from language alone.
 * ORDER 3+4 FINAL HOTFIX: allowed_facts propagation in compactSlot.
 * ORDER 1: Independent Seed Interpretation Layer wired into select/compactSlot.
 * ORDER 2: Reader Self-Projection + Reaction Mechanism selection after interpretation.
 * ORDER 3: Thinking Rail Runtime after Reaction Mechanism (no topic→rail, style null).
 * ORDER 5B: Everyday Language Decision after Thinking Rail (operational pipeline).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  DIMENSION_REGISTRY,
  applyLocalGates,
  subjectSignature,
  consolidateSemanticGroups,
  createSeedIdFactory,
  isSelectableStatus,
  canServeEditorialMode,
  buildModeSupplyReport,
  parseEditorialMode,
  WEEKLY_EDITORIAL_MODES,
  evaluateEditorialSeedQuality,
  ideaAngleKey,
  ideaAngleGuardAllow,
  conceptualDiversityScore,
  conceptualRepetitionLevel,
  bootstrapCandidatesFromDimensions,
  type ConcreteSeed,
} from "./seed-engine.ts";
import {
  allocateEditorialSlots,
  buildEditorialQueue,
  lengthForEditorial,
  type EditorialMode,
} from "./editorial-mix.ts";
import {
  analyzeCreatorIntent14d,
  blendInterestMix,
  DEFAULT_INTEREST_MIX,
} from "./creator-intent-14d.ts";
import {
  buildRecentExperienceCandidates,
  resolveExperienceSupply,
  experienceCandidateToSeedFields,
} from "./experience-evidence.ts";
import { judgeSeedGrounding, countIntegrityOk } from "./runtime-grounding.ts";
import {
  redistributeDailyTopics,
  topicDistributionReport,
  softDailyCap,
} from "./daily-topic-distribute.ts";
import {
  guardCandidateAgainstManualLeakage,
  type RecentManualPost,
} from "./manual-leakage-guard.ts";
import { isSeedEligibleRole, type SourceRole } from "./source-roles.ts";
import {
  interpretSeed,
  isInterpretationPassable,
  isInterpretationBlocked,
  type SeedInterpretation,
} from "./seed-interpretation.ts";
import {
  selectReactionMechanism,
  isMechanismPassable,
  isMechanismBlocked,
  type MechanismSelectionResult,
} from "./reader-self-projection.ts";
import {
  selectThinkingRail,
  isRailPassable,
  isRailBlocked,
  type ThinkingRailDecision,
  ORDER3_VERSION,
} from "./thinking-rail-runtime.ts";
import {
  decideEverydayLanguage,
  isEverydayLanguagePassable,
  isPrecisionBlocked,
  type EverydayLanguageDecision,
  ORDER5A_VERSION,
  ORDER5B_VERSION,
  ORDER5C_VERSION,
} from "./everyday-language-reasoning.ts";
import {
  decideCreatorStyle,
  ORDER6A_VERSION,
  ORDER6B_STYLE_VERSION,
  ORDER6C_STYLE_VERSION,
  type CreatorStyleDecision,
} from "./creator-style-decision.ts";
import {
  decideNaturalHumor,
  ORDER6B_HUMOR_VERSION,
  ORDER6C_HUMOR_VERSION,
  type NaturalHumorDecision,
} from "./natural-humor-decision.ts";
import {
  buildDeepGenerationContext,
  ORDER7A_VERSION,
  type DeepGenerationContext,
} from "./deep-generation-context.ts";
import {
  generateIndependentPost,
  ORDER7B_VERSION,
  type IndependentPostResult,
} from "./independent-post-generation.ts";
import {
  integrateSlotGeneration,
  evaluateWeeklyCompletionGate,
  ensureSlotCountPreserved,
  ORDER7C_VERSION,
  type IntegratedSlotResult,
} from "./generation-integration.ts";
import {
  judgeIndependentResult,
  ORDER8A_VERSION,
  type SemanticJudgeResult,
} from "./semantic-judge.ts";
import {
  routeSlotWithRegeneration,
  decideRegenerationRoute,
  ORDER8B_VERSION,
  type RoutedSlotResult,
} from "./regeneration-router.ts";
import {
  executeSelectiveRegeneration,
  snapshotFromSlotParts,
  ORDER8B_HOTFIX_VERSION,
} from "./selective-regeneration.ts";
import {
  buildWeeklyPublicationSummary,
  evaluateOrder8cCompletionGate,
  ORDER8C_VERSION,
  preserveSlotCountNoFakeContent,
} from "./weekly-count-ledger.ts";

const POSTS_MIN = 5;
const POSTS_MAX = 8;
const POSTS_TARGET = 6;
const APP_VERSION = "10.0.0";
const APP_VERSION_ORDER8A_COMPAT = "10.0.0-order8a-semantic-judge";
const APP_VERSION_ORDER7C_COMPAT = "10.0.0-order7c-generation-integration";
const APP_VERSION_ORDER7B_COMPAT = "10.0.0-order7b-hotfix-live-xai";
const APP_VERSION_ORDER7A_COMPAT = "10.0.0-order7a";
// regression marker: 10.0.0-order7b-hotfix-live-xai | 10.0.0-order7a
// regression engine markers: phased_v10_order7b_independent_generation | phased_v10_order7a_deep_generation
// await generateIndependentPost — production path routes through integrateSlotGeneration → generateIndependentPost
const WEEKLY_ENGINE_VERSION = "phased_v10_release";
// regression: phased_v10_order8a_semantic_judge
// regression: phased_v10_order7c_generation_integration | phased_v10_order7b_independent_generation
const GENERATOR_VERSION = "creator_dna_publishing_v1.3.2_vocab_fidelity";
const GIT_COMMIT = Deno.env.get("GIT_COMMIT") || Deno.env.get("COMMIT_SHA") || "main";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function majorKey(cluster: string, subject: string): string {
  const c = (cluster || "").toUpperCase();
  const s = (subject || "").toLowerCase();
  if (c.includes("CYBER") || /cybertruck|사이버/.test(s)) return "CYBERTRUCK";
  if (c === "FSD" || /\bfsd\b/.test(s)) return "FSD";
  if (/robotaxi|로보택시|curb|주정차|승하차/.test(s) || c === "ROBOTAXI") return "ROBOTAXI";
  if (/lafc|bmo|직관/.test(s) || c === "LAFC") return "LAFC";
  if (c === "AI_TECH" || /\bai\b|grok|그록/.test(s)) return "AI_TECH";
  if (c === "GAMING" || /게임/.test(s)) return "GAMING";
  return c || "OTHER";
}

function interpretConcreteSeed(seed: ConcreteSeed, mode?: EditorialMode): SeedInterpretation {
  return interpretSeed({
    seed_id: seed.seed_id,
    concrete_subject: seed.concrete_subject,
    topic: seed.cluster,
    cluster: seed.cluster,
    dimension: (seed as any).dimension,
    subtopic: (seed as any).subtopic,
    editorial_mode: mode || (seed as any).editorial_mode,
    allowed_facts: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts : [],
    factual_anchors: Array.isArray((seed as any).factual_anchors) ? (seed as any).factual_anchors : [],
    experience_facts: Array.isArray((seed as any).experience_facts) ? (seed as any).experience_facts : [],
    source_role: (seed as any).source_role,
    source_type: seed.source_type || seed.primary_source,
    source_id: Array.isArray(seed.evidence_source_ids) ? String(seed.evidence_source_ids[0] || "") : undefined,
    point_or_tension: seed.point_or_tension,
    creator_evidence_available: !!seed.creator_evidence_available,
    experience_required: String(mode || "").toUpperCase() === "EXPERIENCE",
  });
}

async function compactSlot(
  seed: ConcreteSeed,
  dayOffset: number,
  slot: number,
  mode: EditorialMode,
  interpretation?: SeedInterpretation | null,
  mechanism?: MechanismSelectionResult | null,
  rail?: ThinkingRailDecision | null,
  language?: EverydayLanguageDecision | null,
  genOpts?: { dry_run?: boolean; xai_key?: string | null },
) {
  const seed_interpretation = interpretation || interpretConcreteSeed(seed, mode);
  const reaction_mechanism =
    mechanism ||
    selectReactionMechanism({ interpretation: seed_interpretation, editorial_mode: mode });
  const thinking_rail =
    rail ||
    selectThinkingRail({
      interpretation: seed_interpretation,
      mechanism: reaction_mechanism,
      editorial_mode: mode,
    });
  const everyday_language =
    language ||
    decideEverydayLanguage({
      interpretation: seed_interpretation,
      editorial_mode: mode,
      thinking_rail: {
        compression_preference: thinking_rail.compression_preference,
        preserve_reader_entry: true,
        status: thinking_rail.status,
      },
    });
  const creator_style: CreatorStyleDecision = decideCreatorStyle({
    context: {
      everyday_language_status: everyday_language.status,
      everyday_minimal_context_sufficient: everyday_language.minimal_context_sufficient,
      everyday_precision_conflict: everyday_language.precision_conflict,
      rail_compression_preference: thinking_rail?.compression_preference || everyday_language.compression_preference,
      prefer_short: everyday_language.minimal_context_sufficient === true,
      interpretation_status: seed_interpretation?.status || null,
      mechanism_status: (reaction_mechanism as any)?.status || null,
      mechanism_id: (reaction_mechanism as any)?.selected_mechanism_id || (reaction_mechanism as any)?.mechanism_id || null,
      rail_status: thinking_rail?.status || null,
      story_invitation_strength: (seed_interpretation as any)?.story_invitation_strength || null,
      has_lived_reflection: !!(seed as any).creator_evidence_available,
      has_experience_grounding: !!seed.creator_evidence_available || String(mode || "").toUpperCase() === "EXPERIENCE",
      has_factual_grounding: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts.length > 0 : true,
      editorial_mode: mode,
      topic_cluster: seed.cluster,
    },
  });
  const natural_humor: NaturalHumorDecision = decideNaturalHumor({
    context: {
      editorial_mode: mode,
      mechanism_status: (reaction_mechanism as any)?.status || null,
      mechanism_id: (reaction_mechanism as any)?.selected_mechanism_id || null,
      rail_status: thinking_rail?.status || null,
      everyday_language_status: everyday_language.status,
      everyday_minimal_context_sufficient: everyday_language.minimal_context_sufficient,
      style_punchline_compatible: creator_style.punchline_compatible,
      style_dialogue_compatible: creator_style.dialogue_compatible,
      style_conversational_level: creator_style.conversational_level,
      style_family: creator_style.style_family,
      prefer_short: everyday_language.minimal_context_sufficient === true,
      has_lived_experience_grounding: !!seed.creator_evidence_available,
      has_factual_grounding: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts.length > 0 : true,
      // Natural humor sources are not inferred from mode/topic — only explicit structured flags if present
      has_irony_signal: !!(seed as any).has_irony_signal,
      has_contradiction_signal: !!(seed as any).has_contradiction_signal,
      has_anticlimax_signal: !!(seed as any).has_anticlimax_signal,
      has_awkward_truth_signal: !!(seed as any).has_awkward_truth_signal,
      has_shared_recognition_signal: !!(seed as any).has_shared_recognition_signal,
      has_self_observed_imperfection: !!(seed as any).has_self_observed_imperfection,
      has_unexpected_reversal: !!(seed as any).has_unexpected_reversal,
      has_repeated_behavior_signal: !!(seed as any).has_repeated_behavior_signal,
      has_absurd_detail_signal: !!(seed as any).has_absurd_detail_signal,
    },
  });
  const deep_generation: DeepGenerationContext = buildDeepGenerationContext({
    slot_id: `D${dayOffset + 1}P${slot}`,
    day_offset: dayOffset,
    slot_index: slot,
    seed: seed as any,
    interpretation: seed_interpretation as any,
    reaction_mechanism: reaction_mechanism as any,
    thinking_rail: thinking_rail as any,
    everyday_language: everyday_language as any,
    creator_style: creator_style as any,
    natural_humor: natural_humor as any,
    editorial_mode: mode,
  });
  // ORDER 7C: integrate primary + retry (same upstream) + BLOCKED preserve
  const integrated: IntegratedSlotResult = await integrateSlotGeneration(deep_generation, {
    dry_run: genOpts?.dry_run === true,
    xai_key: genOpts?.xai_key ?? null,
    seed_id: seed.seed_id,
  });
  let independent_generation: IndependentPostResult = integrated.independent || {
    slot_id: deep_generation.slot_id,
    context_id: deep_generation.context_id,
    final_text: integrated.final_text,
    generation_status: integrated.generation_status === "RECOVERED"
      ? "GENERATED"
      : (integrated.generation_status === "BLOCKED" ? "GENERATION_RETRY_REQUIRED" : (integrated.generation_status as any)),
    generation_confidence: 0,
    seed_fidelity: integrated.seed_fidelity,
    core_thought_preserved: integrated.core_thought_preserved,
    factual_boundary_preserved: integrated.factual_boundary_preserved,
    experience_boundary_preserved: integrated.experience_boundary_preserved,
    reader_inference_preserved: true,
    compression_followed: integrated.compression_followed,
    stop_condition_followed: integrated.stop_condition_followed,
    generation_version: ORDER7B_VERSION,
    plan_markers: {
      seed_subject: String(seed.concrete_subject || "").slice(0, 160),
      core_axis: "",
      mechanism_flexible: true,
      rail_flexible: true,
      humor_mode: "NONE",
      compression_target: deep_generation.compression_target || "NATURAL",
      stop_punchline: false,
      leave_inference_open: true,
      prefer_broad_simple: true,
      question_required: false,
      cta_required: false,
    },
    block_reasons: integrated.block_reasons,
    order7b_version: ORDER7B_VERSION,
    order7a_context_version: ORDER7A_VERSION,
    writer_mode: integrated.writer_mode as any,
    writer_call_attempted: integrated.writer_call_attempted,
    writer_call_succeeded: integrated.writer_call_succeeded,
    writer_error: integrated.writer_error,
  };
  // ORDER 8A: Semantic Judge (evaluate only — no rewrite / no auto-regeneration)
  let semantic_judge_result: SemanticJudgeResult | null = null;
  try {
    semantic_judge_result = judgeIndependentResult(deep_generation, independent_generation, undefined, {
      xai_key: (genOpts as any)?.xai_key ?? null,
    });
  } catch {
    semantic_judge_result = {
      slot_id: independent_generation.slot_id,
      context_id: independent_generation.context_id,
      overall_status: "JUDGE_UNAVAILABLE",
      hard_fail_reasons: [],
      soft_concerns: [],
      scores: {
        seed_fidelity: 0, core_thought_preservation: 0, creator_fit: 0, factual_grounding: 0,
        experience_grounding: 0, reader_self_projection: 0, mechanism_fit: 0, rail_fit: 0,
        everyday_language_fit: 0, style_fit: 0, humor_fit: 0, inference_space_fit: 0,
        compression_fit: 0, stop_condition_fit: 0, anti_ai_voice_fit: 0, novelty_fit: 0,
      },
      flags: {
        fabricated_fact: false, fabricated_experience: false, manual_text_leakage: false,
        forced_cta: false, forced_question: false, ai_report_voice: false, over_explained: false,
        over_connected: false, template_like: false, conceptual_repetition: "LOW",
      },
      judge_version: ORDER8A_VERSION,
      judge_call_attempted: true,
      judge_call_succeeded: false,
      judge_error: "judge_attach_exception",
      judge_mode: "unavailable",
    };
  }

  // ORDER 8B: Rejection & Regeneration Routing
  let routed: RoutedSlotResult | null = null;
  try {
    routed = await routeSlotWithRegeneration({
      slot_id: independent_generation.slot_id,
      context_id: independent_generation.context_id,
      ctx: deep_generation,
      initial_independent: independent_generation,
      initial_judge: semantic_judge_result!,
      executeRegen: async (decision, _attempt) => {
        const snap = snapshotFromSlotParts({
          slot_id: independent_generation.slot_id,
          context_id: independent_generation.context_id || deep_generation?.context_id,
          seed: seed as any,
          editorial_mode: mode,
          interpretation: seed_interpretation as any,
          reaction_mechanism: reaction_mechanism as any,
          thinking_rail: thinking_rail as any,
          everyday_language: everyday_language as any,
          creator_style: creator_style as any,
          natural_humor: natural_humor as any,
          deep_context: deep_generation,
        });
        const sel = await executeSelectiveRegeneration({
          snapshot: snap,
          decision,
          genOpts: {
            dry_run: genOpts?.dry_run === true,
            xai_key: genOpts?.xai_key ?? null,
          },
        });
        if (sel.deep_context) {
          deep_generation = sel.deep_context;
        }
        return { independent: sel.independent, judge: sel.judge };
      },
    });
    if (routed && (routed.slot_final_state === "ACCEPTED_PASS" || routed.slot_final_state === "ACCEPTED_WITH_CONCERNS" || routed.slot_final_state === "REGENERATED_PASS")) {
      independent_generation = routed.independent || independent_generation;
      semantic_judge_result = routed.judge || semantic_judge_result;
    } else if (routed && (routed.slot_final_state === "BLOCKED" || routed.slot_final_state === "JUDGE_UNAVAILABLE")) {
      independent_generation = {
        ...independent_generation,
        final_text: "",
        generation_status: "GENERATION_BLOCKED" as any,
        block_reasons: [...(independent_generation.block_reasons || []), "order8b_" + String(routed.slot_final_state).toLowerCase()],
      };
      if (routed.judge) semantic_judge_result = routed.judge;
    }
  } catch {
    routed = null;
  }

  return {
    slotId: `D${dayOffset + 1}P${slot}`,
    dayOffset,
    primaryTopic: seed.concrete_subject,
    topic_cluster: seed.cluster,
    cluster: seed.cluster,
    concrete_subject: seed.concrete_subject,
    editorial_mode: mode,
    length_mode: lengthForEditorial(mode),
    angle: seed.point_or_tension || "",
    actionType: "ORIGINAL",
    planning_source: "PHASED_SEED",
    idea_angle_key: ideaAngleKey(seed),
    seed_id: seed.seed_id,
    creator_evidence_available: !!seed.creator_evidence_available,
    primary_source: seed.primary_source,
    source_type: seed.source_type || seed.primary_source,
    source_id: Array.isArray(seed.evidence_source_ids) ? seed.evidence_source_ids[0] : undefined,
    evidence_source_ids: seed.evidence_source_ids || [],
    claim_types: seed.claim_types || [],
    inference_type: seed.inference_type || "UNKNOWN",
    grounding_status: seed.grounding_status || "UNKNOWN",
    grounding_reasons: seed.grounding_reasons || [],
    idea_angle_family: seed.idea_angle_family || ideaAngleKey(seed),
    verified_locations: seed.verified_locations || [],
    verified_entities: seed.verified_entities || [],
    relationship_evidence_ids: seed.relationship_evidence_ids || [],
    xai_would_have_been_required: !!seed.xai_would_have_been_required,
    allowed_facts: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts : [],
    factual_anchors: Array.isArray((seed as any).factual_anchors) ? (seed as any).factual_anchors : [],
    do_not_invent: Array.isArray((seed as any).do_not_invent) ? (seed as any).do_not_invent : [],
    experience_facts: Array.isArray((seed as any).experience_facts) ? (seed as any).experience_facts : [],
    static_facts: Array.isArray((seed as any).static_facts) ? (seed as any).static_facts : [],
    current_facts: Array.isArray((seed as any).current_facts) ? (seed as any).current_facts : [],
    creator_opinion: Array.isArray((seed as any).creator_opinion) ? (seed as any).creator_opinion : [],
    seed_interpretation,
    interpretation_status: seed_interpretation.status,
    reaction_mechanism,
    mechanism_status: reaction_mechanism.status,
    selected_mechanism: reaction_mechanism.selected_mechanism,
    self_projection_strength: reaction_mechanism.self_projection_strength,
    story_invitation_strength: reaction_mechanism.story_invitation_strength,
    question_required: reaction_mechanism.question_required,
    thinking_rail,
    rail_status: thinking_rail.status,
    selected_rail_id: thinking_rail.selected_rail_id,
    rail_confidence: thinking_rail.confidence,
    reasoning_shape: thinking_rail.reasoning_shape,
    long_horizon_allowed: thinking_rail.long_horizon_allowed,
    experience_required_by_rail: thinking_rail.experience_required,
    rail_compression: thinking_rail.compression_preference,
    everyday_language,
    language_status: everyday_language.status,
    reader_entry_strategy: everyday_language.reader_entry_strategy,
    human_relevance_bridge: everyday_language.human_relevance_bridge,
    minimal_context_sufficient: everyday_language.minimal_context_sufficient,
    compression_preference_lang: everyday_language.compression_preference,
    precision_conflict: everyday_language.precision_conflict,
    attention_relevance_ok: everyday_language.attention_relevance_ok,
    sensationalism_blocked: everyday_language.sensationalism_blocked,
    self_projection_preservation: everyday_language.self_projection_preservation,
    order5b_version: ORDER5B_VERSION,
    order5c_version: ORDER5C_VERSION,
    style_decision: creator_style,
    style_status: creator_style.status,
    selected_style_id: creator_style.selected_style_id,
    style_family: creator_style.style_family,
    humor_decision: creator_style.humor_decision,
    order6a_version: ORDER6A_VERSION,
    order6c_style_version: ORDER6C_STYLE_VERSION,
    order6b_style_version: ORDER6B_STYLE_VERSION,
    natural_humor: natural_humor,
    humor_status: natural_humor.humor_status,
    humor_compatible: natural_humor.humor_compatible,
    humor_strength: natural_humor.humor_strength,
    humor_source_type: natural_humor.humor_source_type,
    humor_grounded: natural_humor.humor_grounded,
    self_deprecation_allowed: natural_humor.self_deprecation_allowed,
    laughter_marker_allowed: natural_humor.laughter_marker_allowed,
    punchline_compatible: natural_humor.punchline_compatible,
    punchline_required: natural_humor.punchline_required,
    stop_after_punchline_ok: natural_humor.stop_after_punchline_ok,
    explanation_after_punchline_allowed: natural_humor.explanation_after_punchline_allowed,
    forced_humor_risk: natural_humor.forced_humor_risk,
    order6c_humor_version: ORDER6C_HUMOR_VERSION,
    order6b_humor_version: ORDER6B_HUMOR_VERSION,
    deep_generation,
    generation_status: deep_generation.generation_status,
    core_thought: deep_generation.core_thought,
    core_thought_status: deep_generation.core_thought.status,
    compression_target: deep_generation.compression_target,
    stop_condition: deep_generation.stop_condition,
    context_id: deep_generation.context_id,
    order7a_version: ORDER7A_VERSION,
    independent_generation,
    independent_generation_status: independent_generation.generation_status,
    final_text: independent_generation.final_text,
    // ORDER 8A judge attach (generation_status remains separate from judge_status)
    semantic_judge: semantic_judge_result,
    judge_status: semantic_judge_result?.overall_status ?? "JUDGE_UNAVAILABLE",
    order8a_version: ORDER8A_VERSION,
    judge_call_attempted: semantic_judge_result?.judge_call_attempted ?? false,
    judge_call_succeeded: semantic_judge_result?.judge_call_succeeded ?? false,
    judge_error: semantic_judge_result?.judge_error ?? null,
    hard_fail_count: semantic_judge_result?.hard_fail_reasons?.length ?? 0,
    soft_concern_count: semantic_judge_result?.soft_concerns?.length ?? 0,
    judge_seed_fidelity: semantic_judge_result?.scores?.seed_fidelity ?? 0,
    judge_core_thought_preservation: semantic_judge_result?.scores?.core_thought_preservation ?? 0,
    judge_creator_fit: semantic_judge_result?.scores?.creator_fit ?? 0,
    judge_conceptual_repetition: semantic_judge_result?.flags?.conceptual_repetition ?? "LOW",
    order8b_version: ORDER8B_VERSION,
    order8b_hotfix_version: ORDER8B_HOTFIX_VERSION,
    semantic_regen_attempts: routed?.semantic_regen_attempts ?? 0,
    last_route: routed?.last_route ?? "NO_ACTION",
    slot_final_state: routed?.slot_final_state ?? "PENDING",
    regeneration_exhausted: routed?.regeneration_exhausted ?? false,
    seed_fidelity: independent_generation.seed_fidelity,
    core_thought_preserved: independent_generation.core_thought_preserved,
    experience_boundary_preserved: independent_generation.experience_boundary_preserved,
    reader_inference_preserved: independent_generation.reader_inference_preserved,
    compression_followed: independent_generation.compression_followed,
    stop_condition_followed: independent_generation.stop_condition_followed,
    generation_confidence: independent_generation.generation_confidence,
    order7b_version: ORDER7B_VERSION,
    order7c_version: ORDER7C_VERSION,
    lifecycle_status: integrated.lifecycle_status,
    generation_attempts: integrated.generation_attempts,
    recovery_used: integrated.recovery_used,
    recovery_type: integrated.recovery_type,
    seed_replaced: integrated.seed_replaced,
    integrated_generation_status: integrated.generation_status,
    writer_mode: independent_generation.writer_mode,
    writer_call_attempted: independent_generation.writer_call_attempted,
    writer_call_succeeded: independent_generation.writer_call_succeeded,
  };
}

function seedArrayFromBody(body: any): any[] {
  if (Array.isArray(body?.seeds) && body.seeds.length) return body.seeds;
  if (Array.isArray(body?.candidates) && body.candidates.length) return body.candidates;
  if (Array.isArray(body?.gated_seeds) && body.gated_seeds.length) return body.gated_seeds;
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing Authorization", days: [] }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Not authenticated", days: [] }, 401);

    const body = await req.json().catch(() => ({}));
    const phase = String(body.phase || "").toLowerCase() || "expand";
    const postsPerDay = Math.min(POSTS_MAX, Math.max(POSTS_MIN, Number(body.postsPerDay) || POSTS_TARGET));
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);
    const required_slots = postsPerDay * daysCount;
    const xaiKey = (Deno.env.get("XAI_API_KEY") || "").trim();
    const t0 = Date.now();

    if (phase === "expand") {
      const published = Array.isArray(body.publishedTopics)
        ? body.publishedTopics.map(String)
        : Array.isArray(body.publishedTopics21d)
          ? body.publishedTopics21d.map(String)
          : [];
      const intentText = String(body.creatorIntent || body.topic || "").trim();
      const ORDER2_BLOCK_XAI_EXPAND = true;
      const since = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString();
      const { data: actRows } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, x_post_id")
        .gte("published_at", since)
        .limit(400);
      const evidenceSubjects: string[] = [];
      const publishedEvidence: Array<{ text: string; source_id?: string; published_at?: string; post_type?: string }> = [];
      for (const row of actRows || []) {
        const t = String((row as any).text_body || "").trim();
        if (t.length < 12) continue;
        const pt = String((row as any).post_type || (row as any).action_type || "").toUpperCase();
        if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) continue;
        const soc = String((row as any).system_origin_class || "").toUpperCase();
        if (soc && /APP|SYSTEM|AUTOPOST|GENERATED/.test(soc)) continue;
        evidenceSubjects.push(t.slice(0, 160));
        publishedEvidence.push({
          text: t,
          source_id: (row as any).x_post_id || undefined,
          published_at: (row as any).published_at || undefined,
          post_type: pt,
        });
      }
      const local = bootstrapCandidatesFromDimensions({
        publishedSubjects: published,
        publishedEvidence,
        intentText,
      });
      const nextId = createSeedIdFactory("s");
      const gated = applyLocalGates(local, [], nextId);
      const recentManual: RecentManualPost[] = publishedEvidence.map((p) => ({
        text: p.text,
        source_id: p.source_id,
        published_at: p.published_at,
        post_type: p.post_type,
      }));
      let leakage_blocked = 0;
      const candidates: any[] = [];
      for (const c of gated.passed) {
        const role = (c.source_role as SourceRole) || "SEED_SOURCE";
        const g = guardCandidateAgainstManualLeakage({
          source_role: role,
          concrete_subject: String(c.concrete_subject || ""),
          point_or_tension: c.point_or_tension ? String(c.point_or_tension) : undefined,
          recent_manual: recentManual,
          user_explicit: role === "USER_EXPLICIT_SEED",
        });
        if (!g.allow_as_seed) {
          leakage_blocked += 1;
          continue;
        }
        candidates.push({
          ...c,
          source_role: role,
          source_trace: {
            source_role: role,
            source_type: (c.source_type as string) || "DIMENSION_REGISTRY",
            manual_source_used: false,
            manual_text_exposed_to_generation: false,
            leakage_guard_result: g.reason === "PASS" ? "PASS" : "BLOCK_SEMANTIC",
            semantic_recent_post_overlap: g.semantic_recent_post_overlap,
          },
        });
      }
      const supply_low = candidates.length < Math.min(required_slots, 8);
      const xai_would = candidates.filter((c: any) => c.xai_would_have_been_required).length;
      const raw_copy_guard = candidates.every((c: any) => {
        const sub = String(c.concrete_subject || "");
        return !evidenceSubjects.some((e) => e.startsWith(sub) && sub.length > 40);
      });
      return json({
        success: true,
        phase: "expand",
        candidates,
        gated_seeds: candidates,
        expand_done: true,
        dim_batch_index: 0,
        dim_batch_total: 1,
        next_dim_batch_index: 1,
        id_counter: candidates.length,
        engine: WEEKLY_ENGINE_VERSION,
        xai_api_used: false,
        xai_error: ORDER2_BLOCK_XAI_EXPAND
          ? "v10 order0b: expand uses Evidence/Intent only (xAI content supply blocked)"
          : undefined,
        seed_count: candidates.length,
        key_present: !!xaiKey,
        key_len: xaiKey.length,
        expand_model: "none_evidence_only",
        supply_low,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          local_raw: local.length,
          local_passed: gated.passed.length,
          local_rejected: gated.local_gate_rejected,
          expand_model: "none_evidence_only",
          evidence_activity_rows: (actRows || []).length,
          evidence_subjects: evidenceSubjects.length,
          published_evidence_rows: publishedEvidence.length,
          published_input: published.length,
          order2_xai_expand_blocked: true,
          order3_evidence_packet_reasoning: true,
          order0b_manual_leakage_separation: true,
          order0b_leakage_blocked: leakage_blocked,
          order1_seed_interpretation: true,
          order2_reader_mechanism: true,
          order3_thinking_rail: true,
          language_policy: "Korean output; location only from Evidence",
          supply_low,
          raw_post_copy_guard_ok: raw_copy_guard,
          xai_would_have_been_required_count: xai_would,
          status_counts: {
            VALID_INTERNAL: candidates.filter((c: any) => !c.xai_would_have_been_required).length,
            XAI_WOULD_HAVE_BEEN_REQUIRED: xai_would,
            SHORTFALL: Math.max(0, Math.min(required_slots, 8) - candidates.length),
          },
          xai_usage: {
            seed_expansion: false,
            external_supplement: false,
            creator_generation: false,
          },
        },
        note: "v10 order0b: manual posts are learning signals only; no narrative/wording reuse as SEED_SOURCE.",
        timing: { total_ms: Date.now() - t0 },
      });
    }

    if (phase === "judge") {
      const batch = seedArrayFromBody(body);
      const judged: ConcreteSeed[] = [];
      let grounding_reject = 0;
      for (const b of batch) {
        const mode = parseEditorialMode(b.requested_editorial_mode || b.editorial_mode) || "INFORMATIVE";
        const g = judgeSeedGrounding({
          concrete_subject: String(b.concrete_subject || ""),
          point_or_tension: b.point_or_tension ? String(b.point_or_tension) : undefined,
          editorial_mode: mode,
          cluster: b.cluster ? String(b.cluster) : undefined,
          creator_evidence_available: !!b.creator_evidence_available,
          experience_required: !!b.experience_required,
          primary_source: b.primary_source ? String(b.primary_source) : undefined,
          evidence_source_ids: Array.isArray(b.evidence_source_ids) ? b.evidence_source_ids.map(String) : undefined,
          relationship_evidence_ids: Array.isArray(b.relationship_evidence_ids)
            ? b.relationship_evidence_ids.map(String)
            : undefined,
          verified_locations: Array.isArray(b.verified_locations) ? b.verified_locations.map(String) : undefined,
          verified_entities: Array.isArray(b.verified_entities) ? b.verified_entities.map(String) : undefined,
        });
        if (!g.pass) {
          grounding_reject += 1;
          judged.push({
            ...b,
            status: "REJECTED",
            editorial_fit: "POOR",
            grounding_status: g.provenance.grounding_status,
            grounding_reasons: g.provenance.reasons,
            claim_types: g.provenance.claim_types,
            inference_type: g.provenance.inference_type,
            source_type: g.provenance.source_type,
          } as any);
          continue;
        }
        b.grounding_status = g.provenance.grounding_status;
        b.grounding_reasons = g.provenance.reasons;
        b.claim_types = g.provenance.claim_types;
        b.inference_type = g.provenance.inference_type;
        b.source_type = g.provenance.source_type;
        const q = evaluateEditorialSeedQuality(b, mode);
        if (!q.pass) {
          judged.push({ ...b, status: "HOLD", editorial_fit: "POOR" });
          continue;
        }
        judged.push({
          ...b,
          status: isSelectableStatus(b.status) ? b.status : "ELIGIBLE",
          editorial_fit: "ACCEPTABLE",
          requested_editorial_mode: mode,
        });
      }
      return json({
        success: true,
        phase: "judge",
        judged: consolidateSemanticGroups(judged),
        engine: WEEKLY_ENGINE_VERSION,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          grounding_reject,
          xai_api_used: false,
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
      });
    }

    if (phase === "select") {
      // Production: live xAI unless body.dry_run_generation === true (explicit test only)
      const selectGenOpts = {
        dry_run: body?.dry_run_generation === true,
        xai_key: xaiKey || null,
      };
      const seedsIn: ConcreteSeed[] = seedArrayFromBody(body) as ConcreteSeed[];
      const editorialRatio = body.editorial_ratio || undefined;
      const mix = allocateEditorialSlots(required_slots, editorialRatio);
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: acts } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, meta, x_post_id")
        .gte("published_at", since)
        .limit(500);
      const intent = analyzeCreatorIntent14d(acts || []);
      const interestMix = blendInterestMix(DEFAULT_INTEREST_MIX, intent);
      const recentExp = buildRecentExperienceCandidates(acts || []);
      const expNeed = Math.max(0, Number((mix.allocation as any)?.EXPERIENCE) || 0);
      const expResolved = resolveExperienceSupply(expNeed, recentExp, []);
      const recentManualSelect: RecentManualPost[] = (acts || [])
        .map((row: any) => ({
          text: String(row.text_body || "").trim(),
          source_id: row.x_post_id,
          published_at: row.published_at,
          post_type: String(row.post_type || row.action_type || ""),
        }))
        .filter((r: RecentManualPost) => r.text.length >= 12);
      let pool: ConcreteSeed[] = [];
      for (const s of seedsIn) {
        if (!s?.concrete_subject) continue;
        if (!isSelectableStatus(s.status as any)) continue;
        const role = ((s as any).source_role as SourceRole) || "SEED_SOURCE";
        if (!isSeedEligibleRole(role)) continue;
        const g = guardCandidateAgainstManualLeakage({
          source_role: role,
          concrete_subject: String(s.concrete_subject || ""),
          point_or_tension: s.point_or_tension ? String(s.point_or_tension) : undefined,
          recent_manual: recentManualSelect,
          user_explicit: role === "USER_EXPLICIT_SEED",
        });
        if (!g.allow_as_seed) continue;
        pool.push(s);
      }
      if (pool.length < seedsIn.length) {
        for (const s of seedsIn) {
          if (!s?.concrete_subject) continue;
          if (isSelectableStatus(s.status as any)) continue;
          if (s.status === "HOLD" || s.status === "REJECTED") continue;
          const role = ((s as any).source_role as SourceRole) || "SEED_SOURCE";
          if (!isSeedEligibleRole(role)) continue;
          const g = guardCandidateAgainstManualLeakage({
            source_role: role,
            concrete_subject: String(s.concrete_subject || ""),
            point_or_tension: s.point_or_tension ? String(s.point_or_tension) : undefined,
            recent_manual: recentManualSelect,
            user_explicit: role === "USER_EXPLICIT_SEED",
          });
          if (!g.allow_as_seed) continue;
          pool.push({ ...s, status: "ELIGIBLE" });
        }
      }
      const nextId = createSeedIdFactory("e");
      // ORDER 0B: only seed_eligible (user explicit); no auto-promote recent manuals
      for (const c of expResolved.selected) {
        if (!(c as any).seed_eligible) continue;
        const fields = experienceCandidateToSeedFields(c);
        const g = guardCandidateAgainstManualLeakage({
          source_role: "USER_EXPLICIT_SEED",
          concrete_subject: String(fields.concrete_subject || ""),
          point_or_tension: fields.point_or_tension ? String(fields.point_or_tension) : undefined,
          recent_manual: recentManualSelect,
          user_explicit: true,
        });
        if (!g.allow_as_seed) continue;
        pool.unshift({
          seed_id: nextId(),
          cluster: String(fields.cluster || "OTHER"),
          dimension: String(fields.dimension || "EXPERIENCE"),
          concrete_subject: String(fields.concrete_subject || ""),
          subject_signature: subjectSignature(String(fields.concrete_subject || "")),
          creator_evidence_available: true,
          status: "HIGH_VALUE",
          primary_source: String(fields.provenance || fields.primary_source || "USER_EXPLICIT_SEED"),
          point_or_tension: fields.point_or_tension as string | undefined,
          source_role: "USER_EXPLICIT_SEED",
        } as ConcreteSeed);
      }
      const usedModes: Record<string, number> = {};
      const selectedWeekly: ConcreteSeed[] = [];
      let interpretation_blocked = 0;
      let interpretation_weak = 0;
      let interpretation_ok = 0;
      let mechanism_ok = 0;
      let mechanism_weak = 0;
      let mechanism_none = 0;
      let mechanism_blocked = 0;
      let rail_ok = 0;
      let rail_adapted = 0;
      let rail_minimal = 0;
      let rail_none = 0;
      let rail_blocked = 0;
      let language_ok = 0;
      let language_translation = 0;
      let language_precision = 0;
      let language_other = 0;

      const queue = buildEditorialQueue(mix.allocation as any);
      const modeSupply = buildModeSupplyReport(pool, WEEKLY_EDITORIAL_MODES as any);
      const outDays: Array<{ dayOffset: number; posts: any[] }> = Array.from({ length: daysCount }, (_, i) => ({
        dayOffset: i,
        posts: [],
      }));
      for (const plannedMode of queue) {
        const mode = plannedMode as EditorialMode;
        const candidates = pool
          .map((s, i) => ({ s, i, div: conceptualDiversityScore(s, selectedWeekly) }))
          .filter(({ s }) => canServeEditorialMode(s, mode))
          .sort((a, b) => b.div - a.div);
        let picked: ConcreteSeed | null = null;
        for (const { s, i } of candidates) {
          if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH") continue;
          const guard = ideaAngleGuardAllow(s, selectedWeekly);
          if (!guard.allow) continue;
          picked = s;
          pool.splice(i, 1);
          break;
        }
        if (!picked) {
          for (const { s, i } of candidates) {
            const guard = ideaAngleGuardAllow(s, selectedWeekly, { softSecond: true });
            if (!guard.allow) continue;
            if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH") continue;
            picked = s;
            pool.splice(i, 1);
            break;
          }
        }
        if (!picked) continue;
        const interp = interpretConcreteSeed(picked, mode);
        if (isInterpretationBlocked(interp)) {
          interpretation_blocked++;
          continue;
        }
        if (interp.status === "INTERPRETATION_WEAK") interpretation_weak++;
        else interpretation_ok++;
        const mech = selectReactionMechanism({ interpretation: interp, editorial_mode: mode });
        if (isMechanismBlocked(mech)) {
          mechanism_blocked++;
          continue;
        }
        if (mech.status === "MECHANISM_OK") mechanism_ok++;
        else if (mech.status === "MECHANISM_WEAK") mechanism_weak++;
        else mechanism_none++;
        const rail = selectThinkingRail({
          interpretation: interp,
          mechanism: mech,
          editorial_mode: mode,
        });
        if (isRailBlocked(rail)) {
          rail_blocked++;
          continue;
        }
        if (rail.status === "RAIL_OK") rail_ok++;
        else if (rail.status === "RAIL_ADAPTED") rail_adapted++;
        else if (rail.status === "RAIL_MINIMAL" || rail.status === "RAIL_DERIVED") rail_minimal++;
        else if (rail.status === "RAIL_NONE") rail_none++;
        const lang = decideEverydayLanguage({
          interpretation: interp,
          editorial_mode: mode,
          thinking_rail: {
            compression_preference: rail.compression_preference,
            preserve_reader_entry: true,
            status: rail.status,
          },
        });
        if (lang.status === "LANGUAGE_OK" || lang.status === "NO_TRANSLATION_NEEDED" || lang.status === "LOW_BARRIER_READY") language_ok++;
        else if (lang.status === "TRANSLATION_NEEDED") language_translation++;
        else if (lang.status === "PRECISION_CONFLICT") language_precision++;
        else language_other++;
        selectedWeekly.push(picked);
        usedModes[mode] = (usedModes[mode] || 0) + 1;
        let bestDay = 0;
        let bestScore = 1e9;
        for (let d = 0; d < daysCount; d++) {
          if (outDays[d].posts.length >= postsPerDay) continue;
          const n = outDays[d].posts.filter(
            (p) => majorKey(p.cluster, p.concrete_subject) === majorKey(picked!.cluster, picked!.concrete_subject)
          ).length;
          const score = n * 10 + outDays[d].posts.length;
          if (score < bestScore) {
            bestScore = score;
            bestDay = d;
          }
        }
        if (outDays[bestDay].posts.length >= postsPerDay) {
          for (let d = 0; d < daysCount; d++) {
            if (outDays[d].posts.length < postsPerDay) {
              bestDay = d;
              break;
            }
          }
        }
        outDays[bestDay].posts.push(await compactSlot(picked, bestDay, outDays[bestDay].posts.length + 1, mode, interp, mech, rail, lang, selectGenOpts));
      }
      let flatCount = outDays.reduce((s, d) => s + d.posts.length, 0);
      let integrity_fills = 0;
      let xai_supplement_would_be_required = 0;
      const baseNeed = mix.base_required_slots;
      while (flatCount < baseNeed && pool.length > 0) {
        let minD = 0;
        for (let i = 1; i < outDays.length; i++) {
          if (outDays[i].posts.length < outDays[minD].posts.length) minD = i;
        }
        if (outDays[minD].posts.length >= postsPerDay) break;
        const underModes = WEEKLY_EDITORIAL_MODES.filter((m) => (usedModes[m] || 0) < (mix.allocation as any)[m]);
        const tryModes = underModes.length ? underModes : WEEKLY_EDITORIAL_MODES.filter((m) => m !== "EXPERIENCE");
        let filled = false;
        for (const m of tryModes) {
          const idx = pool.findIndex((s) => canServeEditorialMode(s, m) && isSelectableStatus(s.status as any));
          if (idx < 0) continue;
          const seed = pool.splice(idx, 1)[0];
          const guard = ideaAngleGuardAllow(seed, selectedWeekly, { softSecond: true });
          if (!guard.allow && selectedWeekly.length > 0) {
            pool.push(seed);
            continue;
          }
          const interpFill = interpretConcreteSeed(seed, m as EditorialMode);
          if (isInterpretationBlocked(interpFill)) {
            interpretation_blocked++;
            continue;
          }
          if (interpFill.status === "INTERPRETATION_WEAK") interpretation_weak++;
          else interpretation_ok++;
          const mechFill = selectReactionMechanism({ interpretation: interpFill, editorial_mode: m as string });
          if (isMechanismBlocked(mechFill)) {
            mechanism_blocked++;
            continue;
          }
          if (mechFill.status === "MECHANISM_OK") mechanism_ok++;
          else if (mechFill.status === "MECHANISM_WEAK") mechanism_weak++;
          else mechanism_none++;
          const railFill = selectThinkingRail({
            interpretation: interpFill,
            mechanism: mechFill,
            editorial_mode: m as string,
          });
          if (isRailBlocked(railFill)) {
            rail_blocked++;
            continue;
          }
          if (railFill.status === "RAIL_OK") rail_ok++;
          else if (railFill.status === "RAIL_ADAPTED") rail_adapted++;
          else if (railFill.status === "RAIL_MINIMAL" || railFill.status === "RAIL_DERIVED") rail_minimal++;
          else if (railFill.status === "RAIL_NONE") rail_none++;
          const langFill = decideEverydayLanguage({
            interpretation: interpFill,
            editorial_mode: m as string,
            thinking_rail: {
              compression_preference: railFill.compression_preference,
              preserve_reader_entry: true,
              status: railFill.status,
            },
          });
          if (langFill.status === "LANGUAGE_OK" || langFill.status === "NO_TRANSLATION_NEEDED" || langFill.status === "LOW_BARRIER_READY") language_ok++;
          else if (langFill.status === "TRANSLATION_NEEDED") language_translation++;
          else if (langFill.status === "PRECISION_CONFLICT") language_precision++;
          else language_other++;
          selectedWeekly.push(seed);
          outDays[minD].posts.push(await compactSlot(seed, minD, outDays[minD].posts.length + 1, m as EditorialMode, interpFill, mechFill, railFill, langFill, selectGenOpts));
          usedModes[m] = (usedModes[m] || 0) + 1;
          integrity_fills++;
          flatCount++;
          filled = true;
          break;
        }
        if (!filled) break;
      }
      flatCount = outDays.reduce((s, d) => s + d.posts.length, 0);
      if (flatCount < baseNeed) xai_supplement_would_be_required = baseNeed - flatCount;
      const mode_shortfall: Record<string, number> = {};
      for (const m of WEEKLY_EDITORIAL_MODES) {
        const target = Number((mix.allocation as any)[m] || 0);
        const used = Number(usedModes[m] || 0);
        if (used < target) mode_shortfall[m] = target - used;
      }
      const redistributed = redistributeDailyTopics(outDays, postsPerDay);
      for (let di = 0; di < redistributed.days.length; di++) {
        redistributed.days[di].posts.forEach((p: any, si: number) => {
          p.dayOffset = di;
          p.slotId = `D${di + 1}P${si + 1}`;
        });
      }
      // ORDER 7C completion gate + silent-drop pad
      let flatForGate = redistributed.days.flatMap((d) => d.posts || []);
      let gate0 = evaluateWeeklyCompletionGate(flatForGate, required_slots);
      if (gate0.silent_drop_detected) {
        for (const day of redistributed.days) {
          while (day.posts.length < postsPerDay) {
            const total = redistributed.days.reduce((s, dd) => s + dd.posts.length, 0);
            if (total >= required_slots) break;
            day.posts.push({
              slotId: `D${day.dayOffset + 1}P${day.posts.length + 1}`,
              dayOffset: day.dayOffset,
              primaryTopic: "BLOCKED_SLOT",
              editorial_mode: "OBSERVATION",
              final_text: "",
              generation_status: "BLOCKED",
              lifecycle_status: "BLOCKED",
              generation_attempts: 0,
              recovery_used: false,
              recovery_type: "blocked_explicit",
              seed_replaced: false,
              order7c_version: ORDER7C_VERSION,
              block_reasons: ["order7c_count_pad_blocked"],
            });
          }
        }
        for (let di = 0; di < redistributed.days.length; di++) {
          redistributed.days[di].posts.forEach((p, si) => {
            p.dayOffset = di;
            p.slotId = `D${di + 1}P${si + 1}`;
          });
        }
      }
      const completion_gate_final = evaluateWeeklyCompletionGate(
        redistributed.days.flatMap((d) => d.posts || []),
        required_slots,
      );
      const flatSlots8c = redistributed.days.flatMap((d) => d.posts || []);
      const order8c_gate = evaluateOrder8cCompletionGate({
        requested_slots: required_slots,
        planner_slots: mix.base_required_slots,
        slots: flatSlots8c as any[],
      });
      const order8c_summary = buildWeeklyPublicationSummary({
        requested_slots: required_slots,
        slots: flatSlots8c as any[],
      });
      const totalPlanned = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
      const count_shortfall = totalPlanned < baseNeed;
      const mode_supply_low =
        modeSupply.mode_supply_low ||
        count_shortfall ||
        xai_supplement_would_be_required > 0 ||
        Object.values(mode_shortfall).some((n) => n > 0);
      return json({
        success: true,
        phase: "select",
        days: redistributed.days,
        totalPlanned,
        mode_supply_low,
        topic_supply_low: pool.length === 0 && totalPlanned < required_slots,
        interest_mix: interestMix,
        creator_intent: intent,
        editorial_mix: {
          base_required_slots: mix.base_required_slots,
          final_slots_target: mix.final_slots,
          allocation: mix.allocation,
          used_modes: usedModes,
          weekly_humor: 0,
        },
        diagnostics: {
          required_slots,
          integrity_fills,
          mode_shortfall,
          xai_supplement_would_be_required,
          xai_api_used: false,
          soft_daily_cap: softDailyCap(postsPerDay),
          max_daily_topic: redistributed.max_daily_topic,
          consecutive_same_topic_pairs: redistributed.consecutive_same_topic_pairs,
          topic_distribution: topicDistributionReport(redistributed.days),
          experience: expResolved.report,
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          engine: WEEKLY_ENGINE_VERSION,
          input_seed_count: seedsIn.length,
          count_integrity: countIntegrityOk(mix.base_required_slots, totalPlanned),
          order0b_manual_leakage_separation: true,
          order0b_seed_eligible_only_for_experience: true,
          order1_seed_interpretation: true,
          order2_reader_mechanism: true,
          order3_thinking_rail: true,
          thinking_rail_version: ORDER3_VERSION,
          order5b_everyday_language: true,
          order5c_everyday_hardened: true,
          order6a_style_foundation: true,
          order6a_version: ORDER6A_VERSION,
          order6b_contextual_style_humor: true,
          order6b_style_version: ORDER6B_STYLE_VERSION,
          order6b_humor_version: ORDER6B_HUMOR_VERSION,
          order6c_style_humor_hardened: true,
          order6c_style_version: ORDER6C_STYLE_VERSION,
          order6c_humor_version: ORDER6C_HUMOR_VERSION,
          order7a_deep_generation: true,
          order7a_version: ORDER7A_VERSION,
          order7b_independent_generation: true,
          order7b_version: ORDER7B_VERSION,
          order7b_hotfix_live_xai: true,
          writer_production_default_live: true,
          order7c_generation_integration: true,
          order7c_version: ORDER7C_VERSION,
          order7c_completion_gate: true,
          order7c_silent_drop_forbidden: true,
          order8a_semantic_judge: true,
          order8a_version: ORDER8A_VERSION,
          order8a_judge_only: true,
          order8a_no_auto_regeneration: true,
          order8b_rejection_routing: true,
          order8b_version: ORDER8B_VERSION,
          order8c_version: ORDER8C_VERSION,
          order8c_count_integrity_pass: order8c_gate.pass,
          order8c_ledger: order8c_gate.ledger,
          order8c_summary: {
            requested_slots: order8c_summary.requested_slots,
            returned_slots: order8c_summary.returned_slots,
            publishable_slots: order8c_summary.publishable_slots,
            blocked_slots: order8c_summary.blocked_slots,
            judge_unavailable_slots: order8c_summary.judge_unavailable_slots,
            count_integrity_pass: order8c_summary.count_integrity_pass,
            weekly_quality_warnings: order8c_summary.weekly_quality_warnings,
          },
          completion_gate: completion_gate_final,
          order7c_requested_slots: required_slots,
          order7c_returned_slots: completion_gate_final.returned_slots,
          order7c_count_integrity_pass: completion_gate_final.count_integrity_pass,
          everyday_language_version: ORDER5B_VERSION,
          order5c_version: ORDER5C_VERSION,
          order5a_foundation_version: ORDER5A_VERSION,
          interpretation_ok,
          interpretation_weak,
          interpretation_blocked,
          mechanism_ok,
          mechanism_weak,
          mechanism_none,
          mechanism_blocked,
          rail_ok,
          rail_adapted,
          rail_minimal,
          rail_none,
          rail_blocked,
          language_ok,
          language_translation,
          language_precision,
          language_other,
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    return json(
      {
        success: false,
        error: "phase required: expand | judge | select",
        engine: WEEKLY_ENGINE_VERSION,
        days: [],
      },
      400
    );
  } catch (err: any) {
    console.error(err);
    return json({ success: false, error: String(err?.message || err).slice(0, 200), days: [] }, 500);
  }
});
