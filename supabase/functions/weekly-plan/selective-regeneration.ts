/**
 * ORDER 8B HOTFIX — Real Selective Upstream Recompute
 * Router decides reset_stage + freeze; this orchestrator runs real production stage fns.
 * Never: same DeepGenerationContext writer-only when reset requires upstream.
 * Never: previous failed final_text as few-shot.
 */
import { interpretSeed, type SeedInterpretation, type InterpretSeedInput } from "./seed-interpretation.ts";
import { selectReactionMechanism, type MechanismSelectionResult } from "./reader-self-projection.ts";
import { selectThinkingRail, type ThinkingRailDecision } from "./thinking-rail-runtime.ts";
import { decideEverydayLanguage, type EverydayLanguageDecision } from "./everyday-language-reasoning.ts";
import { decideCreatorStyle, type CreatorStyleDecision } from "./creator-style-decision.ts";
import { decideNaturalHumor, type NaturalHumorDecision } from "./natural-humor-decision.ts";
import { buildDeepGenerationContext, type DeepGenerationContext, type BuildDeepGenerationInput } from "./deep-generation-context.ts";
import { generateIndependentPost, type IndependentPostResult, type GenerateIndependentOptions } from "./independent-post-generation.ts";
import { judgeIndependentResult, type SemanticJudgeResult } from "./semantic-judge.ts";
import { type RegenerationDecision, type ResetStage, buildRegenConstraintHints, ORDER8B_VERSION } from "./regeneration-router.ts";

export const ORDER8B_HOTFIX_VERSION = "selective_upstream_recompute_v1_order8b_hotfix";
export const ORDER8B_HOTFIX_REAL_STAGE_RECOMPUTE = true as const;
export const ORDER8B_HOTFIX_NO_SAME_CONTEXT_WRITER_ONLY = true as const;
export const ORDER8B_HOTFIX_NO_PRIOR_DRAFT_FEWSHOT = true as const;

export const STAGE_DEPENDENCY_ORDER: ResetStage[] = [
  "seed", "interpretation", "self_projection", "mechanism", "rail", "everyday", "style", "humor", "writer", "none",
];

export type StageName =
  | "seed" | "interpretation" | "self_projection" | "mechanism" | "rail" | "everyday"
  | "style" | "humor" | "core_thought" | "context_build" | "writer" | "judge";

export type StageFnOverrides = {
  interpretSeed: typeof interpretSeed;
  selectReactionMechanism: typeof selectReactionMechanism;
  selectThinkingRail: typeof selectThinkingRail;
  decideEverydayLanguage: typeof decideEverydayLanguage;
  decideCreatorStyle: typeof decideCreatorStyle;
  decideNaturalHumor: typeof decideNaturalHumor;
  buildDeepGenerationContext: typeof buildDeepGenerationContext;
  generateIndependentPost: typeof generateIndependentPost;
  judgeIndependentResult: typeof judgeIndependentResult;
};

export type UpstreamSnapshot = {
  slot_id: string;
  context_id: string;
  seed: Record<string, unknown>;
  editorial_mode: string;
  interpretation: SeedInterpretation | null;
  reaction_mechanism: MechanismSelectionResult | null;
  thinking_rail: ThinkingRailDecision | null;
  everyday_language: EverydayLanguageDecision | null;
  creator_style: CreatorStyleDecision | null;
  natural_humor: NaturalHumorDecision | null;
  deep_context: DeepGenerationContext | null;
  _stageFns?: Partial<StageFnOverrides>;
};

export type SelectiveRegenDiagnostics = {
  reset_stage: ResetStage;
  route: string;
  stages_recomputed: StageName[];
  stages_frozen: StageName[];
  old_decision_ids: Record<string, string | null>;
  new_decision_ids: Record<string, string | null>;
  context_rebuilt: boolean;
  old_context_id: string;
  new_context_id: string;
  writer_called: boolean;
  rejudge_called: boolean;
  prior_final_text_leaked: false;
  order8b_hotfix_version: string;
  failure_hints_count: number;
};

export type SelectiveRegenResult = {
  independent: IndependentPostResult;
  judge: SemanticJudgeResult;
  diagnostics: SelectiveRegenDiagnostics;
  deep_context: DeepGenerationContext | null;
};

export function stagesFromEarliest(reset: ResetStage): StageName[] {
  if (reset === "none") return [];
  if (reset === "writer") return ["writer", "judge"];
  const map: Record<string, StageName[]> = {
    style: ["style", "humor", "core_thought", "context_build", "writer", "judge"],
    humor: ["humor", "core_thought", "context_build", "writer", "judge"],
    everyday: ["everyday", "style", "humor", "core_thought", "context_build", "writer", "judge"],
    rail: ["rail", "everyday", "style", "humor", "core_thought", "context_build", "writer", "judge"],
    mechanism: ["mechanism", "rail", "everyday", "style", "humor", "core_thought", "context_build", "writer", "judge"],
    self_projection: ["self_projection", "mechanism", "rail", "everyday", "style", "humor", "core_thought", "context_build", "writer", "judge"],
    interpretation: ["interpretation", "self_projection", "mechanism", "rail", "everyday", "style", "humor", "core_thought", "context_build", "writer", "judge"],
    seed: ["seed", "interpretation", "self_projection", "mechanism", "rail", "everyday", "style", "humor", "core_thought", "context_build", "writer", "judge"],
  };
  return map[reset] || ["writer", "judge"];
}

export function stagesFrozenFor(reset: ResetStage): StageName[] {
  const all: StageName[] = ["seed", "interpretation", "self_projection", "mechanism", "rail", "everyday", "style", "humor", "core_thought"];
  const re = new Set(stagesFromEarliest(reset));
  return all.filter((s) => !re.has(s));
}

function decisionId(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    if (o[k] != null && String(o[k]).length > 0) return String(o[k]).slice(0, 120);
  }
  return null;
}

function seedToInterpretInput(seed: Record<string, unknown>, mode: string): InterpretSeedInput {
  return {
    seed_id: String(seed.seed_id || ""),
    concrete_subject: String(seed.concrete_subject || ""),
    topic: String(seed.cluster || seed.topic || ""),
    cluster: String(seed.cluster || ""),
    dimension: seed.dimension != null ? String(seed.dimension) : undefined,
    subtopic: seed.subtopic != null ? String(seed.subtopic) : undefined,
    editorial_mode: mode,
    allowed_facts: Array.isArray(seed.allowed_facts) ? (seed.allowed_facts as string[]) : [],
    factual_anchors: Array.isArray(seed.factual_anchors) ? (seed.factual_anchors as string[]) : [],
    experience_facts: Array.isArray(seed.experience_facts) ? (seed.experience_facts as string[]) : [],
    source_role: seed.source_role != null ? String(seed.source_role) : undefined,
    source_type: String(seed.source_type || seed.primary_source || ""),
    source_id: Array.isArray(seed.evidence_source_ids) ? String((seed.evidence_source_ids as unknown[])[0] || "") : undefined,
    point_or_tension: seed.point_or_tension != null ? String(seed.point_or_tension) : undefined,
    verification_requirements: Array.isArray(seed.grounding_reasons)
      ? (seed.grounding_reasons as unknown[]).map(String)
      : [],
    creator_evidence_available: !!seed.creator_evidence_available,
    experience_required: String(mode || "").toUpperCase() === "EXPERIENCE",
  };
}

export function snapshotFromSlotParts(parts: {
  slot_id: string;
  context_id?: string;
  seed: Record<string, unknown>;
  editorial_mode: string;
  interpretation: SeedInterpretation | null;
  reaction_mechanism: MechanismSelectionResult | null;
  thinking_rail: ThinkingRailDecision | null;
  everyday_language: EverydayLanguageDecision | null;
  creator_style: CreatorStyleDecision | null;
  natural_humor: NaturalHumorDecision | null;
  deep_context: DeepGenerationContext | null;
}): UpstreamSnapshot {
  return {
    slot_id: parts.slot_id,
    context_id: parts.context_id || parts.deep_context?.context_id || parts.slot_id,
    seed: parts.seed,
    editorial_mode: parts.editorial_mode,
    interpretation: parts.interpretation,
    reaction_mechanism: parts.reaction_mechanism,
    thinking_rail: parts.thinking_rail,
    everyday_language: parts.everyday_language,
    creator_style: parts.creator_style,
    natural_humor: parts.natural_humor,
    deep_context: parts.deep_context,
  };
}

export async function executeSelectiveRegeneration(args: {
  snapshot: UpstreamSnapshot;
  decision: RegenerationDecision;
  genOpts?: GenerateIndependentOptions;
  weekly_context?: {
    other_post_structural_signatures?: Array<Record<string, unknown>>;
    recent_generated_signatures?: Array<Record<string, unknown>>;
  };
}): Promise<SelectiveRegenResult> {
  const { snapshot, decision, genOpts, weekly_context } = args;
  const reset = decision.reset_stage || "writer";
  const toRecompute = new Set(stagesFromEarliest(reset));
  const frozen = stagesFrozenFor(reset);
  const hints = buildRegenConstraintHints(decision);

  const fns: StageFnOverrides = {
    interpretSeed: snapshot._stageFns?.interpretSeed || interpretSeed,
    selectReactionMechanism: snapshot._stageFns?.selectReactionMechanism || selectReactionMechanism,
    selectThinkingRail: snapshot._stageFns?.selectThinkingRail || selectThinkingRail,
    decideEverydayLanguage: snapshot._stageFns?.decideEverydayLanguage || decideEverydayLanguage,
    decideCreatorStyle: snapshot._stageFns?.decideCreatorStyle || decideCreatorStyle,
    decideNaturalHumor: snapshot._stageFns?.decideNaturalHumor || decideNaturalHumor,
    buildDeepGenerationContext: snapshot._stageFns?.buildDeepGenerationContext || buildDeepGenerationContext,
    generateIndependentPost: snapshot._stageFns?.generateIndependentPost || generateIndependentPost,
    judgeIndependentResult: snapshot._stageFns?.judgeIndependentResult || judgeIndependentResult,
  };

  const stages_recomputed: StageName[] = [];
  const mode = snapshot.editorial_mode || "OBSERVATION";
  let interpretation = snapshot.interpretation;
  let mechanism = snapshot.reaction_mechanism;
  let rail = snapshot.thinking_rail;
  let everyday = snapshot.everyday_language;
  let style = snapshot.creator_style;
  let humor = snapshot.natural_humor;

  const old_decision_ids: Record<string, string | null> = {
    interpretation: decisionId(interpretation, ["interpretation_id", "seed_id"]),
    mechanism: decisionId(mechanism, ["selected_mechanism", "selected_mechanism_id", "mechanism_id"]),
    rail: decisionId(rail, ["selected_rail_id", "rail_id"]),
    everyday: decisionId(everyday, ["reader_entry_strategy", "status"]),
    style: decisionId(style, ["style_id", "selected_style", "status"]),
    humor: decisionId(humor, ["humor_mode", "status"]),
    context: snapshot.context_id || null,
  };

  if (toRecompute.has("interpretation") && !decision.freeze_interpretation) {
    interpretation = fns.interpretSeed(seedToInterpretInput(snapshot.seed, mode));
    stages_recomputed.push("interpretation");
  }

  if ((toRecompute.has("self_projection") || toRecompute.has("mechanism")) &&
      (!decision.freeze_mechanism || toRecompute.has("self_projection"))) {
    mechanism = fns.selectReactionMechanism({ interpretation: interpretation as any, editorial_mode: mode } as any);
    if (toRecompute.has("self_projection")) stages_recomputed.push("self_projection");
    stages_recomputed.push("mechanism");
  }

  if (toRecompute.has("rail") && !decision.freeze_rail) {
    rail = fns.selectThinkingRail({ interpretation: interpretation as any, mechanism: mechanism as any, editorial_mode: mode } as any);
    stages_recomputed.push("rail");
  }

  if (toRecompute.has("everyday") && !decision.freeze_everyday) {
    everyday = fns.decideEverydayLanguage({
      interpretation: interpretation as any,
      mechanism: mechanism as any,
      rail: rail as any,
      editorial_mode: mode,
    } as any);
    stages_recomputed.push("everyday");
  }

  if (toRecompute.has("style") && !decision.freeze_style) {
    style = fns.decideCreatorStyle({
      interpretation: interpretation as any,
      mechanism: mechanism as any,
      rail: rail as any,
      everyday_language: everyday as any,
      editorial_mode: mode,
    } as any);
    stages_recomputed.push("style");
  }

  if (toRecompute.has("humor") && !decision.freeze_humor) {
    humor = fns.decideNaturalHumor({
      interpretation: interpretation as any,
      mechanism: mechanism as any,
      style: style as any,
      force_none: !!decision.force_humor_none,
      editorial_mode: mode,
    } as any);
    stages_recomputed.push("humor");
  }

  const needContext = stages_recomputed.some((s) =>
    ["interpretation", "self_projection", "mechanism", "rail", "everyday", "style", "humor"].includes(s)
  );

  let deep = snapshot.deep_context;
  const old_context_id = deep?.context_id || snapshot.context_id || snapshot.slot_id;
  let context_rebuilt = false;

  if (needContext || !deep) {
    const buildInput: BuildDeepGenerationInput = {
      slot_id: snapshot.slot_id,
      day_offset: 0,
      slot_index: 0,
      seed: snapshot.seed as any,
      interpretation: interpretation as any,
      reaction_mechanism: mechanism as any,
      thinking_rail: rail as any,
      everyday_language: everyday as any,
      creator_style: style as any,
      natural_humor: humor as any,
      editorial_mode: mode as any,
      planner_intent: snapshot.deep_context?.planner_intent || null,
      week_structural_signatures: weekly_context?.other_post_structural_signatures || [],
    } as any;
    deep = fns.buildDeepGenerationContext(buildInput);
    stages_recomputed.push("core_thought", "context_build");
    context_rebuilt = true;
  } else if (deep && weekly_context?.other_post_structural_signatures) {
    deep.week_structural_signatures = weekly_context.other_post_structural_signatures;
  }

  // Constraint hints only — never prior final_text
  const independent = await fns.generateIndependentPost(deep as DeepGenerationContext, {
    dry_run: genOpts?.dry_run === true,
    xai_key: (genOpts as any)?.xai_key ?? null,
    allow_one_retry: false,
    retry_hint: hints.join(" ").slice(0, 220),
  } as any);
  stages_recomputed.push("writer");

  if (decision.rejection_codes?.length) {
    independent.block_reasons = [
      ...(independent.block_reasons || []),
      ...decision.rejection_codes.map((c: string) => "regen:" + c),
      ...hints.slice(0, 6).map((h) => "hint:" + h.slice(0, 80)),
    ];
  }

  const judge = fns.judgeIndependentResult(deep as DeepGenerationContext, independent, weekly_context, {
    xai_key: (genOpts as any)?.xai_key ?? null,
  } as any);
  stages_recomputed.push("judge");

  const new_decision_ids: Record<string, string | null> = {
    interpretation: decisionId(interpretation, ["interpretation_id", "seed_id"]),
    mechanism: decisionId(mechanism, ["selected_mechanism", "selected_mechanism_id", "mechanism_id"]),
    rail: decisionId(rail, ["selected_rail_id", "rail_id"]),
    everyday: decisionId(everyday, ["reader_entry_strategy", "status"]),
    style: decisionId(style, ["style_id", "selected_style", "status"]),
    humor: decisionId(humor, ["humor_mode", "status"]),
    context: deep?.context_id || null,
  };

  return {
    independent,
    judge,
    deep_context: deep,
    diagnostics: {
      reset_stage: reset,
      route: decision.route,
      stages_recomputed: [...new Set(stages_recomputed)],
      stages_frozen: frozen,
      old_decision_ids,
      new_decision_ids,
      context_rebuilt,
      old_context_id,
      new_context_id: deep?.context_id || old_context_id,
      writer_called: true,
      rejudge_called: true,
      prior_final_text_leaked: false,
      order8b_hotfix_version: ORDER8B_HOTFIX_VERSION,
      failure_hints_count: hints.length,
    },
  };
}

export const ORDER8B_HOTFIX_GUARDS = {
  version: ORDER8B_HOTFIX_VERSION,
  real_stage_recompute: ORDER8B_HOTFIX_REAL_STAGE_RECOMPUTE,
  no_same_context_writer_only: ORDER8B_HOTFIX_NO_SAME_CONTEXT_WRITER_ONLY,
  no_prior_draft_fewshot: ORDER8B_HOTFIX_NO_PRIOR_DRAFT_FEWSHOT,
  order8b_router_version: ORDER8B_VERSION,
} as const;
