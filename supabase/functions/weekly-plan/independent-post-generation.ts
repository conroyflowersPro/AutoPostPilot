/**
 * ORDER 7B — Independent Per-Post Generation
 * One DeepGenerationContext in → one IndependentPostResult out.
 * Batch transport allowed; batch reasoning forbidden.
 * Production default = ChatGPT (OpenAI) writer when OPENAI_API_KEY present.
 * Seed quota/expand stay on Grok (xAI). dry_run = explicit test/diagnostics only.
 */
import type {
  DeepGenerationContext,
  CoreThought,
  CompressionTarget,
  GenerationStatus as ContextGenerationStatus,
} from "./deep-generation-context.ts";
import { isGenerationContextWritable, ORDER7A_VERSION } from "./deep-generation-context.ts";
import { isPersonalInterestSubject, lengthBandForMode } from "./seed-scope.ts";

export const ORDER7B_VERSION = "independent_post_generation_v1_chatgpt_writer";
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
export const ORDER7B_LIVE_CHATGPT_WRITER = true as const;
export const ORDER7B_PRODUCTION_DEFAULT_LIVE = true as const;
export const ORDER7B_NO_FAKE_FALLBACK_TEXT = true as const;

export type IndependentGenerationStatus =
  | "GENERATED"
  | "GENERATION_RETRY_REQUIRED"
  | "GENERATION_BLOCKED"
  | "GENERATION_CONTEXT_NOT_WRITABLE"
  | "GENERATION_SEED_INSUFFICIENT"
  | "GENERATION_BOUNDARY_VIOLATION";

export type WriterMode = "live_chatgpt" | "dry_run" | "no_key" | "none";

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
};

export type GenerateIndependentOptions = {
  /** Explicit only — production default is live when key present */
  dry_run?: boolean;
  openai_key?: string | null;
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
  live_chatgpt_writer: ORDER7B_LIVE_CHATGPT_WRITER,
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
];

const EXPERIENCE_FABRICATION_PATTERNS = [
  /제가\s*직접\s*써보니/,
  /어제\s*해봤는데/,
  /운전하다가/,
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
 * Constraint-only system instructions for the live ChatGPT writer.
 * No finished examples, no templates, no CTA, no fabrication.
 */
export function buildConstraintOnlyWriterInstructions(ctx: DeepGenerationContext): string {
  const subject = subjectFromCtx(ctx);
  const core = ctx.core_thought;
  const mode = humorMode(ctx);
  const comp = ctx.compression_target || "NATURAL";
  const leaveOpen = !!ctx.stop_condition?.leave_inference_open;
  const punchStop = !!ctx.stop_condition?.punchline_stop_ok;
  const expBound = ctx.experience_boundaries || {};
  const mustNotFirstPerson = !!(expBound as any).must_not_claim_first_person;
  const experienced = !!(expBound as any).creator_experienced;
  const editorialMode = s((ctx as any).seed_identity?.editorial_mode || (ctx as any).editorial_mode);
  const cluster = s((ctx as any).seed_identity?.cluster || (ctx as any).cluster);
  const personal = isPersonalInterestSubject(subject, cluster);

  return [
    "You write one Korean X post for creator @Seung4680.",
    "Use ONLY the provided structured decisions. Do not invent lived experiences or private facts.",
    "REASONING ORDER (internal only; do not output steps):",
    "1) Confirm Seed meaning. A short keyword seed is valid — infer a public-agreeable situation through Creator DNA vision. Do not invent first-person experience. Do not paste hardcoded example posts or example seed bodies.",
    "2) Interpret Core Thought as writing intent — do not paste Core Thought labels as prose.",
    "3) Keep reader self-projection space; never force questions or CTA. Do not hard-assert the creator's opinion — leave judgment to the reader so they can reply.",
    "4) Reference the selected Reaction Mechanism as the reader-entry structure — never name it or template it.",
    "5) Thinking Rail guides thought order only — never force fixed paragraph count.",
    "6) Audience is readers, not followers and not a Tesla club. Low entry barrier is wording AND the range of wording. Prefer words general readers and the X algorithm catch, but NEVER swap a word if it would change the claim.",
    "PLACE: Creator lives in California. Write Korean. Use US/CA daily situations. Do not invent Korea-only civic life (이중주차, 관리사무소, 주민센터, 배민, 따릉이, 전세/청약).",
    "7) Apply Creator Style as surface register — not a fixed template. Register follows this post's character (editorial mode), not a single global ending.",
    "8) Humor: " + mode + " — if NONE, do not force jokes, ㅋㅋ, or punchlines.",
    "9) QUALITY: write a finished observation of a specific situation. A snag is optional — only if the seed already has one. Do not require conflict. Do not stop at the keyword name.",
    "10) One complete sentence is enough if the situation is delivered. Do not add a dummy second sentence. Do not stop mid-token. No grand thesis tail.",
    "LENGTH: " + lengthBandForMode(editorialMode),
    "INFORMATIVE/COMPARE register: polite 해요/존칭. Do not use 음슴체 on information posts.",
    "INFORMATIVE scope: general public. Avoid expert-only site/factory names when a broader accurate phrase exists. Do not distort the fact to sound broader.",
    "TENSION: if the seed has lived urgency, show the tension. If the situation also resolved, that can make the post informative. Do not preach a verdict.",
    "MIX: do not write only keep-worthy archive posts. Variety across the week is how bookmarks are sought.",
    "FORBIDDEN: finished examples, hardcoded sample posts, token stutter (ent ent ent / 같은 음절 반복), restating the subject as the whole post, generic filler (중요하다/관심이 쏠린다), copy of manual posts, invented first-person experience, forced CTA/questions, AI/report conclusions.",
    s((ctx as any).voice_register?.constraint_line) ||
      "USER_DIRECT REGISTER: infer from recent handmade stats if provided; never from archive; never install a question for the algorithm.",
    "SEED SUBJECT: " + subject.slice(0, 200),
    "CORE AXIS (not literal sentence): " + s(core?.primary_claim).slice(0, 120),
    "TENSION HINT: " + s(core?.tension).slice(0, 100),
    "READER MEANING HINT: " + s(core?.reader_relevant_meaning).slice(0, 100),
    "EXPERIENCE: " + (experienced && !mustNotFirstPerson ? "limited first-person allowed only if already grounded" : "no fabricated first-person experience"),
    s((ctx as any).cite_episode_hint)
      ? "CITE RELATED: You MAY mention the prior lived episode by situation (e.g. 지난 야간 FSD 보행자 대기). Write a NEW related observation. FORBIDDEN: the same events, punchline, wording, or 동일 내용."
      : "",
    personal
      ? ""
      : "MASS PUBLIC SLOT: do not name Elon, Tesla, FSD, Cybertruck, or Robotaxi as the subject. Write the everyday public situation.",
    String((ctx as any).source_type || (ctx as any).source_kind || "").toUpperCase().includes("ADJACENT")
      ? "ADJACENT RING: mass public sectors (daily AI, phone/alerts, road/parking without a brand, living costs, queues, weather/out). Observation/opinion only. FORBIDDEN: first-person Tesla driving, Elon/Musk as subject, viral clone."
      : "",
    "LEAVE_INFERENCE_OPEN: " + String(leaveOpen),
    "PUNCHLINE_STOP: " + String(punchStop),
    "OUTPUT: Korean post text only. No JSON. No step labels. No English meta.",
  ].join("\n");
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
};

/**
 * ChatGPT /v1/chat/completions writer — one slot, constraint-only, no shared history.
 * Seed expand/quota stay on Grok. This function writes the original post body only.
 */
export async function callChatGptWriter(
  ctx: DeepGenerationContext,
  openaiKey: string,
  options: { model?: string; timeout_ms?: number; retry_hint?: string; temperature?: number } = {},
): Promise<WriterCallResult> {
  const system = buildConstraintOnlyWriterInstructions(ctx);
  const subject = subjectFromCtx(ctx);
  const tension = s(ctx.core_thought?.tension) || s((ctx as any).interpreted_meaning?.why_it_matters_now);
  const userMsg = [
    "Write the final Korean X post now.",
    "Situation: " + subject.slice(0, 160),
    tension
      ? "Optional angle (not required): " + tension.slice(0, 140)
      : "If this is only a keyword, infer a public-agreeable situation through Creator vision. Do not require a snag. Do not write the keyword as the whole post.",
    "One finished sentence is OK. Do not pad. Do not invent lived experience.",
    s(options.retry_hint)
      ? "QUALITY REWRITE: previous draft was rejected (" + s(options.retry_hint).slice(0, 180) + "). Rewrite as a finished observation. One sentence is enough. Do not stutter. Do not restate the subject as the whole post."
      : "",
    "Respond with post text only.",
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timeoutMs = options.timeout_ms ?? 25000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: 1400,
      }),
      signal: controller.signal,
    });
    const rawText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        text: "",
        error: `openai_http_${response.status}:${rawText.slice(0, 180)}`,
        attempted: true,
      };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { ok: false, text: "", error: "openai_json_parse_failed", attempted: true };
    }
    const content = s(parsed?.choices?.[0]?.message?.content);
    if (!content || content.length < 4) {
      return { ok: false, text: "", error: "openai_empty_content", attempted: true };
    }
    let text = content
      .replace(/^```[\s\S]*?```$/g, (m) => m.replace(/```\w*\n?/g, "").replace(/```/g, ""))
      .replace(/^["']|["']$/g, "")
      .trim();
    return { ok: true, text, error: null, attempted: true };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "openai_timeout" : s(e?.message, "openai_fetch_error").slice(0, 160);
    return { ok: false, text: "", error: msg, attempted: true };
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

  const seedOk =
    !subject ||
    subject.length < 4 ||
    text.includes(subject.slice(0, Math.min(12, subject.length))) ||
    subject.split(/\s+/).some((w) => w.length > 2 && text.includes(w));
  if (!seedOk) reasons.push("seed_fidelity_weak");

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

  const coreOk = !isFragmentOriginal(text) && !isSubjectRestate(text, subject) && !isGenericThesis(text);
  if (isFragmentOriginal(text)) reasons.push("too_short_original");
  if (isSubjectRestate(text, subject)) reasons.push("subject_restate");
  if (isGenericThesis(text)) reasons.push("generic_thesis");
  if (isTokenStutter(text)) reasons.push("token_stutter");

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
    reasons.includes("forced_cta_or_question") ||
    reasons.includes("ai_report_voice") ||
    reasons.includes("token_stutter") ||
    reasons.includes("too_short_original") ||
    reasons.includes("subject_restate") ||
    reasons.includes("generic_thesis");

  return {
    ok: !hardFail && seedOk && coreOk,
    seed_fidelity: seedOk,
    core_thought_preserved: coreOk,
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
 * Primary entry: one context → one independent result (async for live ChatGPT).
 * Never accepts sibling contexts or recent drafts.
 * Production default: live ChatGPT when OPENAI_API_KEY present; dry_run only if explicit.
 * API failure → empty final_text + GENERATION_RETRY_REQUIRED (no fake text).
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
  const key = s(options.openai_key);

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

  // Production path: require live ChatGPT when key present; no silent offline fake fallback
  if (!key) {
    return blockedResult(ctx, "GENERATION_RETRY_REQUIRED", ["openai_key_missing"], {
      writer_mode: "no_key",
      writer_call_attempted: false,
      writer_call_succeeded: false,
      writer_error: "OPENAI_API_KEY_missing",
    });
  }

  let call = await callChatGptWriter(ctx, key, {
    model: options.model,
    timeout_ms: options.timeout_ms,
    retry_hint: options.retry_hint,
  });

  let v = call.ok && call.text ? validateOutput(call.text, ctx, markers) : null;
  if ((!call.ok || !call.text || (v && !v.ok)) && options.allow_one_retry !== false) {
    const why = (v?.reasons || [call.error || "empty"]).filter(Boolean).join(",");
    call = await callChatGptWriter(ctx, key, {
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
      writer_mode: "live_chatgpt",
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
      writer_mode: "live_chatgpt",
      writer_call_attempted: true,
      writer_call_succeeded: true,
      writer_error: null,
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
    writer_mode: "live_chatgpt",
    writer_call_attempted: true,
    writer_call_succeeded: true,
    writer_error: null,
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
