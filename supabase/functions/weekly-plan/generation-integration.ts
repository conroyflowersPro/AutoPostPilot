/**
 * ORDER 7C — Generation Integration & Hardening
 * Weekly slot completeness: retry → recovery/BLOCKED → completion gate.
 * Never silently drop slots. Preserve slot_id / upstream decisions on retry.
 * No Semantic Judge (ORDER 8). No new external supplementation.
 */
import type { DeepGenerationContext } from "./deep-generation-context.ts";
import {
  generateIndependentPost,
  type IndependentPostResult,
  type GenerateIndependentOptions,
  ORDER7B_VERSION,
} from "./independent-post-generation.ts";

export const ORDER7C_VERSION = "generation_integration_hardening_v1_order7c";
export const ORDER7C_MAX_GENERATION_ATTEMPTS = 2 as const;
export const ORDER7C_SILENT_SLOT_DROP_FORBIDDEN = true as const;
export const ORDER7C_RETURNED_EQUALS_REQUESTED = true as const;
export const ORDER7C_BLOCKED_STILL_RETURNED = true as const;
export const ORDER7C_RETRY_PRESERVES_UPSTREAM = true as const;
export const ORDER7C_NO_SEED_SWAP_ON_RETRY = true as const;
export const ORDER7C_NO_FAKE_FALLBACK_TEXT = true as const;
export const ORDER7C_COMPLETION_GATE = true as const;
export const ORDER7C_STRUCTURAL_REPETITION_AUDIT = true as const;

export type SlotLifecycleStatus =
  | "PENDING"
  | "CONTEXT_READY"
  | "GENERATION_ATTEMPTED"
  | "GENERATED"
  | "RETRY_REQUIRED"
  | "RECOVERY_PENDING"
  | "RECOVERED"
  | "BLOCKED";

export type IntegratedSlotResult = {
  slot_id: string;
  context_id: string;
  seed_id: string;
  final_text: string;
  generation_status: IndependentPostResult["generation_status"] | "BLOCKED" | "RECOVERED";
  lifecycle_status: SlotLifecycleStatus;
  generation_attempts: number;
  recovery_used: boolean;
  recovery_type: "none" | "same_seed_retry" | "blocked_explicit";
  seed_replaced: boolean;
  writer_mode: IndependentPostResult["writer_mode"] | "none";
  writer_call_attempted: boolean;
  writer_call_succeeded: boolean;
  writer_error: string | null;
  seed_fidelity: boolean;
  core_thought_preserved: boolean;
  experience_boundary_preserved: boolean;
  factual_boundary_preserved: boolean;
  compression_followed: boolean;
  stop_condition_followed: boolean;
  independent: IndependentPostResult | null;
  block_reasons: string[];
  order7c_version: string;
  order7b_version: string;
};

export type WeeklyCompletionGate = {
  requested_slots: number;
  returned_slots: number;
  generated_slots: number;
  recovered_slots: number;
  blocked_slots: number;
  retry_slots: number;
  missing_slots: number;
  duplicate_slot_ids: string[];
  empty_generated_count: number;
  count_integrity_pass: boolean;
  silent_drop_detected: boolean;
  structural_repetition_flags: string[];
  order7c_version: string;
};

export const ORDER7C_GUARDS = {
  version: ORDER7C_VERSION,
  max_attempts: ORDER7C_MAX_GENERATION_ATTEMPTS,
  silent_slot_drop_forbidden: ORDER7C_SILENT_SLOT_DROP_FORBIDDEN,
  returned_equals_requested: ORDER7C_RETURNED_EQUALS_REQUESTED,
  blocked_still_returned: ORDER7C_BLOCKED_STILL_RETURNED,
  retry_preserves_upstream: ORDER7C_RETRY_PRESERVES_UPSTREAM,
  no_seed_swap_on_retry: ORDER7C_NO_SEED_SWAP_ON_RETRY,
  no_fake_fallback_text: ORDER7C_NO_FAKE_FALLBACK_TEXT,
  completion_gate: ORDER7C_COMPLETION_GATE,
  structural_repetition_audit: ORDER7C_STRUCTURAL_REPETITION_AUDIT,
} as const;

function mapLifecycle(status: string, attempts: number, recovery: boolean): SlotLifecycleStatus {
  if (status === "GENERATED" && recovery) return "RECOVERED";
  if (status === "GENERATED") return "GENERATED";
  if (status === "GENERATION_RETRY_REQUIRED" || status === "GENERATION_BOUNDARY_VIOLATION") {
    return attempts >= ORDER7C_MAX_GENERATION_ATTEMPTS ? "BLOCKED" : "RETRY_REQUIRED";
  }
  if (status === "GENERATION_BLOCKED" || status === "GENERATION_CONTEXT_NOT_WRITABLE" || status === "GENERATION_SEED_INSUFFICIENT") {
    return "BLOCKED";
  }
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "RECOVERED") return "RECOVERED";
  return attempts > 0 ? "GENERATION_ATTEMPTED" : "CONTEXT_READY";
}

/**
 * Primary + retry (same DeepGenerationContext / upstream decisions).
 * Does not swap Seed/Mechanism/Rail/Style/Humor on retry.
 * On final failure returns BLOCKED with empty final_text — slot still present.
 */
export async function integrateSlotGeneration(
  ctx: DeepGenerationContext,
  options: GenerateIndependentOptions & { seed_id?: string } = {},
): Promise<IntegratedSlotResult> {
  const seedId = options.seed_id || (ctx as any).seed_identity?.seed_id || ctx.slot_id || "unknown";
  let attempts = 0;
  let last: IndependentPostResult | null = null;
  let recoveryUsed = false;
  let recoveryType: IntegratedSlotResult["recovery_type"] = "none";

  attempts = 1;
  last = await generateIndependentPost(ctx, {
    dry_run: options.dry_run === true,
    openai_key: options.openai_key,
    model: options.model,
    allow_one_retry: false,
    timeout_ms: options.timeout_ms,
    retry_hint: options.retry_hint,
  });

  if (last.generation_status === "GENERATED" && last.final_text) {
    return packageResult(ctx, seedId, last, attempts, false, "none");
  }

  // Same-request retry doubles writer wall time. writeOneSlot allows one retry
  // (2 parallel slots × 16s × 2 attempts ≈ 32s, under the Edge ~60s budget).
  // Second attempt gets a quality rewrite hint from the first failure.
  if (attempts < ORDER7C_MAX_GENERATION_ATTEMPTS && options.allow_one_retry !== false) {
    attempts = 2;
    recoveryUsed = true;
    recoveryType = "same_seed_retry";
    last = await generateIndependentPost(ctx, {
      dry_run: options.dry_run === true,
      openai_key: options.openai_key,
      model: options.model,
      allow_one_retry: false,
      timeout_ms: options.timeout_ms,
      retry_hint: (last.block_reasons || []).filter(Boolean).join(",") || "quality_rewrite",
    });
    if (last.generation_status === "GENERATED" && last.final_text) {
      return packageResult(ctx, seedId, last, attempts, true, "same_seed_retry");
    }
  }

  recoveryType = "blocked_explicit";
  const blocked: IndependentPostResult = last || {
    slot_id: ctx.slot_id,
    context_id: ctx.context_id,
    final_text: "",
    generation_status: "GENERATION_RETRY_REQUIRED",
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
      seed_subject: "",
      core_axis: "",
      mechanism_flexible: true,
      rail_flexible: true,
      humor_mode: "NONE",
      compression_target: ctx.compression_target || "NATURAL",
      stop_punchline: false,
      leave_inference_open: true,
      prefer_broad_simple: true,
      question_required: false,
      cta_required: false,
    },
    block_reasons: ["unrecoverable_after_retry"],
    order7b_version: ORDER7B_VERSION,
    order7a_context_version: (ctx as any).order7a_version || "",
    writer_mode: "none",
    writer_call_attempted: false,
    writer_call_succeeded: false,
    writer_error: null,
  };

  return {
    slot_id: ctx.slot_id,
    context_id: ctx.context_id,
    seed_id: seedId,
    final_text: "",
    generation_status: "BLOCKED",
    lifecycle_status: "BLOCKED",
    generation_attempts: attempts,
    recovery_used: recoveryUsed,
    recovery_type: recoveryType,
    seed_replaced: false,
    writer_mode: blocked.writer_mode || "none",
    writer_call_attempted: !!blocked.writer_call_attempted,
    writer_call_succeeded: !!blocked.writer_call_succeeded,
    writer_error: blocked.writer_error || null,
    seed_fidelity: blocked.seed_fidelity,
    core_thought_preserved: blocked.core_thought_preserved,
    experience_boundary_preserved: blocked.experience_boundary_preserved,
    factual_boundary_preserved: blocked.factual_boundary_preserved,
    compression_followed: blocked.compression_followed,
    stop_condition_followed: blocked.stop_condition_followed,
    independent: blocked,
    block_reasons: [...(blocked.block_reasons || []), "order7c_blocked_after_max_attempts"],
    order7c_version: ORDER7C_VERSION,
    order7b_version: ORDER7B_VERSION,
  };
}

function packageResult(
  ctx: DeepGenerationContext,
  seedId: string,
  r: IndependentPostResult,
  attempts: number,
  recoveryUsed: boolean,
  recoveryType: IntegratedSlotResult["recovery_type"],
): IntegratedSlotResult {
  const status = recoveryUsed && r.generation_status === "GENERATED" ? "RECOVERED" : r.generation_status;
  return {
    slot_id: ctx.slot_id,
    context_id: ctx.context_id,
    seed_id: seedId,
    final_text: r.final_text || "",
    generation_status: status as IntegratedSlotResult["generation_status"],
    lifecycle_status: mapLifecycle(String(status), attempts, recoveryUsed),
    generation_attempts: attempts,
    recovery_used: recoveryUsed,
    recovery_type: recoveryType,
    seed_replaced: false,
    writer_mode: r.writer_mode || "none",
    writer_call_attempted: !!r.writer_call_attempted,
    writer_call_succeeded: !!r.writer_call_succeeded,
    writer_error: r.writer_error || null,
    seed_fidelity: r.seed_fidelity,
    core_thought_preserved: r.core_thought_preserved,
    experience_boundary_preserved: r.experience_boundary_preserved,
    factual_boundary_preserved: r.factual_boundary_preserved,
    compression_followed: r.compression_followed,
    stop_condition_followed: r.stop_condition_followed,
    independent: r,
    block_reasons: r.block_reasons || [],
    order7c_version: ORDER7C_VERSION,
    order7b_version: ORDER7B_VERSION,
  };
}

function firstSentence(t: string): string {
  const s = String(t || "").trim().split(/[\n.!?]/)[0] || "";
  return s.slice(0, 40).toLowerCase();
}
function endingCadence(t: string): string {
  const lines = String(t || "").trim().split(/\n/).filter(Boolean);
  const last = lines[lines.length - 1] || "";
  return last.slice(-24).toLowerCase();
}

export function evaluateWeeklyCompletionGate(
  slots: Array<{
    slotId?: string;
    slot_id?: string;
    final_text?: string;
    generation_status?: string;
    lifecycle_status?: string;
    generation_attempts?: number;
  }>,
  requested: number,
): WeeklyCompletionGate {
  const ids = slots.map((s) => String(s.slotId || s.slot_id || ""));
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) dups.push(id);
    else seen.add(id);
  }

  let generated = 0;
  let recovered = 0;
  let blocked = 0;
  let retry = 0;
  let emptyGenerated = 0;
  for (const s of slots) {
    const st = String(s.generation_status || s.lifecycle_status || "");
    const text = String(s.final_text || "");
    if (st === "GENERATED" || st === "RECOVERED") {
      if (st === "RECOVERED") recovered++;
      else generated++;
      if (!text) emptyGenerated++;
    } else if (st === "BLOCKED" || st === "GENERATION_BLOCKED") {
      blocked++;
    } else if (st.includes("RETRY") || st === "RETRY_REQUIRED") {
      retry++;
    } else if (!text) {
      blocked++;
    } else {
      generated++;
    }
  }

  const flags: string[] = [];
  const firsts = new Map<string, number>();
  const ends = new Map<string, number>();
  for (const s of slots) {
    const t = String(s.final_text || "");
    if (t.length < 8) continue;
    const f = firstSentence(t);
    const e = endingCadence(t);
    if (f.length >= 8) firsts.set(f, (firsts.get(f) || 0) + 1);
    if (e.length >= 8) ends.set(e, (ends.get(e) || 0) + 1);
  }
  for (const [k, n] of firsts) {
    if (n >= 4) flags.push(`first_sentence_repeat:${n}`);
  }
  for (const [k, n] of ends) {
    if (n >= 4) flags.push(`ending_cadence_repeat:${n}`);
  }

  const returned = slots.length;
  const missing = Math.max(0, requested - returned);
  const silentDrop = returned < requested;
  const countOk = returned === requested && dups.length === 0 && emptyGenerated === 0;

  return {
    requested_slots: requested,
    returned_slots: returned,
    generated_slots: generated,
    recovered_slots: recovered,
    blocked_slots: blocked,
    retry_slots: retry,
    missing_slots: missing,
    duplicate_slot_ids: dups,
    empty_generated_count: emptyGenerated,
    count_integrity_pass: countOk && !silentDrop,
    silent_drop_detected: silentDrop,
    structural_repetition_flags: flags.slice(0, 12),
    order7c_version: ORDER7C_VERSION,
  };
}

export function ensureSlotCountPreserved<T extends Record<string, unknown>>(
  posts: T[],
  requested: number,
  makeBlocked: (index: number) => T,
): T[] {
  const out = posts.slice();
  while (out.length < requested) {
    out.push(makeBlocked(out.length));
  }
  return out;
}

export function isIntegratedSuccess(r: IntegratedSlotResult): boolean {
  return (r.generation_status === "GENERATED" || r.generation_status === "RECOVERED") && !!r.final_text;
}
