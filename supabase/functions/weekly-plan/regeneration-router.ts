/**
 * ORDER 8B — Rejection & Regeneration Routing
 * Judge evaluates; Router picks rollback stage; Writer regenerates.
 * Never: REJECT → rewrite final_text only without origin routing.
 * Never: previous failed draft as few-shot writing example.
 */
import type { DeepGenerationContext } from "./deep-generation-context.ts";
import type { IndependentPostResult } from "./independent-post-generation.ts";
import type { SemanticJudgeResult } from "./semantic-judge.ts";

export const ORDER8B_VERSION = "rejection_regeneration_routing_v1_order8b";
export const ORDER8B_MAX_SEMANTIC_REGEN_ATTEMPTS = 2 as const;
export const ORDER8B_JUDGE_RETRY_ON_UNAVAILABLE = 1 as const;
export const ORDER8B_SOFT_ACCEPT_MAX_CONCERNS = 1 as const;
export const ORDER8B_SOFT_REGEN_CREATOR_FIT_BELOW = 0.55 as const;
export const ORDER8B_NO_PREVIOUS_DRAFT_FEWSHOT = true as const;
export const ORDER8B_NO_AI_SELF_REINFORCEMENT = true as const;
export const ORDER8B_NO_SILENT_DROP = true as const;
export const ORDER8B_SLOT_IDENTITY_PRESERVED = true as const;
export const ORDER8B_RE_JUDGE_REQUIRED = true as const;
export const ORDER8B_NO_AUTO_ACCEPT_REGENERATED = true as const;
export const ORDER8B_UPSTREAM_FREEZE_WHEN_UNRELATED = true as const;
export const ORDER8B_INTENTIONAL_KR_HUMOR_PRESERVE = true as const;

export type RejectionCode =
  | "FABRICATED_EXPERIENCE"
  | "FABRICATED_FACT"
  | "SEED_DRIFT"
  | "CORE_THOUGHT_LOSS"
  | "MANUAL_LEAKAGE"
  | "EMPTY_OUTPUT"
  | "CREATOR_FIT_WEAK"
  | "MECHANISM_MISFIT"
  | "RAIL_MISFIT"
  | "SELF_PROJECTION_WEAK"
  | "AI_REPORT_VOICE"
  | "OVER_EXPLAINED"
  | "OVER_CONNECTED"
  | "COMPRESSION_MISS"
  | "STOP_CONDITION_MISS"
  | "HUMOR_FORCED"
  | "EVERYDAY_LANGUAGE_HARD"
  | "STRUCTURAL_REPETITION"
  | "CONCEPTUAL_REPETITION_HIGH"
  | "RELATIONAL_CONNOTATION"
  | "FORCED_CTA"
  | "FORCED_QUESTION"
  | "JUDGE_UNAVAILABLE"
  | "UNKNOWN";

export type RegenerationRoute =
  | "NO_ACTION"
  | "ACCEPT_WITH_CONCERNS"
  | "REWRITE_ONLY"
  | "STYLE_REGENERATE"
  | "HUMOR_REGENERATE"
  | "EVERYDAY_LANGUAGE_REGENERATE"
  | "THINKING_RAIL_REGENERATE"
  | "MECHANISM_REGENERATE"
  | "SELF_PROJECTION_REGENERATE"
  | "INTERPRETATION_REGENERATE"
  | "SEED_REJECT"
  | "BLOCK"
  | "JUDGE_RETRY";

export type ResetStage =
  | "none"
  | "writer"
  | "style"
  | "humor"
  | "everyday"
  | "rail"
  | "mechanism"
  | "self_projection"
  | "interpretation"
  | "seed";

export type RegenerationDecision = {
  route: RegenerationRoute;
  reset_stage: ResetStage;
  rejection_codes: RejectionCode[];
  soft_concern_codes: RejectionCode[];
  recompute_downstream: boolean;
  freeze_seed: boolean;
  freeze_interpretation: boolean;
  freeze_core_thought: boolean;
  freeze_mechanism: boolean;
  freeze_rail: boolean;
  freeze_everyday: boolean;
  freeze_style: boolean;
  freeze_humor: boolean;
  strengthen_experience_boundary: boolean;
  strengthen_factual_boundary: boolean;
  strengthen_compression: boolean;
  strengthen_stop_condition: boolean;
  strengthen_inference_open: boolean;
  force_humor_none: boolean;
  include_previous_final_text: false;
  include_failure_reasons_only: true;
  reason_summary: string;
  order8b_version: string;
};

export type AttemptRecord = {
  attempt_number: number;
  generation_status: string;
  judge_status: string;
  route_taken: RegenerationRoute;
  rejection_codes: RejectionCode[];
  soft_concern_codes: RejectionCode[];
  accepted: boolean;
  final_text_length: number;
};

export type RoutedSlotResult = {
  slot_id: string;
  context_id: string;
  final_text: string;
  generation_status: string;
  judge_status: string;
  slot_final_state:
    | "ACCEPTED_PASS"
    | "ACCEPTED_WITH_CONCERNS"
    | "REGENERATED_PASS"
    | "BLOCKED"
    | "JUDGE_UNAVAILABLE"
    | "PENDING";
  semantic_regen_attempts: number;
  last_route: RegenerationRoute;
  accepted_attempt: number | null;
  initial_judge_status: string;
  final_judge_status: string;
  hard_fail_codes: RejectionCode[];
  soft_concern_codes: RejectionCode[];
  judge_unavailable_count: number;
  regeneration_exhausted: boolean;
  decision: RegenerationDecision;
  attempt_history: AttemptRecord[];
  order8b_version: string;
  independent: IndependentPostResult | null;
  judge: SemanticJudgeResult | null;
};

export const ORDER8B_GUARDS = {
  version: ORDER8B_VERSION,
  max_semantic_regen_attempts: ORDER8B_MAX_SEMANTIC_REGEN_ATTEMPTS,
  no_previous_draft_fewshot: ORDER8B_NO_PREVIOUS_DRAFT_FEWSHOT,
  no_ai_self_reinforcement: ORDER8B_NO_AI_SELF_REINFORCEMENT,
  no_silent_drop: ORDER8B_NO_SILENT_DROP,
  slot_identity_preserved: ORDER8B_SLOT_IDENTITY_PRESERVED,
  re_judge_required: ORDER8B_RE_JUDGE_REQUIRED,
  no_auto_accept_regenerated: ORDER8B_NO_AUTO_ACCEPT_REGENERATED,
  upstream_freeze_when_unrelated: ORDER8B_UPSTREAM_FREEZE_WHEN_UNRELATED,
  intentional_kr_humor_preserve: ORDER8B_INTENTIONAL_KR_HUMOR_PRESERVE,
} as const;

function mapHardReason(r: string): RejectionCode {
  const s = r.toLowerCase();
  if (s.includes("experience") || s.includes("fabricated_experience")) return "FABRICATED_EXPERIENCE";
  if (s.includes("factual") || s.includes("fabricated_fact")) return "FABRICATED_FACT";
  if (s.includes("seed")) return "SEED_DRIFT";
  if (s.includes("core_thought")) return "CORE_THOUGHT_LOSS";
  if (s.includes("manual")) return "MANUAL_LEAKAGE";
  if (s.includes("empty")) return "EMPTY_OUTPUT";
  if (s.includes("structural")) return "STRUCTURAL_REPETITION";
  return "UNKNOWN";
}

function mapSoftReason(r: string): RejectionCode {
  const s = r.toLowerCase();
  if (s.includes("creator_fit")) return "CREATOR_FIT_WEAK";
  if (s.includes("ai_report") || s.includes("ai_report_voice")) return "AI_REPORT_VOICE";
  if (s.includes("over_explained") || s.includes("redundant_emotion")) return "OVER_EXPLAINED";
  if (s.includes("over_connected")) return "OVER_CONNECTED";
  if (s.includes("forced_cta")) return "FORCED_CTA";
  if (s.includes("forced_question")) return "FORCED_QUESTION";
  if (s.includes("humor")) return "HUMOR_FORCED";
  if (s.includes("everyday") || s.includes("academic")) return "EVERYDAY_LANGUAGE_HARD";
  if (s.includes("structural")) return "STRUCTURAL_REPETITION";
  if (s.includes("conceptual") || s.includes("novelty")) return "CONCEPTUAL_REPETITION_HIGH";
  if (s.includes("relational")) return "RELATIONAL_CONNOTATION";
  if (s.includes("compression")) return "COMPRESSION_MISS";
  if (s.includes("stop_condition") || s.includes("grand_thesis")) return "STOP_CONDITION_MISS";
  if (s.includes("mechanism") || s.includes("rail_named")) return "MECHANISM_MISFIT";
  if (s.includes("self_projection") || s.includes("reader")) return "SELF_PROJECTION_WEAK";
  return "UNKNOWN";
}

function codesFromJudge(j: SemanticJudgeResult): { hard: RejectionCode[]; soft: RejectionCode[] } {
  const hard = (j.hard_fail_reasons || []).map(mapHardReason);
  const soft = (j.soft_concerns || []).map(mapSoftReason);
  if (j.flags?.fabricated_experience && !hard.includes("FABRICATED_EXPERIENCE")) hard.push("FABRICATED_EXPERIENCE");
  if (j.flags?.fabricated_fact && !hard.includes("FABRICATED_FACT")) hard.push("FABRICATED_FACT");
  if (j.flags?.manual_text_leakage && !hard.includes("MANUAL_LEAKAGE")) hard.push("MANUAL_LEAKAGE");
  if (j.flags?.ai_report_voice && !soft.includes("AI_REPORT_VOICE")) soft.push("AI_REPORT_VOICE");
  if (j.flags?.over_explained && !soft.includes("OVER_EXPLAINED")) soft.push("OVER_EXPLAINED");
  if (j.flags?.over_connected && !soft.includes("OVER_CONNECTED")) soft.push("OVER_CONNECTED");
  if (j.flags?.forced_cta && !soft.includes("FORCED_CTA")) soft.push("FORCED_CTA");
  if (j.flags?.forced_question && !soft.includes("FORCED_QUESTION")) soft.push("FORCED_QUESTION");
  if (j.flags?.conceptual_repetition === "HIGH" && !soft.includes("CONCEPTUAL_REPETITION_HIGH")) soft.push("CONCEPTUAL_REPETITION_HIGH");
  if (j.flags?.template_like && !soft.includes("STRUCTURAL_REPETITION")) soft.push("STRUCTURAL_REPETITION");
  if ((j.scores?.mechanism_fit ?? 1) < 0.4 && !soft.includes("MECHANISM_MISFIT")) soft.push("MECHANISM_MISFIT");
  if ((j.scores?.rail_fit ?? 1) < 0.4 && !soft.includes("RAIL_MISFIT")) soft.push("RAIL_MISFIT");
  if ((j.scores?.reader_self_projection ?? 1) < 0.45 && !soft.includes("SELF_PROJECTION_WEAK")) soft.push("SELF_PROJECTION_WEAK");
  if ((j.scores?.creator_fit ?? 1) < ORDER8B_SOFT_REGEN_CREATOR_FIT_BELOW && !soft.includes("CREATOR_FIT_WEAK")) soft.push("CREATOR_FIT_WEAK");
  return { hard: [...new Set(hard)], soft: [...new Set(soft)] };
}

function baseDecision(
  route: RegenerationRoute,
  reset: ResetStage,
  hard: RejectionCode[],
  soft: RejectionCode[],
  summary: string,
): RegenerationDecision {
  const d: RegenerationDecision = {
    route,
    reset_stage: reset,
    rejection_codes: hard,
    soft_concern_codes: soft,
    recompute_downstream: reset !== "none" && reset !== "writer",
    freeze_seed: true,
    freeze_interpretation: true,
    freeze_core_thought: true,
    freeze_mechanism: true,
    freeze_rail: true,
    freeze_everyday: true,
    freeze_style: true,
    freeze_humor: true,
    strengthen_experience_boundary: hard.includes("FABRICATED_EXPERIENCE"),
    strengthen_factual_boundary: hard.includes("FABRICATED_FACT"),
    strengthen_compression: soft.includes("OVER_EXPLAINED") || soft.includes("COMPRESSION_MISS"),
    strengthen_stop_condition: soft.includes("STOP_CONDITION_MISS") || soft.includes("AI_REPORT_VOICE"),
    strengthen_inference_open: soft.includes("OVER_EXPLAINED") || soft.includes("OVER_CONNECTED"),
    force_humor_none: soft.includes("HUMOR_FORCED"),
    include_previous_final_text: false,
    include_failure_reasons_only: true,
    reason_summary: summary.slice(0, 200),
    order8b_version: ORDER8B_VERSION,
  };
  if (reset === "style") {
    d.freeze_style = false;
    d.freeze_humor = false;
  } else if (reset === "humor") {
    d.freeze_humor = false;
  } else if (reset === "everyday") {
    d.freeze_everyday = false;
    d.freeze_style = false;
    d.freeze_humor = false;
  } else if (reset === "rail") {
    d.freeze_rail = false;
    d.freeze_everyday = false;
    d.freeze_style = false;
    d.freeze_humor = false;
  } else if (reset === "mechanism") {
    d.freeze_mechanism = false;
    d.freeze_rail = false;
    d.freeze_everyday = false;
    d.freeze_style = false;
    d.freeze_humor = false;
  } else if (reset === "self_projection") {
    d.freeze_mechanism = false;
    d.freeze_rail = false;
    d.freeze_everyday = false;
    d.freeze_style = false;
    d.freeze_humor = false;
  } else if (reset === "interpretation") {
    d.freeze_interpretation = false;
    d.freeze_core_thought = false;
    d.freeze_mechanism = false;
    d.freeze_rail = false;
    d.freeze_everyday = false;
    d.freeze_style = false;
    d.freeze_humor = false;
  } else if (reset === "seed") {
    d.freeze_seed = false;
    d.freeze_interpretation = false;
    d.freeze_core_thought = false;
    d.freeze_mechanism = false;
    d.freeze_rail = false;
    d.freeze_everyday = false;
    d.freeze_style = false;
    d.freeze_humor = false;
  }
  return d;
}

export function decideRegenerationRoute(
  judge: SemanticJudgeResult | null | undefined,
  opts: { semantic_regen_attempts?: number; judge_unavailable_count?: number } = {},
): RegenerationDecision {
  const attempts = opts.semantic_regen_attempts ?? 0;
  const juCount = opts.judge_unavailable_count ?? 0;

  if (!judge) {
    return baseDecision("JUDGE_RETRY", "none", ["JUDGE_UNAVAILABLE"], [], "missing_judge");
  }
  if (judge.overall_status === "JUDGE_UNAVAILABLE") {
    if (juCount < ORDER8B_JUDGE_RETRY_ON_UNAVAILABLE) {
      return baseDecision("JUDGE_RETRY", "none", ["JUDGE_UNAVAILABLE"], [], "judge_unavailable_retry");
    }
    return baseDecision("BLOCK", "none", ["JUDGE_UNAVAILABLE"], [], "judge_unavailable_exhausted");
  }
  if (attempts >= ORDER8B_MAX_SEMANTIC_REGEN_ATTEMPTS && judge.overall_status === "REJECT") {
    const { hard, soft } = codesFromJudge(judge);
    return baseDecision("BLOCK", "none", hard, soft, "regen_exhausted");
  }
  if (judge.overall_status === "PASS") {
    return baseDecision("NO_ACTION", "none", [], [], "pass");
  }

  const { hard, soft } = codesFromJudge(judge);

  if (hard.includes("MANUAL_LEAKAGE") || hard.includes("EMPTY_OUTPUT")) {
    return baseDecision("REWRITE_ONLY", "writer", hard, soft, "hard_writer_surface");
  }
  if (hard.includes("FABRICATED_EXPERIENCE") || hard.includes("FABRICATED_FACT")) {
    if (hard.includes("CORE_THOUGHT_LOSS") || hard.includes("SEED_DRIFT")) {
      return baseDecision("INTERPRETATION_REGENERATE", "interpretation", hard, soft, "hard_fact_with_core_seed");
    }
    return baseDecision("REWRITE_ONLY", "writer", hard, soft, "hard_boundary_writer");
  }
  if (hard.includes("SEED_DRIFT")) {
    return baseDecision("INTERPRETATION_REGENERATE", "interpretation", hard, soft, "seed_drift");
  }
  if (hard.includes("CORE_THOUGHT_LOSS")) {
    if ((judge.scores?.seed_fidelity ?? 1) < 0.4) {
      return baseDecision("INTERPRETATION_REGENERATE", "interpretation", hard, soft, "core_loss_seed_weak");
    }
    return baseDecision("REWRITE_ONLY", "writer", hard, soft, "core_loss_writer");
  }
  if (hard.includes("STRUCTURAL_REPETITION")) {
    return baseDecision("REWRITE_ONLY", "writer", hard, soft, "structural_week_repeat");
  }
  if (hard.length > 0) {
    return baseDecision("REWRITE_ONLY", "writer", hard, soft, "hard_generic_writer");
  }

  if (judge.overall_status === "PASS_WITH_CONCERNS") {
    const severe =
      soft.length > ORDER8B_SOFT_ACCEPT_MAX_CONCERNS ||
      soft.includes("CONCEPTUAL_REPETITION_HIGH") ||
      soft.includes("MECHANISM_MISFIT") ||
      soft.includes("RAIL_MISFIT") ||
      soft.includes("SELF_PROJECTION_WEAK") ||
      (judge.scores?.creator_fit ?? 1) < ORDER8B_SOFT_REGEN_CREATOR_FIT_BELOW;

    if (!severe) {
      return baseDecision("ACCEPT_WITH_CONCERNS", "none", hard, soft, "mild_concerns_accept");
    }
    if (soft.includes("CONCEPTUAL_REPETITION_HIGH")) {
      return baseDecision("INTERPRETATION_REGENERATE", "interpretation", hard, soft, "conceptual_high");
    }
    if (soft.includes("MECHANISM_MISFIT")) {
      return baseDecision("MECHANISM_REGENERATE", "mechanism", hard, soft, "mechanism_misfit");
    }
    if (soft.includes("RAIL_MISFIT")) {
      return baseDecision("THINKING_RAIL_REGENERATE", "rail", hard, soft, "rail_misfit");
    }
    if (soft.includes("SELF_PROJECTION_WEAK")) {
      return baseDecision("SELF_PROJECTION_REGENERATE", "self_projection", hard, soft, "self_projection_weak");
    }
    if (soft.includes("EVERYDAY_LANGUAGE_HARD")) {
      return baseDecision("EVERYDAY_LANGUAGE_REGENERATE", "everyday", hard, soft, "everyday_hard");
    }
    if (soft.includes("HUMOR_FORCED")) {
      return baseDecision("HUMOR_REGENERATE", "humor", hard, soft, "humor_forced");
    }
    if (
      soft.includes("CREATOR_FIT_WEAK") ||
      soft.includes("AI_REPORT_VOICE") ||
      soft.includes("STRUCTURAL_REPETITION") ||
      soft.includes("RELATIONAL_CONNOTATION")
    ) {
      return baseDecision("STYLE_REGENERATE", "style", hard, soft, "style_or_surface");
    }
    if (
      soft.includes("OVER_EXPLAINED") ||
      soft.includes("OVER_CONNECTED") ||
      soft.includes("COMPRESSION_MISS") ||
      soft.includes("STOP_CONDITION_MISS") ||
      soft.includes("FORCED_CTA") ||
      soft.includes("FORCED_QUESTION")
    ) {
      return baseDecision("REWRITE_ONLY", "writer", hard, soft, "writer_constraints");
    }
    return baseDecision("REWRITE_ONLY", "writer", hard, soft, "soft_generic_writer");
  }

  if (judge.overall_status === "REJECT") {
    return baseDecision("REWRITE_ONLY", "writer", hard.length ? hard : ["UNKNOWN"], soft, "reject_fallback_writer");
  }
  return baseDecision("NO_ACTION", "none", hard, soft, "default_no_action");
}

export function buildRegenConstraintHints(decision: RegenerationDecision): string[] {
  const hints: string[] = [];
  if (decision.strengthen_experience_boundary) {
    hints.push("Previous attempt violated experience boundary. Do not invent first-person lived experience.");
  }
  if (decision.strengthen_factual_boundary) {
    hints.push("Previous attempt introduced unsupported factual claims. Stay inside evidence boundary.");
  }
  if (decision.strengthen_compression) {
    hints.push("Previous attempt was over-long or over-explained. Prefer tighter compression.");
  }
  if (decision.strengthen_stop_condition) {
    hints.push("Previous attempt added thesis/summary tail. Stop when meaning is delivered.");
  }
  if (decision.strengthen_inference_open) {
    hints.push("Leave reader inference space; avoid over-connecting every sentence.");
  }
  if (decision.force_humor_none) {
    hints.push("Humor must be NONE — no forced ㅋㅋ or punchline.");
  }
  if (
    decision.rejection_codes.includes("STRUCTURAL_REPETITION") ||
    decision.soft_concern_codes.includes("STRUCTURAL_REPETITION")
  ) {
    hints.push(
      "Previous draft repeated this week's hook/unfold/ending. Change discourse shape. Do not use 관찰→반전→재해석 if already used. Do not copy prior wording.",
    );
  }
  for (const c of decision.rejection_codes) hints.push("Rejection code: " + c);
  for (const c of decision.soft_concern_codes.slice(0, 4)) hints.push("Concern code: " + c);
  return hints;
}

export function shouldAcceptJudge(j: SemanticJudgeResult): boolean {
  if (j.overall_status === "PASS") return true;
  if (j.overall_status === "PASS_WITH_CONCERNS") {
    const d = decideRegenerationRoute(j, { semantic_regen_attempts: 0 });
    return d.route === "ACCEPT_WITH_CONCERNS" || d.route === "NO_ACTION";
  }
  return false;
}

export async function routeSlotWithRegeneration(args: {
  slot_id: string;
  context_id: string;
  ctx: DeepGenerationContext | null;
  initial_independent: IndependentPostResult;
  initial_judge: SemanticJudgeResult;
  executeRegen?: (decision: RegenerationDecision, attempt: number) => Promise<{
    independent: IndependentPostResult;
    judge: SemanticJudgeResult;
  }>;
}): Promise<RoutedSlotResult> {
  const history: AttemptRecord[] = [];
  let attempts = 0;
  let juCount = 0;
  let lastRoute: RegenerationRoute = "NO_ACTION";
  let independent = args.initial_independent;
  let judge = args.initial_judge;
  const initialStatus = judge.overall_status;

  const pushHist = (route: RegenerationRoute, accepted: boolean) => {
    history.push({
      attempt_number: attempts,
      generation_status: independent.generation_status,
      judge_status: judge.overall_status,
      route_taken: route,
      rejection_codes: codesFromJudge(judge).hard,
      soft_concern_codes: codesFromJudge(judge).soft,
      accepted,
      final_text_length: (independent.final_text || "").length,
    });
  };

  if (shouldAcceptJudge(judge)) {
    pushHist("NO_ACTION", true);
    const mild = judge.overall_status === "PASS_WITH_CONCERNS";
    return packageRouted({
      slot_id: args.slot_id,
      context_id: args.context_id,
      independent,
      judge,
      attempts: 0,
      lastRoute: mild ? "ACCEPT_WITH_CONCERNS" : "NO_ACTION",
      accepted_attempt: 0,
      initialStatus,
      juCount: 0,
      exhausted: false,
      history,
      decision: decideRegenerationRoute(judge, {}),
      finalState: mild ? "ACCEPTED_WITH_CONCERNS" : "ACCEPTED_PASS",
    });
  }

  while (attempts < ORDER8B_MAX_SEMANTIC_REGEN_ATTEMPTS) {
    const decision = decideRegenerationRoute(judge, {
      semantic_regen_attempts: attempts,
      judge_unavailable_count: juCount,
    });
    lastRoute = decision.route;

    if (decision.route === "NO_ACTION" || decision.route === "ACCEPT_WITH_CONCERNS") {
      pushHist(decision.route, true);
      return packageRouted({
        slot_id: args.slot_id,
        context_id: args.context_id,
        independent,
        judge,
        attempts,
        lastRoute,
        accepted_attempt: attempts,
        initialStatus,
        juCount,
        exhausted: false,
        history,
        decision,
        finalState: decision.route === "ACCEPT_WITH_CONCERNS" ? "ACCEPTED_WITH_CONCERNS" : "ACCEPTED_PASS",
      });
    }

    if (decision.route === "BLOCK" || decision.route === "SEED_REJECT") {
      pushHist(decision.route, false);
      return packageRouted({
        slot_id: args.slot_id,
        context_id: args.context_id,
        independent: { ...independent, final_text: "", generation_status: "GENERATION_BLOCKED" as any },
        judge,
        attempts,
        lastRoute,
        accepted_attempt: null,
        initialStatus,
        juCount,
        exhausted: true,
        history,
        decision,
        finalState: "BLOCKED",
      });
    }

    if (decision.route === "JUDGE_RETRY") {
      juCount += 1;
      if (!args.executeRegen) {
        pushHist("JUDGE_RETRY", false);
        return packageRouted({
          slot_id: args.slot_id,
          context_id: args.context_id,
          independent,
          judge,
          attempts,
          lastRoute: "JUDGE_RETRY",
          accepted_attempt: null,
          initialStatus,
          juCount,
          exhausted: false,
          history,
          decision,
          finalState: "JUDGE_UNAVAILABLE",
        });
      }
    }

    if (!args.executeRegen) {
      pushHist(decision.route, false);
      return packageRouted({
        slot_id: args.slot_id,
        context_id: args.context_id,
        independent,
        judge,
        attempts,
        lastRoute,
        accepted_attempt: null,
        initialStatus,
        juCount,
        exhausted: false,
        history,
        decision,
        finalState: "PENDING",
      });
    }

    attempts += 1;
    const next = await args.executeRegen(decision, attempts);
    independent = next.independent;
    judge = next.judge;
    if (judge.overall_status === "JUDGE_UNAVAILABLE") juCount += 1;

    if (shouldAcceptJudge(judge)) {
      pushHist(decision.route, true);
      return packageRouted({
        slot_id: args.slot_id,
        context_id: args.context_id,
        independent,
        judge,
        attempts,
        lastRoute: decision.route,
        accepted_attempt: attempts,
        initialStatus,
        juCount,
        exhausted: false,
        history,
        decision,
        finalState: "REGENERATED_PASS",
      });
    }
    pushHist(decision.route, false);
  }

  const finalDecision = decideRegenerationRoute(judge, {
    semantic_regen_attempts: attempts,
    judge_unavailable_count: juCount,
  });
  return packageRouted({
    slot_id: args.slot_id,
    context_id: args.context_id,
    independent: { ...independent, final_text: "", generation_status: "GENERATION_BLOCKED" as any },
    judge,
    attempts,
    lastRoute: finalDecision.route === "BLOCK" ? "BLOCK" : lastRoute,
    accepted_attempt: null,
    initialStatus,
    juCount,
    exhausted: true,
    history,
    decision: { ...finalDecision, route: "BLOCK" },
    finalState: judge.overall_status === "JUDGE_UNAVAILABLE" ? "JUDGE_UNAVAILABLE" : "BLOCKED",
  });
}

function packageRouted(p: {
  slot_id: string;
  context_id: string;
  independent: IndependentPostResult;
  judge: SemanticJudgeResult;
  attempts: number;
  lastRoute: RegenerationRoute;
  accepted_attempt: number | null;
  initialStatus: string;
  juCount: number;
  exhausted: boolean;
  history: AttemptRecord[];
  decision: RegenerationDecision;
  finalState: RoutedSlotResult["slot_final_state"];
}): RoutedSlotResult {
  const { hard, soft } = codesFromJudge(p.judge);
  return {
    slot_id: p.slot_id,
    context_id: p.context_id,
    final_text: p.finalState === "BLOCKED" || p.finalState === "JUDGE_UNAVAILABLE" ? "" : p.independent.final_text || "",
    generation_status: p.independent.generation_status,
    judge_status: p.judge.overall_status,
    slot_final_state: p.finalState,
    semantic_regen_attempts: p.attempts,
    last_route: p.lastRoute,
    accepted_attempt: p.accepted_attempt,
    initial_judge_status: p.initialStatus,
    final_judge_status: p.judge.overall_status,
    hard_fail_codes: hard,
    soft_concern_codes: soft,
    judge_unavailable_count: p.juCount,
    regeneration_exhausted: p.exhausted,
    decision: p.decision,
    attempt_history: p.history,
    order8b_version: ORDER8B_VERSION,
    independent: p.independent,
    judge: p.judge,
  };
}

export function isTerminalBlocked(r: RoutedSlotResult): boolean {
  return r.slot_final_state === "BLOCKED" || r.slot_final_state === "JUDGE_UNAVAILABLE";
}

export function isTerminalAccepted(r: RoutedSlotResult): boolean {
  return (
    r.slot_final_state === "ACCEPTED_PASS" ||
    r.slot_final_state === "ACCEPTED_WITH_CONCERNS" ||
    r.slot_final_state === "REGENERATED_PASS"
  );
}
