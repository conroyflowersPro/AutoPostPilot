/**
 * ORDER 7B — Independent Per-Post Generation
 * One DeepGenerationContext in → one IndependentPostResult out.
 * Batch transport allowed; batch reasoning forbidden.
 * Production default = Grok 4.6 writer when XAI_API_KEY present.
 * Quota/expand also Grok. No OpenAI. dry_run = explicit test/diagnostics only.
 */
import type {
  DeepGenerationContext,
  CoreThought,
  CompressionTarget,
  GenerationStatus as ContextGenerationStatus,
} from "./deep-generation-context.ts";
import { isGenerationContextWritable, ORDER7A_VERSION } from "./deep-generation-context.ts";
import { hasExpertJargon, isEngagementBaitCloser } from "./seed-scope.ts";
import { creatorDnaWriterSlice } from "./engine-dna.ts";
import { writerArchitectureLock } from "./engine-architecture.ts";
import { writerLivedTimeLines } from "./seed-ownership.ts";
import { presentPacketLines } from "./semantic-seed-packet.ts";
import { deepThesisWriteLines, type DeepThesisFit } from "./deep-thesis.ts";
import { thinkingIntelligenceLines } from "./creator-thinking-intelligence.ts";

export const ORDER7B_VERSION = "independent_post_generation_v1_grok_writer";
export const ORDER7B_PER_POST_ISOLATION = true as const;
export const ORDER7B_BATCH_TRANSPORT_NOT_REASONING = true as const;
export const ORDER7B_NO_CROSS_POST_CONTAMINATION = true as const;
export const ORDER7B_NO_MANUAL_PROSE_INPUT = true as const;
export const ORDER7B_NO_HISTORICAL_PROSE_INPUT = true as const;
export const ORDER7B_NO_FINISHED_EXAMPLES = true as const;
export const ORDER7B_NO_GENERATION_TEMPLATE = true as const;
export const ORDER7B_NO_FORCED_CTA = true as const;
export const ORDER7B_NO_FORCED_QUESTION = true as const;
export const ORDER7B_NO_AI_REPORT_VOICE = true as const;
export const ORDER7B_NO_REASONING_TRACE_STORED = true as const;
export const ORDER7B_NO_EXPERIENCE_FABRICATION = true as const;
export const ORDER7B_NO_FACTUAL_FABRICATION = true as const;
export const ORDER7B_PRESERVE_READER_INFERENCE = true as const;
export const ORDER7B_NO_SENTENCE_OVER_CONNECTION = true as const;
export const ORDER7B_CORE_THOUGHT_NOT_LITERAL_SENTENCE = true as const;
export const ORDER7B_MECHANISM_NOT_TEMPLATE = true as const;
export const ORDER7B_RAIL_NOT_TEMPLATE = true as const;
export const ORDER7B_HUMOR_NONE_ALLOWED = true as const;
export const ORDER7B_SILENT_SLOT_DROP_FORBIDDEN = true as const;
export const ORDER7B_LIVE_GROK_WRITER = true as const;
export const ORDER7B_PRODUCTION_DEFAULT_LIVE = true as const;
export const ORDER7B_NO_FAKE_FALLBACK_TEXT = true as const;
export const ORDER7B_THOUGHT_FIRST = true as const;

export type IndependentGenerationStatus =
  | "GENERATED"
  | "GENERATION_RETRY_REQUIRED"
  | "GENERATION_BLOCKED"
  | "GENERATION_CONTEXT_NOT_WRITABLE"
  | "GENERATION_SEED_INSUFFICIENT"
  | "GENERATION_BOUNDARY_VIOLATION";

export type WriterMode = "live_grok" | "dry_run" | "no_key" | "none";

export type IndependentPostResult = {
  slot_id: string;
  context_id: string;
  final_text: string;
  generation_status: IndependentGenerationStatus;
  generation_confidence: number;
  seed_fidelity: boolean;
  core_thought_preserved: boolean;
  factual_boundary_preserved: boolean;
  experience_boundary_preserved: boolean;
  reader_inference_preserved: boolean;
  compression_followed: boolean;
  stop_condition_followed: boolean;
  generation_version: string;
  plan_markers: {
    seed_subject: string;
    core_axis: string;
    mechanism_flexible: true;
    rail_flexible: true;
    humor_mode: string;
    compression_target: CompressionTarget;
    stop_punchline: boolean;
    leave_inference_open: boolean;
    prefer_broad_simple: true;
    question_required: false;
    cta_required: false;
  };
  block_reasons: string[];
  order7b_version: string;
  order7a_context_version: string;
  writer_mode: WriterMode;
  writer_call_attempted: boolean;
  writer_call_succeeded: boolean;
  writer_error: string | null;
  agent_core_thought?: string;
  from_current_seed?: boolean;
  boundary_ok?: boolean;
};

export type GenerateIndependentOptions = {
  /** Explicit only — production default is live when key present */
  dry_run?: boolean;
  xai_key?: string | null;
  model?: string;
  allow_one_retry?: boolean;
  timeout_ms?: number;
  retry_hint?: string;
};

export const ORDER7B_GUARDS = {
  version: ORDER7B_VERSION,
  per_post_isolation: ORDER7B_PER_POST_ISOLATION,
  batch_transport_not_reasoning: ORDER7B_BATCH_TRANSPORT_NOT_REASONING,
  no_cross_post_contamination: ORDER7B_NO_CROSS_POST_CONTAMINATION,
  no_manual_prose_input: ORDER7B_NO_MANUAL_PROSE_INPUT,
  no_historical_prose_input: ORDER7B_NO_HISTORICAL_PROSE_INPUT,
  no_finished_examples: ORDER7B_NO_FINISHED_EXAMPLES,
  no_generation_template: ORDER7B_NO_GENERATION_TEMPLATE,
  no_forced_cta: ORDER7B_NO_FORCED_CTA,
  no_forced_question: ORDER7B_NO_FORCED_QUESTION,
  no_ai_report_voice: ORDER7B_NO_AI_REPORT_VOICE,
  no_reasoning_trace_stored: ORDER7B_NO_REASONING_TRACE_STORED,
  no_experience_fabrication: ORDER7B_NO_EXPERIENCE_FABRICATION,
  no_factual_fabrication: ORDER7B_NO_FACTUAL_FABRICATION,
  preserve_reader_inference: ORDER7B_PRESERVE_READER_INFERENCE,
  no_sentence_over_connection: ORDER7B_NO_SENTENCE_OVER_CONNECTION,
  core_thought_not_literal_sentence: ORDER7B_CORE_THOUGHT_NOT_LITERAL_SENTENCE,
  mechanism_not_template: ORDER7B_MECHANISM_NOT_TEMPLATE,
  rail_not_template: ORDER7B_RAIL_NOT_TEMPLATE,
  humor_none_allowed: ORDER7B_HUMOR_NONE_ALLOWED,
  silent_slot_drop_forbidden: ORDER7B_SILENT_SLOT_DROP_FORBIDDEN,
  live_grok_writer: ORDER7B_LIVE_GROK_WRITER,
  thought_first: ORDER7B_THOUGHT_FIRST,
  production_default_live: ORDER7B_PRODUCTION_DEFAULT_LIVE,
  no_fake_fallback_text: ORDER7B_NO_FAKE_FALLBACK_TEXT,
} as const;

const AI_REPORT_PATTERNS = [
  /결국\s*중요한\s*것/,
  /이것이\s*의미하는\s*바/,
  /단순히\s+.+\s*아니라/,
  /흥미로운\s*점/,
  /주목할\s*점/,
  /핵심은\s/,
  /시사하는\s*바가\s*큽/,
  /앞으로\s*지켜볼\s*필요/,
  /결론적으로/,
  /요약하면/,
];

const FORCED_CTA_PATTERNS = [
  /여러분은\s*어떠신가요/,
  /여러분\s*생각은/,
  /댓글로\s*알려/,
  /의견을\s*남겨/,
  /팔로우\s*해/,
  /리트윗\s*해/,
  /어떻게\s*생각하/,
  /어떠신가요/,
  /보이시나요/,
  /있으신가요/,
  /해보셨/,
];

const EXPERIENCE_FABRICATION_PATTERNS = [
  /제가\s*직접\s*써보니/,
  /어제\s*해봤는데/,
  /어제\s*내가/,
  /오늘\s*직접/,
  /방금\s*테스트/,
  /운전하다가/,
  /직접\s*운전/,
  /내가\s*타봤/,
  /마님이\s*그러더라고/,
  /나리가\s*이렇게\s*했/,
  /직접\s*타보니/,
  /제가\s*경험해보니/,
];

function s(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim() || fallback;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function subjectFromCtx(ctx: DeepGenerationContext): string {
  return (
    s(ctx.seed_identity?.concrete_subject) ||
    s(ctx.interpreted_meaning?.seed_subject) ||
    s(ctx.interpreted_meaning?.what_is_actually_happening) ||
    ""
  );
}

function humorMode(ctx: DeepGenerationContext): string {
  const h = ctx.humor_decision || ({} as DeepGenerationContext["humor_decision"]);
  if (!h.humor_compatible || s(h.humor_strength, "NONE") === "NONE") return "NONE";
  return s(h.humor_strength, "LIGHT");
}

export function buildWriterPlanMarkers(ctx: DeepGenerationContext): IndependentPostResult["plan_markers"] {
  const core = ctx.core_thought;
  const axis =
    s(core?.primary_claim) ||
    s(core?.tension) ||
    s(core?.creator_judgment) ||
    "observe_current_seed";
  return {
    seed_subject: subjectFromCtx(ctx).slice(0, 160),
    core_axis: axis.slice(0, 120),
    mechanism_flexible: true,
    rail_flexible: true,
    humor_mode: humorMode(ctx),
    compression_target: ctx.compression_target || "NATURAL",
    stop_punchline: !!ctx.stop_condition?.punchline_stop_ok,
    leave_inference_open: !!ctx.stop_condition?.leave_inference_open,
    prefer_broad_simple: true,
    question_required: false,
    cta_required: false,
  };
}

/**
 * Constraint-only system instructions for the live Grok 4.6 writer.
 * No finished examples, no templates, no CTA, no fabrication.
 */
/** Optional delivery lines after the thought is closed. Never a finished template. Never name M1–M9 in the post. */
const MECHANISM_WRITE_MOVES: Record<string, string> = {
  M1_SURPRISE_DEBATE_CHANGE:
    "Show one concrete change that is off from the usual expectation. Stop. The reader judges. Do not ask them.",
  M2_EXPERIENCE_EMPATHY:
    "Show one lived-scene detail a stranger could also have had. Do not write 'anyone else?'.",
  M3_EVIDENCE_JUDGMENT:
    "Separate how it looks from what is going on. Do not deliver the verdict. Do not ask which side is right.",
  M4_LIFE_PATTERN_EXPOSURE:
    "Compress a repeated everyday behavior into one observation. Recognition is the entry. Do not ask if they do it too.",
  M5_SHARED_TENSION_REVERSAL:
    "Set a shared tension, then reverse it. Stop at the reverse. No question, no explanation.",
  M6_SELF_REFERENTIAL_OBVIOUSNESS:
    "What looks surprising from outside is ordinary here. State that. Do not ask.",
  M7_GROUP_BEHAVIOR_DISCOVERY:
    "Show people repeating the same small behavior. Leave why unfinished as a statement, not a question.",
  M8_SELF_DEPRECATING_DISCLOSURE:
    "Only if evidence exists: one small imperfect self-detail first. Never fake it. Never ask the reader to confess.",
  M9_EVERYDAY_BLANK_FILLING:
    "Name the small missing piece as a situation (which screen, which line). The blank is inside the observation. Do not put a question mark at the end.",
};

/** How far the move runs — not a character quota, not "one sentence is enough". */
const MECHANISM_SHAPE_HINTS: Record<string, string> = {
  M1_SURPRISE_DEBATE_CHANGE:
    "Keep going until the off-expectation change is visible. Stop there. One sentence or more — whatever the change needs.",
  M2_EXPERIENCE_EMPATHY:
    "Keep the lived-scene detail until a stranger could have been there. Not a one-line memo.",
  M3_EVIDENCE_JUDGMENT:
    "Need both how it looks and what is going on. Two beats. Stop before the verdict.",
  M4_LIFE_PATTERN_EXPOSURE:
    "Compress the repeated behavior. Write a second beat only if the pattern is not visible yet.",
  M5_SHARED_TENSION_REVERSAL:
    "Set the shared tension, then reverse it. Stop at the reverse. No explanation after.",
  M6_SELF_REFERENTIAL_OBVIOUSNESS:
    "Show the outsider surprise and that it is ordinary here. Both beats.",
  M7_GROUP_BEHAVIOR_DISCOVERY:
    "Show the repeated group behavior. Leave why unfinished as a statement.",
  M8_SELF_DEPRECATING_DISCLOSURE:
    "One imperfect self-detail first, only with evidence. Then the observation.",
  M9_EVERYDAY_BLANK_FILLING:
    "Name the missing piece inside the observation. Complete the situation. Not a question.",
};

/**
 * Delivery catalog after a thought exists. Not injected into the live writer prompt.
 * NONE is normal. Do not use these lines to pick the thought.
 */
export function writerMechanismConstraintLines(_ctx: DeepGenerationContext): string[] {
  void _ctx;
  void MECHANISM_WRITE_MOVES;
  void MECHANISM_SHAPE_HINTS;
  return [];
}

export function writerRailConstraintLines(_ctx: DeepGenerationContext): string[] {
  void _ctx;
  return [];
}

export function writerEverydayConstraintLines(ctx: DeepGenerationContext): string[] {
  const everyday = ((ctx as any).everyday_language || {}) as Record<string, unknown>;
  const strategy = s(everyday.reader_entry_strategy);
  const protectedMeaning = Array.isArray(everyday.protected_meaning)
    ? (everyday.protected_meaning as unknown[]).map((x) => s(x)).filter(Boolean).slice(0, 4)
    : [];
  const forbidden = Array.isArray(everyday.forbidden_simplifications)
    ? (everyday.forbidden_simplifications as unknown[]).map((x) => s(x)).filter(Boolean).slice(0, 4)
    : [];
  return [
    "EVERYDAY LANGUAGE (keep thought depth; lower entry barrier; not a vocab list):",
    "Entry strategy: " + (strategy && strategy !== "NONE" ? strategy : "DIRECT_CONCRETE"),
    everyday.human_relevance_bridge ? "Bridge through a felt daily situation, not a lecture." : "",
    s(everyday.compression_preference) ? "Compression: " + s(everyday.compression_preference) : "",
    protectedMeaning.length ? "Do not dilute: " + protectedMeaning.join("; ") : "",
    forbidden.length ? "Do not simplify into: " + forbidden.join("; ") : "",
    "FORBIDDEN jargon: 레이어, 레이어2, L2, 스택, 프로토콜, 메커니즘.",
  ].filter(Boolean);
}

export function writerStyleConstraintLines(ctx: DeepGenerationContext): string[] {
  const style = ((ctx as any).creator_style || {}) as Record<string, unknown>;
  const family = s(style.style_family);
  if (!family) return [];
  const banned = Array.isArray(style.prohibited_surface_behaviors)
    ? (style.prohibited_surface_behaviors as unknown[]).map((x) => s(x)).filter(Boolean).slice(0, 6)
    : [];
  return [
    "CREATOR STYLE (surface tendency for this post, not a template): " + family,
    s(style.conversational_level) ? "Conversational: " + s(style.conversational_level) : "",
    s(style.compression_level) ? "Compression: " + s(style.compression_level) : "",
    s(style.politeness_level) ? "Politeness: " + s(style.politeness_level) : "",
    s(style.directness) ? "Directness: " + s(style.directness) : "",
    s(style.reflection_level) ? "Reflection: " + s(style.reflection_level) : "",
    s(style.technical_density) ? "Technical density: " + s(style.technical_density) : "",
    banned.length ? "Forbidden surface: " + banned.join(", ") : "",
  ].filter(Boolean);
}

export function writerBoundaryConstraintLines(ctx: DeepGenerationContext): string[] {
  const facts = Array.isArray(ctx.factual_boundaries) ? ctx.factual_boundaries : [];
  const prohibitedInvent = facts
    .map((x: any) => (x && typeof x === "object" ? x : { item: x, status: "" }))
    .filter((x: any) => String(x.status || "") === "prohibited_to_invent" || /without evidence/i.test(String(x.item || "")))
    .map((x: any) => s(x.item))
    .filter(Boolean)
    .slice(0, 6);
  const claims = Array.isArray(ctx.prohibited_claims)
    ? ctx.prohibited_claims.map((x) => s(x)).filter(Boolean).slice(0, 6)
    : [];
  const lines: string[] = [];
  if (prohibitedInvent.length) lines.push("FACTUAL DO-NOT-INVENT: " + prohibitedInvent.join("; "));
  if (claims.length) lines.push("PROHIBITED CLAIMS: " + claims.join("; "));
  return lines.filter(Boolean);
}

export function writerHumorConstraintLines(ctx: DeepGenerationContext): string[] {
  const h = ((ctx as any).humor_decision || {}) as Record<string, unknown>;
  const strength = s(h.humor_strength, "NONE");
  if (!h.humor_compatible || strength === "NONE") {
    return ["HUMOR DECISION: NONE — do not force jokes, ㅋㅋ, or punchlines."];
  }
  return [
    "HUMOR DECISION (do not name the engine):",
    "Strength: " + strength,
    h.humor_grounded ? "Keep humor grounded in the observed situation." : "Do not invent a comic scene.",
    h.self_deprecation_allowed ? "Light self-deprecation ok if already in the situation." : "No self-deprecation.",
    h.laughter_marker_allowed ? "ㅋㅋ only if it fits this post's register." : "No ㅋㅋ.",
    h.stop_after_punchline_ok ? "Stop after the punch if the observation is complete." : "",
  ].filter(Boolean);
}

function repairInstructionLines(ctx: DeepGenerationContext): string[] {
  const seed = ((ctx as any).seed || {}) as Record<string, unknown>;
  const reasons = (Array.isArray(seed.judge_reasons) ? seed.judge_reasons : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const planned = String(seed.planned_at || "").trim();
  if (seed.replan) {
    return [
      "THIS CALL IS CREATE after slot-level PLAN replan. Not content REPAIR of the previous post.",
      "Use the NEW assigned Seed, Role, Editorial Mode, planner_intent, and planned_at from Agent승 PLAN. The rest of the week stays.",
      planned ? "planned_at for this replanned slot: " + planned : "Use the assigned slot timestamp from PLAN.",
      reasons.length
        ? "Previous Judge invalidation (context, not a rewrite template): " + reasons.join(" · ")
        : "Slot strategy was replanned. Think and write for the new assignment.",
      "Do not copy Judge reasons into the post. Do not keep the collapsed previous strategy.",
    ];
  }
  if (!seed.repair && !reasons.length) return [];
  return [
    "THIS CALL IS REPAIR of one slot after independent Judge REJECT. Not a new WEEKLY plan.",
    "Keep Slot identity, Seed, Role, Editorial Mode, and planned_at.",
    planned ? "planned_at to keep: " + planned : "Keep the assigned slot timestamp.",
    reasons.length
      ? "Judge evidence (not a rewrite template): " + reasons.join(" · ")
      : "Judge evidence is present. Do not turn it into a fixed sentence recipe.",
    "Content reject. Do not change timestamp, Role, Mode, or Seed as a default.",
    "Do not copy Judge reasons into the post. Fix the problem, then think and write again.",
  ];
}

function writerPhilosophyBlock(phase: "think" | "write" = "write"): string {
  const collectionLine =
    phase === "think"
      ? "Collection is not available on this THINK call. Do not invent force. Do not pick cards."
      : "Collection candidates may follow. Infer fit against the locked Core Thought. Zero cards is allowed. Do not invent force. Do not name theories or card numbers. Do not change Core Thought.";
  const thoughtLine =
    phase === "think"
      ? "YOU decide Core Thought after THINK. It is this post's center judgment or viewpoint — not a hook, punchline, finished paragraph, or assembled label (tension_around / judgment_axis / reader_bridge)."
      : "Core Thought is already closed. WRITE it. Do not remake the judgment. Collection does not replace it.";
  const writeLine =
    phase === "think"
      ? "Do not write the post on this call. Output Core Thought only."
      : "WRITE the locked Core Thought in this Creator's natural language. Do not print thinking steps.";
  return [
    "POST AGENT승 ROLE: You are Agent승. Same identity as weekly planning. This call is POST: think, then write one Korean X post for @Seung4680. No separate Writer.",
    "UNDERSTAND the assigned Seed and Planner Intent. VERIFY facts and experience boundaries. THINK with Creator Thinking Intelligence as reference only.",
    thoughtLine,
    "No Rail is normal. You may use one thinking pattern, parts of several, mutate, invent a new path, or use none. Rails do not choose the conclusion. Topic names do not choose a rail.",
    collectionLine,
    writeLine,
    "You do not choose the seven-day strategy, select another Seed, or rebuild the week.",
    "HARD BOUNDARY: do not invent facts or lived experience, do not directly copy a Manual Creator Post, and do not abandon the assigned Seed and Planner Intent.",
    "Do not paste prompt material or examples.",
    "If live X/web facts are needed to know what was actually announced, use them as facts only. Do not copy tweet wording. Do not inhabit someone else's viral lived post as your yesterday.",
    "Your goal is long-term X account growth. Participation is a signal. Stop when the thought is delivered.",
  ].join("\n");
}

export function buildConstraintOnlyWriterInstructions(ctx: DeepGenerationContext): string {
  const core = ctx.core_thought;
  const expBound = ctx.experience_boundaries || {};
  const exp = (ctx as any).experience_packet || {};
  const thought = (ctx as any).post_thought || {};
  const experienced = !!(exp.creator_experienced && Array.isArray(exp.facts) && exp.facts.length);
  const mustNotFirstPerson = !experienced;
  const planner = ctx.planner_intent || { strategy_slot_id: "", strategic_role: "", intent: "" };
  const voice = ctx.voice_register;
  const packet = (ctx as any).seed_packet || {};
  const packetLines = presentPacketLines(packet);
  const thesisFit = ((thought as any).deep_thesis || null) as DeepThesisFit | null;
  const deepLines = thesisFit ? deepThesisWriteLines(thesisFit) : [];
  const intelLines = thinkingIntelligenceLines((ctx as any).thinking_intelligence);
  const decided = s(thought.core_thought || core?.creator_judgment || core?.primary_claim);
  const writeLength = thesisFit?.use
    ? "WRITE: length follows the thought. Short if the discovery is already there. Do not cut the logic for a quota. Do not add after it lands."
    : "WRITE: express the Core Thought you decided in natural Creator language. 2–4 lines is enough if the thought is already there. Do not compress a thought that still needs to unfold.";

  return [
    "You think, then write one Korean X post for creator @Seung4680.",
    writerPhilosophyBlock("write"),
    writerArchitectureLock(),
    ...repairInstructionLines(ctx),
    "ASSIGNED PLANNER INTENT (strategic purpose, never a writing template; do not re-plan the week):",
    `slot=${s(planner.strategy_slot_id)} role=${s(planner.strategic_role)} intent=${s(planner.intent)}`,
    "ASSIGNED SEED (UNDERSTAND / VERIFY evidence — not Core Thought):",
    packetLines.join("\n"),
    "Observation: " + s(thought.observation || (ctx as any).interpreted_meaning?.what_is_actually_happening).slice(0, 220),
    "Seed interpretation notes: " + s(thought.creator_interpretation || ctx.why_it_matters).slice(0, 220),
    "Reader situation (not a bridge slogan): " + s(thought.reader_entry || ctx.human_element).slice(0, 180),
    decided
      ? "LOCKED CORE THOUGHT after THINK. Collection must not replace it: " + decided.slice(0, 220)
      : "CORE THOUGHT: none yet. After THINK, you write it. One center judgment or viewpoint from this seed. Not a finished post.",
    "Stop point: " + s(thought.stop_point || "Stop when the core thought is already delivered."),
    ...intelLines,
    ...deepLines,
    s((ctx as any).collection_block) || "COLLECTION: none this run. Do not invent force.",
    "STABLE CREATOR DNA:",
    creatorDnaWriterSlice(s(planner.strategic_role)),
    voice
      ? [
          "RECENT VOICE REGISTER (Current USER_DIRECT rhythm, never copy recent sentences, never learn from AP drafts):",
          s(voice.constraint_line),
          `handmade_n=${voice.n} window_days=${voice.window_days} median_chars=${voice.median_chars} question_ending_allowed=${voice.question_ending_allowed}`,
        ].join("\n")
      : "RECENT VOICE REGISTER: missing. Write in current Creator DNA only.",
    writeLength,
    "STOP: no lesson, summary, industry outlook, giant meaning, reader question, or CTA. Do not auto-add a paragraph after the thought lands.",
    ...writerBoundaryConstraintLines(ctx),
    "EXPERIENCE: " + (experienced && !mustNotFirstPerson
      ? "first-person only within these facts: " + (Array.isArray(exp.facts) ? exp.facts.join(" | ") : "")
      : "do not claim first-person lived experience"),
    s((expBound as any).owner) === "OTHER" || s(exp.ownership) === "OTHER"
      ? "PUBLIC VIRAL: circulating scene, not your dated life. Never inhabit the found post's I. Do not write N일 전."
      : "",
    experienced && s((expBound as any).occurred_at)
      ? writerLivedTimeLines(String((expBound as any).occurred_at)).join(" ")
      : "",
    s((ctx as any).cite_episode_hint)
      ? "CITE RELATED EXPERIENCE EVIDENCE: use only as factual grounding. Do not retell or copy the source post. 동일 내용 금지."
      : "",
    "OUTPUT JSON only: {\"core_thought\":\"one judgment sentence\",\"from_current_seed\":true,\"boundary_ok\":true,\"post\":\"korean x post\"}.",
    "core_thought is not the post. post is the post. No chain-of-thought. No English meta in post.",
  ].filter(Boolean).join("\n");
}

export function buildThinkOnlyInstructions(ctx: DeepGenerationContext): string {
  const thought = (ctx as any).post_thought || {};
  const planner = ctx.planner_intent || { strategy_slot_id: "", strategic_role: "", intent: "" };
  const packet = (ctx as any).seed_packet || {};
  const packetLines = presentPacketLines(packet);
  const intelLines = thinkingIntelligenceLines((ctx as any).thinking_intelligence);
  const thesisFit = ((thought as any).deep_thesis || null) as DeepThesisFit | null;
  const deepLines = thesisFit ? deepThesisWriteLines(thesisFit) : [];
  return [
    "THINK only. Do not write the Korean X post on this call.",
    writerPhilosophyBlock("think"),
    writerArchitectureLock(),
    "ASSIGNED PLANNER INTENT (do not re-plan the week):",
    `slot=${s(planner.strategy_slot_id)} role=${s(planner.strategic_role)} intent=${s(planner.intent)}`,
    "ASSIGNED SEED (UNDERSTAND / VERIFY evidence — not Core Thought):",
    packetLines.join("\n"),
    "Observation: " + s(thought.observation || (ctx as any).interpreted_meaning?.what_is_actually_happening).slice(0, 220),
    "Seed interpretation notes: " + s(thought.creator_interpretation || ctx.why_it_matters).slice(0, 220),
    "Reader situation (not a bridge slogan): " + s(thought.reader_entry || ctx.human_element).slice(0, 180),
    "CORE THOUGHT: none yet. After THINK, you write it. One center judgment or viewpoint from this seed. Not a finished post.",
    ...intelLines,
    ...deepLines,
    ...writerBoundaryConstraintLines(ctx),
    "OUTPUT JSON only: {\"core_thought\":\"one judgment sentence\",\"from_current_seed\":true,\"boundary_ok\":true}.",
    "No post field. No chain-of-thought.",
  ].filter(Boolean).join("\n");
}

/**
 * Offline constrained composer — dry_run / test path only.
 * Never used as silent production fallback after a failed live call.
 */
function composeConstrainedText(ctx: DeepGenerationContext, markers: IndependentPostResult["plan_markers"]): string {
  const subject = markers.seed_subject || subjectFromCtx(ctx);
  const tension = s(ctx.core_thought?.tension);
  const human = s(ctx.interpreted_meaning?.human_element) || s((ctx as any).human_element);
  const why = s(ctx.interpreted_meaning?.why_it_matters_now) || s((ctx as any).why_it_matters);
  const humor = markers.humor_mode;
  const comp = markers.compression_target;
  const leaveOpen = markers.leave_inference_open;

  const salt = (ctx.context_id || ctx.slot_id || subject).length + subject.charCodeAt(0);
  const openings = [
    subject,
    tension ? `${subject}. ${tension.slice(0, 40)}` : subject,
    why ? `${subject} — ${why.slice(0, 50)}` : subject,
  ];
  let body = openings[salt % openings.length];

  if (comp === "VERY_COMPRESSED" || comp === "COMPRESSED") {
    body = body.slice(0, 90);
  } else if (comp === "EXPANDED" || comp === "SELECTIVE_LONGFORM") {
    if (human && human.length > 8) body = `${body}\n${human.slice(0, 80)}`;
    if (why && !body.includes(why.slice(0, 20))) body = `${body}\n${why.slice(0, 70)}`;
  } else {
    if (human && human.length > 12 && salt % 2 === 0) {
      body = `${body}\n${human.slice(0, 60)}`;
    }
  }

  if (!leaveOpen && why && !body.includes(why.slice(0, 15)) && comp !== "VERY_COMPRESSED") {
    body = `${body}\n${why.slice(0, 50)}`;
  }

  for (const re of AI_REPORT_PATTERNS) body = body.replace(re, "");
  for (const re of FORCED_CTA_PATTERNS) body = body.replace(re, "");

  body = body.replace(/\n{3,}/g, "\n\n").trim();
  if (!body) body = subject.slice(0, 80) || ".";
  return body.slice(0, comp === "VERY_COMPRESSED" ? 120 : comp === "COMPRESSED" ? 180 : 480);
}

export type WriterCallResult = {
  ok: boolean;
  text: string;
  error: string | null;
  attempted: boolean;
  core_thought?: string;
  from_current_seed?: boolean;
  boundary_ok?: boolean;
};

export function parseAgentSeungPostOutput(raw: string): {
  core_thought: string;
  from_current_seed: boolean;
  boundary_ok: boolean;
  post: string;
} {
  const text = String(raw || "").trim();
  const fenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(fenced.slice(start, end + 1));
      const post = s(obj.post || obj.final_text || obj.text);
      const thought = s(obj.core_thought || obj.coreThought).slice(0, 220);
      if (post.length >= 4) {
        return {
          core_thought: /^(judgment_axis|tension_around|reader_bridge)\s*:/i.test(thought) ? "" : thought,
          from_current_seed: obj.from_current_seed !== false,
          boundary_ok: obj.boundary_ok !== false,
          post,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { core_thought: "", from_current_seed: true, boundary_ok: true, post: text };
}

export function parseAgentSeungThinkOutput(raw: string): {
  core_thought: string;
  from_current_seed: boolean;
  boundary_ok: boolean;
} {
  const text = String(raw || "").trim();
  const fenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(fenced.slice(start, end + 1));
      const thought = s(obj.core_thought || obj.coreThought).slice(0, 220);
      if (thought && !/^(judgment_axis|tension_around|reader_bridge)\s*:/i.test(thought)) {
        return {
          core_thought: thought,
          from_current_seed: obj.from_current_seed !== false,
          boundary_ok: obj.boundary_ok !== false,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { core_thought: "", from_current_seed: true, boundary_ok: true };
}

function extractXaiResponsesText(parsed: any): string {
  const direct = s(parsed?.output_text);
  if (direct.length >= 4) return direct;
  const chunks: string[] = [];
  for (const item of Array.isArray(parsed?.output) ? parsed.output : []) {
    if (typeof item?.text === "string") chunks.push(item.text);
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.output_text === "string") chunks.push(part.output_text);
    }
  }
  const joined = chunks.map((c) => s(c)).filter((c) => c.length > 0).join("\n").trim();
  if (joined.length >= 4) return joined;
  return s(parsed?.choices?.[0]?.message?.content);
}

/**
 * Grok 4.6 Agent Tools writer — /v1/responses with x_search + web_search.
 * Not the retired Live Search chat field (HTTP 410).
 */
export async function callGrokWriter(
  ctx: DeepGenerationContext,
  xaiKey: string,
  options: { model?: string; timeout_ms?: number; retry_hint?: string; temperature?: number } = {},
): Promise<WriterCallResult> {
  const system = buildConstraintOnlyWriterInstructions(ctx);
  const userMsg = [
    "WRITE the locked Core Thought as one Korean X post. Infer Collection candidates only if they already live in this seed/thought. Zero cards is allowed.",
    "Planner Intent: " + s(ctx.planner_intent?.intent).slice(0, 240),
    "Do not rebuild the week. Do not copy a rail as a post template. Do not remake Core Thought.",
    "Use x_search and web_search only to check public current facts. Do not copy other posts as the draft. Do not invent lived experience.",
    s(options.retry_hint)
      ? "BOUNDARY RETRY: previous draft failed a minimum boundary (" + s(options.retry_hint).slice(0, 180) + "). Keep the same seed and locked Core Thought, then write a valid post."
      : "",
    "Respond with JSON only: {\"core_thought\":\"...\",\"from_current_seed\":true,\"boundary_ok\":true,\"post\":\"...\"}. Stop when the thought is complete.",
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timeoutMs = options.timeout_ms ?? 45000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "grok-4.6",
        instructions: system,
        input: [{ role: "user", content: userMsg }],
        tools: [{ type: "x_search" }, { type: "web_search" }],
        temperature: options.temperature ?? 0.7,
        max_output_tokens: 1400,
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });
    const rawText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        text: "",
        error: `xai_http_${response.status}:${rawText.slice(0, 180)}`,
        attempted: true,
      };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { ok: false, text: "", error: "xai_json_parse_failed", attempted: true };
    }
    const content = extractXaiResponsesText(parsed);
    if (!content || content.length < 4) {
      return { ok: false, text: "", error: "xai_empty_content", attempted: true };
    }
    const parsedOut = parseAgentSeungPostOutput(content);
    return {
      ok: true,
      text: parsedOut.post,
      error: null,
      attempted: true,
      core_thought: parsedOut.core_thought,
      from_current_seed: parsedOut.from_current_seed,
      boundary_ok: parsedOut.boundary_ok,
    };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "xai_timeout" : s(e?.message, "xai_fetch_error").slice(0, 160);
    return { ok: false, text: "", error: msg, attempted: true };
  } finally {
    clearTimeout(timer);
  }
}

export const V11_THINK_TIMEOUT_MS = 18000;
export const V11_WRITE_TIMEOUT_MS = 22000;

export type ThinkCallResult = {
  ok: boolean;
  core_thought: string;
  from_current_seed: boolean;
  boundary_ok: boolean;
  error: string | null;
  attempted: boolean;
};

/** THINK only. Does not write. Does not search Collections. */
export async function callGrokThink(
  ctx: DeepGenerationContext,
  xaiKey: string,
  options: { model?: string; timeout_ms?: number } = {},
): Promise<ThinkCallResult> {
  const system = buildThinkOnlyInstructions(ctx);
  const userMsg = [
    "THINK from this seed and decide Core Thought only. Do not write the post. Collection is not on this call.",
    "Planner Intent: " + s(ctx.planner_intent?.intent).slice(0, 240),
    "Do not rebuild the week. Do not invent lived experience.",
    "Use x_search and web_search only to check public current facts.",
    "Respond with JSON only: {\"core_thought\":\"...\",\"from_current_seed\":true,\"boundary_ok\":true}.",
  ].join("\n");

  const controller = new AbortController();
  const timeoutMs = options.timeout_ms ?? V11_THINK_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "grok-4.6",
        instructions: system,
        input: [{ role: "user", content: userMsg }],
        tools: [{ type: "x_search" }, { type: "web_search" }],
        temperature: 0.6,
        max_output_tokens: 400,
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });
    const rawText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        core_thought: "",
        from_current_seed: true,
        boundary_ok: true,
        error: `xai_http_${response.status}:${rawText.slice(0, 180)}`,
        attempted: true,
      };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { ok: false, core_thought: "", from_current_seed: true, boundary_ok: true, error: "xai_json_parse_failed", attempted: true };
    }
    const content = extractXaiResponsesText(parsed);
    const thought = parseAgentSeungThinkOutput(content);
    if (!thought.core_thought) {
      return { ok: false, core_thought: "", from_current_seed: true, boundary_ok: true, error: "empty_core_thought", attempted: true };
    }
    return {
      ok: true,
      core_thought: thought.core_thought,
      from_current_seed: thought.from_current_seed,
      boundary_ok: thought.boundary_ok,
      error: null,
      attempted: true,
    };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "xai_timeout" : s(e?.message, "xai_fetch_error").slice(0, 160);
    return { ok: false, core_thought: "", from_current_seed: true, boundary_ok: true, error: msg, attempted: true };
  } finally {
    clearTimeout(timer);
  }
}

function validateOutput(
  text: string,
  ctx: DeepGenerationContext,
  markers: IndependentPostResult["plan_markers"],
): {
  ok: boolean;
  seed_fidelity: boolean;
  core_thought_preserved: boolean;
  factual_boundary_preserved: boolean;
  experience_boundary_preserved: boolean;
  reader_inference_preserved: boolean;
  compression_followed: boolean;
  stop_condition_followed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const subject = markers.seed_subject;

  const seedOk = true;

  let expOk = true;
  const expBound = ctx.experience_boundaries || {};
  const mustNot = !!(expBound as any).must_not_claim_first_person;
  const experienced = !!(expBound as any).creator_experienced;
  if (mustNot || !experienced) {
    for (const re of EXPERIENCE_FABRICATION_PATTERNS) {
      if (re.test(text)) {
        expOk = false;
        reasons.push("experience_fabrication");
        break;
      }
    }
  }

  const factualOk = !/\b\d{4,}원\b/.test(text) || subject.includes("원");
  if (!factualOk) reasons.push("possible_factual_invention");

  if (isFragmentOriginal(text)) reasons.push("too_short_original");
  if (isSubjectRestate(text, subject)) reasons.push("subject_restate");
  if (isGenericThesis(text)) reasons.push("generic_thesis");
  if (isTokenStutter(text)) reasons.push("token_stutter");
  if (isQuestionCloser(text)) reasons.push("question_closer");
  if (hasExpertJargon(text)) reasons.push("expert_jargon");
  if (/\[MANUAL_RAW\]|MANUAL_POST_TEXT:|<<<HISTORICAL>>>|RAW_PROSE_LEAK/.test(text)) {
    reasons.push("manual_text_leakage");
  }

  for (const re of FORCED_CTA_PATTERNS) {
    if (re.test(text)) {
      reasons.push("forced_cta_or_question");
      break;
    }
  }

  for (const re of AI_REPORT_PATTERNS) {
    if (re.test(text)) {
      reasons.push("ai_report_voice");
      break;
    }
  }

  const len = text.length;
  let compOk = true;
  if (markers.compression_target === "VERY_COMPRESSED" && len > 160) {
    compOk = false;
    reasons.push("compression_very_compressed_exceeded");
  }
  if (markers.compression_target === "COMPRESSED" && len > 240) {
    compOk = false;
    reasons.push("compression_compressed_exceeded");
  }

  let stopOk = true;
  if (markers.leave_inference_open && /그래서\s*결국/.test(text)) {
    stopOk = false;
    reasons.push("over_explained_with_inference_open");
  }

  const readerOk = !reasons.includes("forced_cta_or_question") && !reasons.includes("ai_report_voice");

  const hardFail =
    reasons.includes("experience_fabrication") ||
    reasons.includes("possible_factual_invention") ||
    reasons.includes("manual_text_leakage");

  return {
    ok: !hardFail && seedOk,
    seed_fidelity: seedOk,
    core_thought_preserved: seedOk,
    factual_boundary_preserved: factualOk,
    experience_boundary_preserved: expOk,
    reader_inference_preserved: readerOk,
    compression_followed: compOk,
    stop_condition_followed: stopOk,
    reasons,
  };
}

export const MIN_ORIGINAL_CHARS = 28;
const STUTTER_RE = /([A-Za-z가-힣]{1,8})(?:\s+\1){2,}/;
const GENERIC_THESIS_RE =
  /중요한\s*이슈|관심이\s*쏠|주목할\s*만|향후\s*전망|변화가\s*있|의미가\s*크다|생각해볼\s*필요/;

export function isTokenStutter(text: string): boolean {
  const t = String(text || "");
  if (STUTTER_RE.test(t)) return true;
  const entEn = (t.match(/\bent\b/gi) || []).length;
  const entKo = (t.match(/엔트/g) || []).length;
  return entEn + entKo >= 2;
}

function normForCompare(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^0-9A-Za-z가-힣]+/g, "")
    .trim();
}

export function isFragmentOriginal(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length < MIN_ORIGINAL_CHARS) return true;
  if (/([A-Za-z가-힣])\1{4,}/.test(t)) return true;
  const ended = /[다요죠네음임]\s*[.!?…]*$/.test(t) || /[.!?]$/.test(t);
  if (!ended && t.length < 72) return true;
  return false;
}

export function isTooShortOriginal(text: string): boolean {
  return isFragmentOriginal(text);
}

export function isSubjectRestate(text: string, subject: string): boolean {
  const body = normForCompare(text);
  const sub = normForCompare(subject);
  if (!body || !sub || sub.length < 6) return false;
  if (body === sub) return true;
  if (body.startsWith(sub) && body.length - sub.length < 10) return true;
  if (sub.startsWith(body) && sub.length - body.length < 8) return true;
  return false;
}

export function isGenericThesis(text: string): boolean {
  return GENERIC_THESIS_RE.test(String(text || ""));
}

export function isQuestionCloser(text: string): boolean {
  return isEngagementBaitCloser(text);
}

function blockedResult(
  ctx: DeepGenerationContext | null,
  status: IndependentGenerationStatus,
  reasons: string[],
  writer: Partial<Pick<IndependentPostResult, "writer_mode" | "writer_call_attempted" | "writer_call_succeeded" | "writer_error">> = {},
): IndependentPostResult {
  const slot = ctx?.slot_id || "UNKNOWN";
  const cid = ctx?.context_id || "UNKNOWN";
  return {
    slot_id: slot,
    context_id: cid,
    final_text: "",
    generation_status: status,
    generation_confidence: 0,
    seed_fidelity: false,
    core_thought_preserved: false,
    factual_boundary_preserved: true,
    experience_boundary_preserved: true,
    reader_inference_preserved: true,
    compression_followed: false,
    stop_condition_followed: false,
    generation_version: ORDER7B_VERSION,
    plan_markers: {
      seed_subject: subjectFromCtx(ctx as DeepGenerationContext),
      core_axis: "",
      mechanism_flexible: true,
      rail_flexible: true,
      humor_mode: "NONE",
      compression_target: (ctx?.compression_target as CompressionTarget) || "NATURAL",
      stop_punchline: false,
      leave_inference_open: true,
      prefer_broad_simple: true,
      question_required: false,
      cta_required: false,
    },
    block_reasons: reasons,
    order7b_version: ORDER7B_VERSION,
    order7a_context_version: ORDER7A_VERSION,
    writer_mode: writer.writer_mode || "none",
    writer_call_attempted: writer.writer_call_attempted === true,
    writer_call_succeeded: writer.writer_call_succeeded === true,
    writer_error: writer.writer_error ?? null,
  };
}

/**
 * Primary entry: one context → one independent result (async for live Grok).
 * Never accepts sibling contexts or recent drafts.
 * Production default: live Grok 4.6 when XAI_API_KEY present; dry_run only if explicit.
 * Production path require live Grok. API failure → empty final_text + GENERATION_RETRY_REQUIRED (no fake text).
 */
export async function generateIndependentPost(
  ctx: DeepGenerationContext | null | undefined,
  options: GenerateIndependentOptions = {},
): Promise<IndependentPostResult> {
  if (!ctx || !ctx.context_id) {
    return blockedResult(null, "GENERATION_BLOCKED", ["missing_context"]);
  }
  if (!isGenerationContextWritable(ctx)) {
    return blockedResult(ctx, "GENERATION_CONTEXT_NOT_WRITABLE", [
      "context_status:" + s(ctx.generation_status, "unknown"),
    ]);
  }
  const subject = subjectFromCtx(ctx);
  if (!subject || subject.length < 2) {
    return blockedResult(ctx, "GENERATION_SEED_INSUFFICIENT", ["no_seed_subject"]);
  }
  if (ctx.core_thought?.status === "CORE_THOUGHT_BLOCKED") {
    return blockedResult(ctx, "GENERATION_BLOCKED", ["core_thought_blocked"]);
  }

  const markers = buildWriterPlanMarkers(ctx);
  const explicitDry = options.dry_run === true;
  const key = s(options.xai_key);

  // Explicit dry_run: constrained offline only (tests / diagnostics)
  if (explicitDry) {
    const text = composeConstrainedText(ctx, markers);
    const v = validateOutput(text, ctx, markers);
    if (!v.ok) {
      return {
        ...blockedResult(ctx, v.reasons.includes("experience_fabrication")
          ? "GENERATION_BOUNDARY_VIOLATION"
          : "GENERATION_RETRY_REQUIRED", v.reasons, {
          writer_mode: "dry_run",
          writer_call_attempted: false,
          writer_call_succeeded: false,
          writer_error: null,
        }),
        seed_fidelity: v.seed_fidelity,
        core_thought_preserved: v.core_thought_preserved,
        factual_boundary_preserved: v.factual_boundary_preserved,
        experience_boundary_preserved: v.experience_boundary_preserved,
        reader_inference_preserved: v.reader_inference_preserved,
        compression_followed: v.compression_followed,
        stop_condition_followed: v.stop_condition_followed,
        plan_markers: markers,
        generation_confidence: 0.2,
      };
    }
    return {
      slot_id: ctx.slot_id,
      context_id: ctx.context_id,
      final_text: text,
      generation_status: "GENERATED",
      generation_confidence: clamp01(0.55 + (ctx.core_thought?.confidence || 0) * 0.35),
      seed_fidelity: v.seed_fidelity,
      core_thought_preserved: v.core_thought_preserved,
      factual_boundary_preserved: v.factual_boundary_preserved,
      experience_boundary_preserved: v.experience_boundary_preserved,
      reader_inference_preserved: v.reader_inference_preserved,
      compression_followed: v.compression_followed,
      stop_condition_followed: v.stop_condition_followed,
      generation_version: ORDER7B_VERSION,
      plan_markers: markers,
      block_reasons: [],
      order7b_version: ORDER7B_VERSION,
      order7a_context_version: ORDER7A_VERSION,
      writer_mode: "dry_run",
      writer_call_attempted: false,
      writer_call_succeeded: false,
      writer_error: null,
    };
  }

  // Production path: live Grok 4.6 when XAI_API_KEY present; no silent offline fake fallback
  if (!key) {
    return blockedResult(ctx, "GENERATION_RETRY_REQUIRED", ["xai_key_missing"], {
      writer_mode: "no_key",
      writer_call_attempted: false,
      writer_call_succeeded: false,
      writer_error: "XAI_API_KEY_missing",
    });
  }

  let call = await callGrokWriter(ctx, key, {
    model: options.model,
    timeout_ms: options.timeout_ms,
    retry_hint: options.retry_hint,
  });

  let v = call.ok && call.text ? validateOutput(call.text, ctx, markers) : null;
  if ((!call.ok || !call.text || (v && !v.ok)) && options.allow_one_retry !== false) {
    const why = (v?.reasons || [call.error || "empty"]).filter(Boolean).join(",");
    call = await callGrokWriter(ctx, key, {
      model: options.model,
      timeout_ms: options.timeout_ms,
      retry_hint: why,
      temperature: 0.85,
    });
    v = call.ok && call.text ? validateOutput(call.text, ctx, markers) : null;
  }

  if (!call.ok || !call.text) {
    return blockedResult(ctx, "GENERATION_RETRY_REQUIRED", [
      "writer_call_failed",
      call.error || "empty",
    ], {
      writer_mode: "live_grok",
      writer_call_attempted: call.attempted,
      writer_call_succeeded: false,
      writer_error: call.error,
    });
  }

  if (!call.ok || !call.text || !v || !v.ok) {
    return {
      slot_id: ctx.slot_id,
      context_id: ctx.context_id,
      final_text: "",
      generation_status: v?.reasons.includes("experience_fabrication")
        ? "GENERATION_BOUNDARY_VIOLATION"
        : "GENERATION_RETRY_REQUIRED",
      generation_confidence: 0.25,
      seed_fidelity: v?.seed_fidelity ?? false,
      core_thought_preserved: v?.core_thought_preserved ?? false,
      factual_boundary_preserved: v?.factual_boundary_preserved ?? true,
      experience_boundary_preserved: v?.experience_boundary_preserved ?? true,
      reader_inference_preserved: v?.reader_inference_preserved ?? true,
      compression_followed: v?.compression_followed ?? false,
      stop_condition_followed: v?.stop_condition_followed ?? false,
      generation_version: ORDER7B_VERSION,
      plan_markers: markers,
      block_reasons: v?.reasons || ["writer_call_failed"],
      order7b_version: ORDER7B_VERSION,
      order7a_context_version: ORDER7A_VERSION,
      writer_mode: "live_grok",
      writer_call_attempted: true,
      writer_call_succeeded: true,
      writer_error: null,
      agent_core_thought: call.core_thought || "",
      from_current_seed: call.from_current_seed !== false,
      boundary_ok: call.boundary_ok !== false,
    };
  }

  return {
    slot_id: ctx.slot_id,
    context_id: ctx.context_id,
    final_text: call.text,
    generation_status: "GENERATED",
    generation_confidence: clamp01(0.7 + (ctx.core_thought?.confidence || 0) * 0.25),
    seed_fidelity: v.seed_fidelity,
    core_thought_preserved: v.core_thought_preserved,
    factual_boundary_preserved: v.factual_boundary_preserved,
    experience_boundary_preserved: v.experience_boundary_preserved,
    reader_inference_preserved: v.reader_inference_preserved,
    compression_followed: v.compression_followed,
    stop_condition_followed: v.stop_condition_followed,
    generation_version: ORDER7B_VERSION,
    plan_markers: markers,
    block_reasons: [],
    order7b_version: ORDER7B_VERSION,
    order7a_context_version: ORDER7A_VERSION,
    writer_mode: "live_grok",
    writer_call_attempted: true,
    writer_call_succeeded: true,
    writer_error: null,
    agent_core_thought: call.core_thought || "",
    from_current_seed: call.from_current_seed !== false,
    boundary_ok: call.boundary_ok !== false,
  };
}

/**
 * Batch transport helper: map each context independently (async).
 * Does not share creative state between iterations.
 */
export async function generateIndependentPostBatch(
  contexts: Array<DeepGenerationContext | null | undefined>,
  options: GenerateIndependentOptions = {},
): Promise<IndependentPostResult[]> {
  const out: IndependentPostResult[] = [];
  for (const ctx of contexts) {
    out.push(await generateIndependentPost(ctx, options));
  }
  return out;
}

export function isIndependentGenerationSuccess(r: IndependentPostResult): boolean {
  return r.generation_status === "GENERATED" && !!r.final_text && r.block_reasons.length === 0;
}
