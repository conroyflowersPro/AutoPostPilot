/**
 * v11 write path: Planner/Seeds → Interpretation(boundaries) → Grok 4.6 closes thought then writes → Semantic Judge.
 * Thought first, style follows — in execution, not only in documents.
 * Mechanism / Rail / 말투 / humor / compression do not run before the writer and do not pick the thought.
 * After the post exists they may be recorded as delivery telemetry. They do not rewrite.
 * Writer does not become Planner. Judge does not rewrite.
 * Paid xAI: quota, seed expand, and original post body. No OpenAI.
 */
import { interpretSeed, type SeedInterpretation } from "./seed-interpretation.ts";
import { selectReactionMechanism } from "./reader-self-projection.ts";
import { selectThinkingRail } from "./thinking-rail-runtime.ts";
import { decideEverydayLanguage } from "./everyday-language-reasoning.ts";
import { decideCreatorStyle } from "./creator-style-decision.ts";
import { decideNaturalHumor } from "./natural-humor-decision.ts";
import { buildDeepGenerationContext } from "./deep-generation-context.ts";
import {
  integrateSlotGeneration,
  type IntegratedSlotResult,
} from "./generation-integration.ts";
import { judgeIndependentResult, isJudgeReject, isJudgePass } from "./semantic-judge.ts";
import { extractStructuralSignature } from "./structural-signature.ts";
import { decideRegenerationRoute } from "./regeneration-router.ts";
import {
  executeSelectiveRegeneration,
  snapshotFromSlotParts,
} from "./selective-regeneration.ts";
import type { ConcreteSeed } from "./seed-engine.ts";
import type { EditorialMode } from "./editorial-mix.ts";
import type { AudienceBarrierSignals } from "./everyday-language-reasoning.ts";
import {
  inferSlotVoice,
  voiceRegisterConstraintLine,
  endingKind,
  type VoiceActivityRow,
  type VoiceRegister,
} from "./user-direct-voice-window.ts";

export const THOUGHT_FIRST_RUNTIME = true as const;
export const DELIVERY_AFTER_THOUGHT = true as const;

/** Seed quota + expand stay on Grok. Original post body is also Grok 4.6. */
export const V11_SEED_MODEL = "grok-4.6";
/** Original post body is Grok 4.6 (xAI). No OpenAI. */
export const V11_WRITER_MODEL = "grok-4.6";
export const V11_WRITE_CONCURRENCY = 2;
export const V11_WRITER_TIMEOUT_MS = 55000;

export function interpretConcreteSeed(seed: ConcreteSeed, mode?: EditorialMode): SeedInterpretation {
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
    verification_requirements: Array.isArray((seed as any).grounding_reasons)
      ? (seed as any).grounding_reasons
      : [],
    creator_evidence_available: !!seed.creator_evidence_available,
    experience_required: String(mode || "").toUpperCase() === "EXPERIENCE",
  });
}

/** Delivery telemetry after a thought exists as a post. Never fed back to pick the thought. */
function selectDeliveryAfterThought(args: {
  seed: ConcreteSeed & Record<string, unknown>;
  mode: EditorialMode;
  seed_interpretation: SeedInterpretation;
  recentMechanismUsage?: Array<{ mechanism_id?: string }>;
  audienceSignals?: AudienceBarrierSignals | null;
  recentStyleCounts?: Record<string, number> | null;
}) {
  const { seed, mode, seed_interpretation } = args;
  const reaction_mechanism = selectReactionMechanism({
    interpretation: seed_interpretation,
    editorial_mode: mode,
    recent_mechanism_usage: args.recentMechanismUsage || [],
  });
  const thinking_rail = selectThinkingRail({
    interpretation: seed_interpretation,
    mechanism: reaction_mechanism,
    editorial_mode: mode,
  });
  const everyday_language = decideEverydayLanguage({
    interpretation: seed_interpretation,
    editorial_mode: mode,
    thinking_rail: {
      compression_preference: thinking_rail.compression_preference,
      preserve_reader_entry: true,
      status: thinking_rail.status,
    },
    mechanism: {
      story_invitation_strength: String((reaction_mechanism as any)?.story_invitation_strength || ""),
      status: String((reaction_mechanism as any)?.status || ""),
    },
    creator_comm_pref: {
      prefers_broad_concrete_when_accurate: true,
      avoids_unnecessary_jargon: true,
      allows_attention_reentry: true,
    },
    audience_signals: args.audienceSignals || null,
  });
  const creator_style = decideCreatorStyle({
    context: {
      creator_dna: {
        prefers_compression: false,
        prefers_conversational: true,
        prefers_reflective: null,
        allows_technical_density: true,
        community_native_ok: true,
        longform_selective_ok: true,
        politeness_default: "mixed",
        identity_stable: true,
      },
      everyday_language_status: everyday_language.status,
      everyday_minimal_context_sufficient: everyday_language.minimal_context_sufficient,
      everyday_precision_conflict: everyday_language.precision_conflict,
      rail_compression_preference: thinking_rail?.compression_preference || everyday_language.compression_preference,
      prefer_short: false,
      interpretation_status: seed_interpretation?.status || null,
      mechanism_status: (reaction_mechanism as any)?.status || null,
      mechanism_id:
        (reaction_mechanism as any)?.selected_mechanism ||
        (reaction_mechanism as any)?.selected_mechanism_id ||
        (reaction_mechanism as any)?.mechanism_id ||
        null,
      story_invitation_strength: String((reaction_mechanism as any)?.story_invitation_strength || ""),
      self_projection_strength: String((reaction_mechanism as any)?.self_projection_strength || ""),
      rail_status: thinking_rail?.status || null,
      has_lived_reflection: !!seed.creator_evidence_available,
      has_experience_grounding: !!seed.creator_evidence_available || mode === "EXPERIENCE",
      has_factual_grounding: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts.length > 0 : true,
      editorial_mode: mode,
      topic_cluster: seed.cluster,
      recent_style_counts: args.recentStyleCounts || null,
    },
  });
  const natural_humor = decideNaturalHumor({
    context: {
      editorial_mode: mode,
      mechanism_status: (reaction_mechanism as any)?.status || null,
      mechanism_id: (reaction_mechanism as any)?.selected_mechanism || (reaction_mechanism as any)?.selected_mechanism_id || null,
      rail_status: thinking_rail?.status || null,
      everyday_language_status: everyday_language.status,
      everyday_minimal_context_sufficient: everyday_language.minimal_context_sufficient,
      style_punchline_compatible: creator_style.punchline_compatible,
      style_dialogue_compatible: creator_style.dialogue_compatible,
      style_conversational_level: creator_style.conversational_level,
      style_family: creator_style.style_family,
      prefer_short: false,
      has_lived_experience_grounding: !!seed.creator_evidence_available,
      has_factual_grounding: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts.length > 0 : true,
    },
  });
  const selectedMechanismId =
    String(
      (reaction_mechanism as any)?.selected_mechanism ||
        (reaction_mechanism as any)?.selected_mechanism_id ||
        "",
    ) || null;
  return {
    reaction_mechanism,
    thinking_rail,
    everyday_language,
    creator_style,
    natural_humor,
    selectedMechanismId,
  };
}

export async function writeOneSlot(args: {
  seed: Record<string, unknown>;
  xaiKey: string | null;
  dryRun?: boolean;
  voiceRows?: VoiceActivityRow[];
  recentMechanismUsage?: Array<{ mechanism_id?: string }>;
  audienceSignals?: AudienceBarrierSignals | null;
  recentStyleCounts?: Record<string, number> | null;
  recentEndingCounts?: Record<string, number> | null;
  lastEnding?: string | null;
  weekSignatures?: Array<Record<string, unknown>>;
  /** Weekly job ticks: one Grok writer call per slot. Judge reject does not start a second write. */
  skipSelectiveRegen?: boolean;
}): Promise<{
  slotId: string;
  primaryTopic: string;
  concrete_subject: string;
  editorial_mode: string;
  final_text: string;
  generation_status: string;
  judge_status?: string;
  block_reasons: string[];
  writer_call_attempted: boolean;
  mechanism_id?: string | null;
  style_family?: string | null;
  ending_kind?: string | null;
  system_origin_class: "AP_PIPELINE";
  semantic_regen_attempts: number;
  slot_final_state: string;
  regeneration_route_history: string[];
  structural_signature: Record<string, unknown> | null;
}> {
  const seed = args.seed as ConcreteSeed & Record<string, unknown>;
  const mode = String(seed.editorial_mode || "INFORMATIVE").toUpperCase() as EditorialMode;
  const dayOffset = Number(seed.dayOffset ?? 0);
  const slot = Number(String(seed.slotId || "").replace(/^D\d+P/, "") || 1) || 1;
  const slotId = String(seed.slotId || `D${dayOffset + 1}P${slot}`);

  // 1. Interpretation first: fact / experience boundaries. Does not close the thought.
  const seed_interpretation = interpretConcreteSeed(seed, mode);

  // Handmade stats are who this person is — not a locked 말투/ending before the thought exists.
  const voice: VoiceRegister = inferSlotVoice({
    rows: args.voiceRows || [],
    cluster: String(seed.cluster || seed.topic_cluster || ""),
    editorial_mode: mode,
  });
  const voicePayload = {
    n: voice.n,
    window_days: voice.window_days,
    median_chars: voice.median_chars,
    question_ending_allowed: voice.question_ending_allowed,
    constraint_line: [
      voiceRegisterConstraintLine(voice),
      args.lastEnding ? `Do not copy the previous post's ending (${args.lastEnding}).` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };

  const weekSignatures = Array.isArray(args.weekSignatures) ? args.weekSignatures : [];
  const weeklyContext = {
    other_post_structural_signatures: weekSignatures,
    recent_generated_signatures: weekSignatures,
  };

  // 2. Writer context is interpretation + seed + DNA identity only.
  // Delivery engines do not run yet and must not pick the thought.
  const deep = buildDeepGenerationContext({
    slot_id: slotId,
    day_offset: dayOffset,
    slot_index: slot,
    seed: seed as any,
    interpretation: seed_interpretation as any,
    editorial_mode: mode,
    planner_intent: {
      strategy_slot_id: String(seed.strategy_slot_id || ""),
      strategic_role: String(seed.strategic_role || ""),
      intent: String(seed.planner_intent || ""),
    },
    voice_register: voicePayload,
    week_structural_signatures: weekSignatures,
  });

  // 3. Grok closes one thought for this Seed, then writes it.
  const integrated: IntegratedSlotResult = await integrateSlotGeneration(deep, {
    dry_run: args.dryRun === true,
    xai_key: args.xaiKey,
    model: V11_WRITER_MODEL,
    timeout_ms: V11_WRITER_TIMEOUT_MS,
    seed_id: seed.seed_id,
    allow_one_retry: args.skipSelectiveRegen ? false : true,
  });

  let finalText = String(integrated.final_text || "").trim();
  let status = String(integrated.generation_status || "BLOCKED");
  const reasons = [...(integrated.block_reasons || [])];
  let judgeStatus: string | undefined;
  let regenAttempts = 0;
  const regenRoutes: string[] = [];
  let slotFinal = "BLOCKED";
  let signature: Record<string, unknown> | null = null;
  let writerAttempted = !!integrated.writer_call_attempted;

  // 4. Delivery after the thought exists. Telemetry only — does not rewrite the post.
  const delivery = selectDeliveryAfterThought({
    seed,
    mode,
    seed_interpretation,
    recentMechanismUsage: args.recentMechanismUsage,
    audienceSignals: args.audienceSignals,
    recentStyleCounts: args.recentStyleCounts,
  });
  const {
    reaction_mechanism,
    thinking_rail,
    everyday_language,
    creator_style,
    natural_humor,
    selectedMechanismId,
  } = delivery;

  const pack = (extra: Partial<Awaited<ReturnType<typeof writeOneSlot>>> = {}) => ({
    slotId,
    primaryTopic: String(seed.concrete_subject || seed.primaryTopic || ""),
    concrete_subject: String(seed.concrete_subject || ""),
    editorial_mode: mode,
    final_text: finalText,
    generation_status: status,
    judge_status: judgeStatus,
    block_reasons: reasons,
    writer_call_attempted: writerAttempted,
    mechanism_id: selectedMechanismId,
    style_family: String(creator_style.style_family || "") || null,
    ending_kind: finalText ? endingKind(finalText) : null,
    system_origin_class: "AP_PIPELINE" as const,
    semantic_regen_attempts: regenAttempts,
    slot_final_state: slotFinal,
    regeneration_route_history: regenRoutes,
    structural_signature: signature,
    ...extra,
  });

  if (finalText && integrated.independent) {
    let judged = judgeIndependentResult(deep, integrated.independent, weeklyContext);
    judgeStatus = judged.overall_status;
    signature = extractStructuralSignature(finalText) as unknown as Record<string, unknown>;

    if (isJudgeReject(judged)) {
      const decision = decideRegenerationRoute(judged, { semantic_regen_attempts: 0 });
      regenRoutes.push(decision.route);
      if (
        !args.skipSelectiveRegen &&
        decision.route !== "BLOCK" &&
        decision.route !== "NO_ACTION" &&
        decision.route !== "ACCEPT_WITH_CONCERNS"
      ) {
        const snapshot = snapshotFromSlotParts({
          slot_id: slotId,
          context_id: deep.context_id,
          seed: seed as Record<string, unknown>,
          editorial_mode: mode,
          interpretation: seed_interpretation,
          reaction_mechanism: reaction_mechanism as any,
          thinking_rail: thinking_rail as any,
          everyday_language: everyday_language as any,
          creator_style: creator_style as any,
          natural_humor: natural_humor as any,
          deep_context: deep,
        });
        const regen = await executeSelectiveRegeneration({
          snapshot,
          decision,
          weekly_context: weeklyContext,
          genOpts: {
            dry_run: args.dryRun === true,
            xai_key: args.xaiKey,
            model: V11_WRITER_MODEL,
            timeout_ms: V11_WRITER_TIMEOUT_MS,
            allow_one_retry: false,
          },
        });
        regenAttempts = 1;
        writerAttempted = writerAttempted || regen.diagnostics.writer_called;
        judged = regen.judge;
        judgeStatus = judged.overall_status;
        const regenText = String(regen.independent?.final_text || "").trim();
        if (regenText && isJudgePass(judged)) {
          finalText = regenText;
          status = "GENERATED";
          signature = extractStructuralSignature(finalText) as unknown as Record<string, unknown>;
          slotFinal = "REGENERATED_PASS";
          return pack();
        }
        reasons.push(...(judged.hard_fail_reasons || []).map(String));
        reasons.push("selective_regen_rejected");
        finalText = "";
        status = "BLOCKED";
        slotFinal = "BLOCKED";
        signature = null;
        return pack();
      }
      reasons.push(...(judged.hard_fail_reasons || []).map(String));
      finalText = "";
      status = "BLOCKED";
      slotFinal = "BLOCKED";
      signature = null;
      return pack();
    }

    slotFinal = judged.overall_status === "PASS_WITH_CONCERNS" ? "ACCEPTED_WITH_CONCERNS" : "ACCEPTED_PASS";
    return pack();
  }

  slotFinal = finalText ? "ACCEPTED_PASS" : "BLOCKED";
  if (finalText) signature = extractStructuralSignature(finalText) as unknown as Record<string, unknown>;
  return pack();
}

export async function writeSlotBatch(args: {
  slots: Record<string, unknown>[];
  xaiKey: string | null;
  dryRun?: boolean;
  voiceRows?: VoiceActivityRow[];
  audienceSignals?: AudienceBarrierSignals | null;
  weekSignatures?: Array<Record<string, unknown>>;
  skipSelectiveRegen?: boolean;
}): Promise<Awaited<ReturnType<typeof writeOneSlot>>[]> {
  const slots = Array.isArray(args.slots) ? args.slots : [];
  const out: Awaited<ReturnType<typeof writeOneSlot>>[] = [];
  const recent: Array<{ mechanism_id?: string }> = [];
  const styleCounts: Record<string, number> = {};
  const endingCounts: Record<string, number> = {};
  let lastEnding: string | null = null;
  const signatures: Array<Record<string, unknown>> = [...(args.weekSignatures || [])];
  for (const seed of slots) {
    const p = await writeOneSlot({
      seed,
      xaiKey: args.xaiKey,
      dryRun: args.dryRun,
      voiceRows: args.voiceRows,
      recentMechanismUsage: recent.slice(-12),
      audienceSignals: args.audienceSignals || null,
      recentStyleCounts: { ...styleCounts },
      recentEndingCounts: { ...endingCounts },
      lastEnding,
      weekSignatures: signatures,
      skipSelectiveRegen: args.skipSelectiveRegen,
    });
    if (p.mechanism_id) recent.push({ mechanism_id: p.mechanism_id });
    if (p.style_family) styleCounts[p.style_family] = (styleCounts[p.style_family] || 0) + 1;
    if (p.ending_kind) {
      endingCounts[p.ending_kind] = (endingCounts[p.ending_kind] || 0) + 1;
      lastEnding = p.ending_kind;
    }
    if (p.final_text && p.structural_signature) signatures.push(p.structural_signature);
    out.push(p);
  }
  return out;
}
