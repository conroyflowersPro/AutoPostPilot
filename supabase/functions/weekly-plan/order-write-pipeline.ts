/**
 * v11 write path: local ORDER 1–6 + 7A context → ORDER 7C/7B writer → ORDER 8A judge.
 * Paid xAI: writer only (plus expand, which lives in index expand phase).
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
import { judgeIndependentResult, isJudgeReject } from "./semantic-judge.ts";
import type { ConcreteSeed } from "./seed-engine.ts";
import type { EditorialMode } from "./editorial-mix.ts";
import {
  inferSlotVoice,
  voiceRegisterConstraintLine,
  type VoiceActivityRow,
  type VoiceRegister,
} from "./user-direct-voice-window.ts";

export const V11_WRITER_MODEL = "grok-4.6";
export const V11_WRITE_CONCURRENCY = 2;
export const V11_WRITER_TIMEOUT_MS = 16000;

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
    creator_evidence_available: !!seed.creator_evidence_available,
    experience_required: String(mode || "").toUpperCase() === "EXPERIENCE",
  });
}

export async function writeOneSlot(args: {
  seed: Record<string, unknown>;
  xaiKey: string | null;
  dryRun?: boolean;
  voiceRows?: VoiceActivityRow[];
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
  system_origin_class: "AP_PIPELINE";
}> {
  const seed = args.seed as ConcreteSeed & Record<string, unknown>;
  const mode = String(seed.editorial_mode || "INFORMATIVE").toUpperCase() as EditorialMode;
  const dayOffset = Number(seed.dayOffset ?? 0);
  const slot = Number(String(seed.slotId || "").replace(/^D\d+P/, "") || 1) || 1;
  const slotId = String(seed.slotId || `D${dayOffset + 1}P${slot}`);
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
    constraint_line: voiceRegisterConstraintLine(voice),
  };

  const seed_interpretation = interpretConcreteSeed(seed, mode);
  const reaction_mechanism = selectReactionMechanism({
    interpretation: seed_interpretation,
    editorial_mode: mode,
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
  });
  const creator_style = decideCreatorStyle({
    context: {
      everyday_language_status: everyday_language.status,
      everyday_minimal_context_sufficient: everyday_language.minimal_context_sufficient,
      everyday_precision_conflict: everyday_language.precision_conflict,
      rail_compression_preference: thinking_rail?.compression_preference || everyday_language.compression_preference,
      prefer_short: mode === "CASUAL_OBSERVATION",
      interpretation_status: seed_interpretation?.status || null,
      mechanism_status: (reaction_mechanism as any)?.status || null,
      mechanism_id: (reaction_mechanism as any)?.selected_mechanism_id || (reaction_mechanism as any)?.mechanism_id || null,
      rail_status: thinking_rail?.status || null,
      has_lived_reflection: !!seed.creator_evidence_available,
      has_experience_grounding: !!seed.creator_evidence_available || mode === "EXPERIENCE",
      has_factual_grounding: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts.length > 0 : true,
      editorial_mode: mode,
      topic_cluster: seed.cluster,
    },
  });
  const natural_humor = decideNaturalHumor({
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
      prefer_short: mode === "CASUAL_OBSERVATION",
      has_lived_experience_grounding: !!seed.creator_evidence_available,
      has_factual_grounding: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts.length > 0 : true,
    },
  });

  const deep = buildDeepGenerationContext({
    slot_id: slotId,
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
    voice_register: voicePayload,
  });

  const integrated: IntegratedSlotResult = await integrateSlotGeneration(deep, {
    dry_run: args.dryRun === true,
    xai_key: args.xaiKey,
    model: V11_WRITER_MODEL,
    timeout_ms: V11_WRITER_TIMEOUT_MS,
    seed_id: seed.seed_id,
    allow_one_retry: true,
  });

  let finalText = String(integrated.final_text || "").trim();
  let status = String(integrated.generation_status || "BLOCKED");
  const reasons = [...(integrated.block_reasons || [])];

  if (finalText && integrated.independent) {
    const judged = judgeIndependentResult(deep, integrated.independent);
    if (isJudgeReject(judged)) {
      status = "BLOCKED";
      reasons.push(...(judged.hard_fail_reasons || []).map(String));
      finalText = "";
    }
    return {
      slotId,
      primaryTopic: String(seed.concrete_subject || seed.primaryTopic || ""),
      concrete_subject: String(seed.concrete_subject || ""),
      editorial_mode: mode,
      final_text: finalText,
      generation_status: status,
      judge_status: judged.overall_status,
      block_reasons: reasons,
      writer_call_attempted: !!integrated.writer_call_attempted,
      system_origin_class: "AP_PIPELINE",
    };
  }

  return {
    slotId,
    primaryTopic: String(seed.concrete_subject || seed.primaryTopic || ""),
    concrete_subject: String(seed.concrete_subject || ""),
    editorial_mode: mode,
    final_text: finalText,
    generation_status: status,
    block_reasons: reasons,
    writer_call_attempted: !!integrated.writer_call_attempted,
    system_origin_class: "AP_PIPELINE",
  };
}

export async function writeSlotBatch(args: {
  slots: Record<string, unknown>[];
  xaiKey: string | null;
  dryRun?: boolean;
  voiceRows?: VoiceActivityRow[];
}): Promise<Awaited<ReturnType<typeof writeOneSlot>>[]> {
  const slots = Array.isArray(args.slots) ? args.slots : [];
  const out: Awaited<ReturnType<typeof writeOneSlot>>[] = [];
  for (let i = 0; i < slots.length; i += V11_WRITE_CONCURRENCY) {
    const chunk = slots.slice(i, i + V11_WRITE_CONCURRENCY);
    const part = await Promise.all(
      chunk.map((seed) =>
        writeOneSlot({
          seed,
          xaiKey: args.xaiKey,
          dryRun: args.dryRun,
          voiceRows: args.voiceRows,
        })
      )
    );
    out.push(...part);
  }
  return out;
}
