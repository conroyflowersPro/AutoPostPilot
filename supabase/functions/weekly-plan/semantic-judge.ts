/**
 * ORDER 8A — Semantic Judge Foundation
 * Evaluate only. Never rewrite final_text, never generate alternatives.
 * Hard fail vs soft concern. Per-post isolation. generation_status ≠ judge_status.
 */
import type { DeepGenerationContext, CoreThought, CompressionTarget } from "./deep-generation-context.ts";
import type { IndependentPostResult } from "./independent-post-generation.ts";

export const ORDER8A_VERSION = "semantic_judge_foundation_v1_order8a";
export const ORDER8A_JUDGE_ONLY = true as const;
export const ORDER8A_NO_REWRITE = true as const;
export const ORDER8A_NO_ALTERNATIVE_GENERATION = true as const;
export const ORDER8A_NO_SUGGESTED_HOOK = true as const;
export const ORDER8A_NO_SUGGESTED_ENDING = true as const;
export const ORDER8A_PER_POST_ISOLATION = true as const;
export const ORDER8A_NO_SHARED_JUDGE_HISTORY = true as const;
export const ORDER8A_NO_RAW_MANUAL_PROSE_INPUT = true as const;
export const ORDER8A_NO_RAW_AUDIENCE_COMMENTS = true as const;
export const ORDER8A_HARD_SOFT_SEPARATION = true as const;
export const ORDER8A_GENERATION_STATUS_SEPARATE = true as const;
export const ORDER8A_NO_AUTO_REGENERATION = true as const;
export const ORDER8A_JUDGE_FAILURE_EXPLICIT = true as const;
export const ORDER8A_NO_FINISHED_EXAMPLES_IN_PROMPT = true as const;

export type JudgeOverallStatus =
  | "PASS"
  | "PASS_WITH_CONCERNS"
  | "REJECT"
  | "JUDGE_UNAVAILABLE";

export type ConceptualRepetition = "LOW" | "MEDIUM" | "HIGH";

export type SemanticJudgeInput = {
  slot_id: string;
  context_id: string;
  seed: {
    id?: string;
    meaning: string;
    topic?: string;
    editorial_mode?: string;
    concrete_subject?: string;
  };
  interpretation?: Record<string, unknown> | null;
  core_thought?: Partial<CoreThought> | null;
  reaction_mechanism?: Record<string, unknown> | null;
  thinking_rail?: Record<string, unknown> | null;
  everyday_language?: Record<string, unknown> | null;
  creator_style?: Record<string, unknown> | null;
  humor_decision?: Record<string, unknown> | null;
  factual_boundary?: Record<string, unknown> | null;
  experience_boundary?: Record<string, unknown> | null;
  compression_target?: CompressionTarget | string | null;
  stop_condition?: Record<string, unknown> | null;
  reader_inference_space?: Record<string, unknown> | null;
  generated_text: string;
  generation_status?: string;
  weekly_context?: {
    other_post_structural_signatures?: Array<Record<string, unknown>>;
    recent_generated_signatures?: Array<Record<string, unknown>>;
  };
};

export type SemanticJudgeScores = {
  seed_fidelity: number;
  core_thought_preservation: number;
  creator_fit: number;
  factual_grounding: number;
  experience_grounding: number;
  reader_self_projection: number;
  mechanism_fit: number;
  rail_fit: number;
  everyday_language_fit: number;
  style_fit: number;
  humor_fit: number;
  inference_space_fit: number;
  compression_fit: number;
  stop_condition_fit: number;
  anti_ai_voice_fit: number;
  novelty_fit: number;
};

export type SemanticJudgeFlags = {
  fabricated_fact: boolean;
  fabricated_experience: boolean;
  manual_text_leakage: boolean;
  forced_cta: boolean;
  forced_question: boolean;
  ai_report_voice: boolean;
  over_explained: boolean;
  over_connected: boolean;
  template_like: boolean;
  conceptual_repetition: ConceptualRepetition;
};

export type SemanticJudgeResult = {
  slot_id: string;
  context_id: string;
  overall_status: JudgeOverallStatus;
  hard_fail_reasons: string[];
  soft_concerns: string[];
  scores: SemanticJudgeScores;
  flags: SemanticJudgeFlags;
  judge_version: string;
  judge_call_attempted: boolean;
  judge_call_succeeded: boolean;
  judge_error: string | null;
  judge_mode: "rule_based" | "unavailable" | "llm_assisted";
};

export const ORDER8A_GUARDS = {
  version: ORDER8A_VERSION,
  judge_only: ORDER8A_JUDGE_ONLY,
  no_rewrite: ORDER8A_NO_REWRITE,
  no_alternative_generation: ORDER8A_NO_ALTERNATIVE_GENERATION,
  no_suggested_hook: ORDER8A_NO_SUGGESTED_HOOK,
  no_suggested_ending: ORDER8A_NO_SUGGESTED_ENDING,
  per_post_isolation: ORDER8A_PER_POST_ISOLATION,
  no_shared_judge_history: ORDER8A_NO_SHARED_JUDGE_HISTORY,
  no_raw_manual_prose_input: ORDER8A_NO_RAW_MANUAL_PROSE_INPUT,
  no_raw_audience_comments: ORDER8A_NO_RAW_AUDIENCE_COMMENTS,
  hard_soft_separation: ORDER8A_HARD_SOFT_SEPARATION,
  generation_status_separate: ORDER8A_GENERATION_STATUS_SEPARATE,
  no_auto_regeneration: ORDER8A_NO_AUTO_REGENERATION,
  judge_failure_explicit: ORDER8A_JUDGE_FAILURE_EXPLICIT,
  no_finished_examples_in_prompt: ORDER8A_NO_FINISHED_EXAMPLES_IN_PROMPT,
} as const;

const AI_REPORT_PATTERNS = [
  /결국\s*중요한\s*것/,
  /이것이\s*의미하는\s*바/,
  /흥미로운\s*점/,
  /주목할\s*점/,
  /핵심은\s/,
  /시사하는\s*바가\s*큽/,
  /결론적으로/,
  /요약하면/,
  /앞으로\s*지켜볼\s*필요/,
];

const FORCED_CTA_PATTERNS = [
  /여러분은\s*어떠신가요/,
  /여러분\s*생각은/,
  /댓글로\s*알려/,
  /의견을\s*남겨/,
  /팔로우\s*해/,
  /리트윗\s*해/,
];

const FORCED_QUESTION_PATTERNS = [
  /[?？]/,
  /어떻게\s*생각하/,
  /어떠신가요/,
  /보이시나요/,
  /있으신가요/,
  /(까요|나요|을까|ㄹ까)\s*[.…]?$/,
];

const EXPERIENCE_FABRICATION_PATTERNS = [
  /제가\s*직접\s*써보니/,
  /어제\s*해봤는데/,
  /운전하다가/,
  /마님이\s*그러더라고/,
  /나리가\s*이렇게\s*했/,
  /직접\s*타보니/,
  /제가\s*경험해보니/,
  /제가\s*가봤는데/,
  /구매했다/,
  /가족이\s*이렇게\s*말했/,
];

const MANUAL_LEAKAGE_MARKERS = [
  "[MANUAL_RAW]",
  "MANUAL_POST_TEXT:",
  "<<<HISTORICAL>>>",
  "RAW_PROSE_LEAK",
];

const HOSTILE_RELATIONAL = [
  /감시하/,
  /통제하/,
  /의심하/,
  /적대/,
  /공격적/,
];

function s(v: unknown, d = ""): string {
  if (v == null) return d;
  return String(v).trim() || d;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function emptyScores(): SemanticJudgeScores {
  return {
    seed_fidelity: 0,
    core_thought_preservation: 0,
    creator_fit: 0,
    factual_grounding: 0,
    experience_grounding: 0,
    reader_self_projection: 0,
    mechanism_fit: 0,
    rail_fit: 0,
    everyday_language_fit: 0,
    style_fit: 0,
    humor_fit: 0,
    inference_space_fit: 0,
    compression_fit: 0,
    stop_condition_fit: 0,
    anti_ai_voice_fit: 0,
    novelty_fit: 0,
  };
}

function emptyFlags(): SemanticJudgeFlags {
  return {
    fabricated_fact: false,
    fabricated_experience: false,
    manual_text_leakage: false,
    forced_cta: false,
    forced_question: false,
    ai_report_voice: false,
    over_explained: false,
    over_connected: false,
    template_like: false,
    conceptual_repetition: "LOW",
  };
}

/**
 * Build judge input from DeepGenerationContext + IndependentPostResult.
 * Never injects raw manual/audience prose.
 */
export function buildSemanticJudgeInput(
  ctx: DeepGenerationContext | null | undefined,
  result: IndependentPostResult | null | undefined,
  weekly?: SemanticJudgeInput["weekly_context"],
): SemanticJudgeInput | null {
  if (!ctx || !result) return null;
  const seedId = s((ctx as any).seed_identity?.seed_id || (ctx as any).seed_id);
  const meaning =
    s((ctx as any).interpreted_meaning?.what_is_actually_happening) ||
    s((ctx as any).seed_identity?.concrete_subject) ||
    s((ctx as any).interpreted_meaning?.seed_subject);
  return {
    slot_id: ctx.slot_id || result.slot_id,
    context_id: ctx.context_id || result.context_id,
    seed: {
      id: seedId || undefined,
      meaning,
      topic: s((ctx as any).seed_identity?.topic || (ctx as any).interpreted_meaning?.topic) || undefined,
      editorial_mode: s((ctx as any).editorial_mode) || undefined,
      concrete_subject: s((ctx as any).seed_identity?.concrete_subject) || undefined,
    },
    interpretation: (ctx as any).interpreted_meaning || null,
    core_thought: ctx.core_thought || null,
    reaction_mechanism: (ctx as any).reaction_mechanism || (ctx as any).mechanism || null,
    thinking_rail: (ctx as any).thinking_rail || null,
    everyday_language: (ctx as any).everyday_language || null,
    creator_style: (ctx as any).creator_style || null,
    humor_decision: (ctx as any).humor_decision || (ctx as any).natural_humor || null,
    factual_boundary: (ctx as any).factual_boundaries || (ctx as any).factual_boundary || null,
    experience_boundary: (ctx as any).experience_boundaries || (ctx as any).experience_boundary || null,
    compression_target: ctx.compression_target || null,
    stop_condition: (ctx as any).stop_condition || null,
    reader_inference_space: (ctx as any).reader_inference_space || null,
    generated_text: result.final_text || "",
    generation_status: result.generation_status,
    weekly_context: weekly,
  };
}

function subjectTokens(text: string): string[] {
  return text
    .split(/[\s,./·\-–—]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function hasAnyToken(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase();
  return tokens.some((t) => t.length >= 2 && lower.includes(t.toLowerCase()));
}

/**
 * Structural signature for weekly repetition (no raw text).
 */
export function extractStructuralSignature(text: string): Record<string, unknown> {
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  const hasQ = /\?/.test(text);
  const hasPunch = /ㅋㅋ|ㅎㅎ|ㅋ\s*$/.test(text);
  const firstPerson = /제가|나는|제가\s|우리\s/.test(text);
  const opening = lines[0]?.slice(0, 24) || "";
  const ending = lines[lines.length - 1]?.slice(0, 24) || "";
  return {
    paragraph_count: lines.length,
    opening_type: opening.length > 0 ? (hasQ && lines.length === 1 ? "question" : "statement") : "empty",
    ending_type: hasPunch ? "humor_tail" : hasQ ? "question" : "statement",
    question_used: hasQ,
    punchline_used: hasPunch,
    first_person_used: firstPerson,
    macro_conclusion_used: AI_REPORT_PATTERNS.some((re) => re.test(text)),
    length_bucket: text.length < 80 ? "S" : text.length < 180 ? "M" : "L",
  };
}

/**
 * Core rule-based semantic judge. Evaluation only.
 */
export function evaluateSemanticJudge(input: SemanticJudgeInput): SemanticJudgeResult {
  const text = s(input.generated_text);
  const hard: string[] = [];
  const soft: string[] = [];
  const scores = emptyScores();
  const flags = emptyFlags();
  const slot = input.slot_id || "UNKNOWN";
  const cid = input.context_id || "UNKNOWN";

  if (!text || text.length < 2) {
    hard.push("empty_final_text");
    return finalize(slot, cid, hard, soft, scores, flags, "rule_based", true, true, null);
  }

  for (const m of MANUAL_LEAKAGE_MARKERS) {
    if (text.includes(m)) {
      flags.manual_text_leakage = true;
      hard.push("manual_text_leakage");
      break;
    }
  }

  const expBound = input.experience_boundary || {};
  const mustNot = !!(expBound as any).must_not_claim_first_person;
  const experienced = !!(expBound as any).creator_experienced;
  for (const re of EXPERIENCE_FABRICATION_PATTERNS) {
    if (re.test(text)) {
      if (mustNot || !experienced) {
        flags.fabricated_experience = true;
        hard.push("fabricated_experience");
      } else {
        soft.push("experience_claim_present_with_boundary_ok");
      }
      break;
    }
  }

  const seedMeaning = s(input.seed.meaning) || s(input.seed.concrete_subject);
  const tokens = subjectTokens(seedMeaning);
  let seedScore = 0.5;
  if (seedMeaning.length < 2) {
    seedScore = 0.3;
    soft.push("seed_meaning_thin");
  } else if (hasAnyToken(text, tokens) || text.includes(seedMeaning.slice(0, Math.min(10, seedMeaning.length)))) {
    seedScore = 0.9;
  } else {
    seedScore = 0.25;
    hard.push("seed_meaning_departure");
  }
  scores.seed_fidelity = clamp01(seedScore);

  const core = input.core_thought || {};
  const coreBits = [
    s(core.primary_claim),
    s(core.creator_judgment),
    s(core.tension),
    s(core.useful_implication),
    s(core.reader_relevant_meaning),
  ].filter((x) => x.length > 3);
  let coreScore = 0.55;
  if (coreBits.length === 0) {
    coreScore = 0.4;
    soft.push("core_thought_thin");
  } else {
    const hit = coreBits.some((b) => hasAnyToken(text, subjectTokens(b)) || text.includes(b.slice(0, Math.min(8, b.length))));
    if (hit) coreScore = 0.88;
    else if (text.length > 20) {
      coreScore = 0.45;
      soft.push("core_thought_weak_surface_match");
    } else {
      coreScore = 0.2;
      hard.push("core_thought_lost");
    }
  }
  scores.core_thought_preservation = clamp01(coreScore);

  let factScore = 0.85;
  const yearLike = text.match(/\b(20\d{2})\b/g) || [];
  const moneyLike = /\d{3,}원|\d+\s*만\s*원/.test(text);
  if (moneyLike || yearLike.length > 0) {
    const seedHas = yearLike.some((y) => seedMeaning.includes(y)) || (moneyLike && /원/.test(seedMeaning));
    if (!seedHas) {
      flags.fabricated_fact = true;
      hard.push("fabricated_factual_claim");
      factScore = 0.15;
    }
  }
  scores.factual_grounding = clamp01(factScore);
  scores.experience_grounding = flags.fabricated_experience ? 0.1 : 0.9;

  for (const re of FORCED_CTA_PATTERNS) {
    if (re.test(text)) {
      flags.forced_cta = true;
      soft.push("forced_cta");
      break;
    }
  }
  if (FORCED_QUESTION_PATTERNS.some((re) => re.test(text))) {
    flags.forced_question = true;
    hard.push("question_closer");
  }
  if (/레이어|\bL2\b|\bL1\b|프로토콜|엔드포인트|메커니즘/i.test(text)) {
    hard.push("expert_jargon");
  }

  let aiHits = 0;
  for (const re of AI_REPORT_PATTERNS) {
    if (re.test(text)) aiHits++;
  }
  if (aiHits >= 1) {
    flags.ai_report_voice = true;
    soft.push("ai_report_voice");
  }
  scores.anti_ai_voice_fit = clamp01(1 - aiHits * 0.35);

  const leaveOpen = !!(input.stop_condition as any)?.leave_inference_open;
  const lines = text.split(/\n/).filter((l) => l.trim());
  if (leaveOpen && aiHits > 0) {
    flags.over_explained = true;
    soft.push("over_explained_with_inference_open");
  }
  if (lines.length >= 4 && /그래서|따라서|결국|즉\s/.test(text)) {
    flags.over_connected = true;
    soft.push("over_connected");
  }
  if (/(의미|감정|기분).{0,12}(의미|감정|기분)/.test(text)) {
    flags.over_explained = true;
    soft.push("redundant_emotion_explanation");
  }
  scores.inference_space_fit = clamp01(
    flags.over_explained ? 0.35 : flags.over_connected ? 0.5 : leaveOpen ? 0.85 : 0.7,
  );
  scores.reader_self_projection = clamp01(
    flags.forced_cta || flags.forced_question ? 0.4 : flags.over_explained ? 0.45 : 0.8,
  );

  const stutterRe = /([A-Za-z가-힣]{1,8})(?:\s+\1){2,}/;
  const entHits = (text.match(/\bent\b/gi) || []).length + (text.match(/엔트/g) || []).length;
  if (stutterRe.test(text) || entHits >= 2) {
    hard.push("token_stutter");
  }
  const trimmedLen = text.replace(/\s+/g, " ").trim().length;
  if (trimmedLen > 0 && trimmedLen < 28) {
    hard.push("too_short_original");
  }
  if (/중요한\s*이슈|관심이\s*쏠|주목할\s*만|향후\s*전망|의미가\s*크다/.test(text)) {
    hard.push("generic_thesis");
  }

  const comp = s(input.compression_target, "NATURAL");
  const len = text.length;
  let compScore = 0.8;
  if (comp === "VERY_COMPRESSED" && len > 160) {
    soft.push("compression_very_compressed_exceeded");
    compScore = 0.35;
  } else if (comp === "COMPRESSED" && len > 240) {
    soft.push("compression_compressed_exceeded");
    compScore = 0.4;
  } else if ((comp === "EXPANDED" || comp === "SELECTIVE_LONGFORM") && len < 40) {
    soft.push("compression_too_short_for_expanded");
    compScore = 0.45;
  }
  scores.compression_fit = clamp01(compScore);

  let stopScore = 0.85;
  if (/(결국\s*중요한|시사하는\s*바|요약하면)/.test(text)) {
    soft.push("stop_condition_grand_thesis_tail");
    stopScore = 0.3;
  }
  scores.stop_condition_fit = clamp01(stopScore);

  const humor = input.humor_decision || {};
  const humorMode = s((humor as any).humor_strength || (humor as any).mode, "NONE").toUpperCase();
  const hasHumorSurface = /ㅋㅋ|ㅎㅎ|웃기|장난/.test(text);
  if (humorMode === "NONE" || humorMode === "") {
    scores.humor_fit = hasHumorSurface ? 0.4 : 0.95;
    if (hasHumorSurface) soft.push("humor_forced_despite_none");
  } else {
    scores.humor_fit = hasHumorSurface ? 0.85 : 0.55;
  }

  const academic = /따라서|주목할\s*만한|본질적으로|패러다임/.test(text);
  scores.everyday_language_fit = clamp01(academic ? 0.4 : 0.85);
  if (academic) soft.push("everyday_language_academic");
  scores.style_fit = clamp01(academic || flags.ai_report_voice ? 0.45 : 0.8);
  scores.creator_fit = clamp01(
    (scores.style_fit + scores.everyday_language_fit + scores.anti_ai_voice_fit + (flags.fabricated_experience ? 0.2 : 0.9)) /
      4,
  );
  if (scores.creator_fit < 0.55) soft.push("creator_fit_weak");

  scores.mechanism_fit = 0.75;
  scores.rail_fit = 0.75;
  if (/(ReactionMechanism|ThinkingRail|메커니즘|레일\s*A)/.test(text)) {
    soft.push("mechanism_or_rail_named_in_text");
    scores.mechanism_fit = 0.3;
    scores.rail_fit = 0.3;
    flags.template_like = true;
  }

  const warmScene = /가족|마님|나리|강아지|반려|아이|아들|딸|아내|남편/.test(text + " " + seedMeaning);
  if (warmScene && HOSTILE_RELATIONAL.some((re) => re.test(text))) {
    soft.push("relational_connotation_hostile_in_warm_scene");
    scores.creator_fit = clamp01(scores.creator_fit - 0.15);
  }

  const sigs = [
    ...(input.weekly_context?.other_post_structural_signatures || []),
    ...(input.weekly_context?.recent_generated_signatures || []),
  ];
  const mine = extractStructuralSignature(text);
  let sameOpening = 0;
  let sameEnding = 0;
  for (const sig of sigs) {
    if (sig && sig.opening_type === mine.opening_type && sig.length_bucket === mine.length_bucket) sameOpening++;
    if (sig && sig.ending_type === mine.ending_type && sig.punchline_used === mine.punchline_used) sameEnding++;
  }
  if (sameOpening >= 3 || sameEnding >= 3) {
    soft.push("structural_repetition_high");
    flags.template_like = true;
    flags.conceptual_repetition = "HIGH";
  } else if (sameOpening >= 2 || sameEnding >= 2) {
    soft.push("structural_repetition_medium");
    flags.conceptual_repetition = "MEDIUM";
  } else {
    flags.conceptual_repetition = "LOW";
  }
  scores.novelty_fit = clamp01(
    flags.conceptual_repetition === "HIGH" ? 0.25 : flags.conceptual_repetition === "MEDIUM" ? 0.55 : 0.85,
  );

  return finalize(slot, cid, hard, soft, scores, flags, "rule_based", true, true, null);
}

function finalize(
  slot: string,
  cid: string,
  hard: string[],
  soft: string[],
  scores: SemanticJudgeScores,
  flags: SemanticJudgeFlags,
  mode: SemanticJudgeResult["judge_mode"],
  attempted: boolean,
  succeeded: boolean,
  err: string | null,
): SemanticJudgeResult {
  let overall: JudgeOverallStatus;
  if (!succeeded && err) {
    overall = "JUDGE_UNAVAILABLE";
  } else if (hard.length > 0) {
    overall = "REJECT";
  } else if (soft.length > 0 || scores.creator_fit < 0.55 || scores.seed_fidelity < 0.5) {
    overall = "PASS_WITH_CONCERNS";
  } else {
    overall = "PASS";
  }
  return {
    slot_id: slot,
    context_id: cid,
    overall_status: overall,
    hard_fail_reasons: hard,
    soft_concerns: soft,
    scores,
    flags,
    judge_version: ORDER8A_VERSION,
    judge_call_attempted: attempted,
    judge_call_succeeded: succeeded,
    judge_error: err,
    judge_mode: mode,
  };
}

/**
 * Primary entry — per post, isolated.
 * Foundation path is deterministic rule-based (offline tests + cost control).
 * On internal exception → JUDGE_UNAVAILABLE (never auto-PASS/REJECT silently).
 */
export function semanticJudge(
  input: SemanticJudgeInput | null | undefined,
  _options: { xai_key?: string | null; dry_run?: boolean } = {},
): SemanticJudgeResult {
  if (!input) {
    return {
      slot_id: "UNKNOWN",
      context_id: "UNKNOWN",
      overall_status: "JUDGE_UNAVAILABLE",
      hard_fail_reasons: [],
      soft_concerns: [],
      scores: emptyScores(),
      flags: emptyFlags(),
      judge_version: ORDER8A_VERSION,
      judge_call_attempted: false,
      judge_call_succeeded: false,
      judge_error: "missing_judge_input",
      judge_mode: "unavailable",
    };
  }
  try {
    return evaluateSemanticJudge(input);
  } catch (e: any) {
    return {
      slot_id: input.slot_id || "UNKNOWN",
      context_id: input.context_id || "UNKNOWN",
      overall_status: "JUDGE_UNAVAILABLE",
      hard_fail_reasons: [],
      soft_concerns: [],
      scores: emptyScores(),
      flags: emptyFlags(),
      judge_version: ORDER8A_VERSION,
      judge_call_attempted: true,
      judge_call_succeeded: false,
      judge_error: s(e?.message, "judge_internal_error").slice(0, 160),
      judge_mode: "unavailable",
    };
  }
}

/**
 * Convenience: context + independent result → judge result (no rewrite).
 */
export function judgeIndependentResult(
  ctx: DeepGenerationContext | null | undefined,
  result: IndependentPostResult | null | undefined,
  weekly?: SemanticJudgeInput["weekly_context"],
  options?: { xai_key?: string | null },
): SemanticJudgeResult {
  const input = buildSemanticJudgeInput(ctx, result, weekly);
  return semanticJudge(input, options);
}

export function isJudgeReject(r: SemanticJudgeResult): boolean {
  return r.overall_status === "REJECT";
}

export function isJudgePass(r: SemanticJudgeResult): boolean {
  return r.overall_status === "PASS" || r.overall_status === "PASS_WITH_CONCERNS";
}
