/**
 * ORDER 8C — Weekly Count Ledger + Completion Gate Hardening
 * Count integrity across planner → seed → generate → judge → regen → response → UI.
 * No new generation engine. No silent drop. No intermediate final states.
 */
export const ORDER8C_VERSION = "weekly_count_full_system_qa_v1_order8c";
export const ORDER8C_NO_SILENT_DROP = true as const;
export const ORDER8C_NO_UNRESOLVED_FINAL_STATE = true as const;
export const ORDER8C_NO_COUNT_ONLY_FAKE_SLOTS = true as const;
export const ORDER8C_PUBLISHABLE_SEPARATE_FROM_SLOT = true as const;
export const ORDER8C_BLOCKED_RETAINED = true as const;
export const ORDER8C_JUDGE_UNAVAILABLE_RETAINED = true as const;
export const ORDER8C_NO_FIXED_42 = true as const;
export const ORDER8C_NO_HARD_CAP_9 = true as const;

export type SlotFinalState =
  | "ACCEPTED_PASS"
  | "ACCEPTED_WITH_CONCERNS"
  | "REGENERATED_PASS"
  | "BLOCKED"
  | "JUDGE_UNAVAILABLE";

export type WeeklyCountLedger = {
  requested_slots: number;
  planner_slots: number;
  seeded_slots: number;
  context_ready_slots: number;
  generation_attempted_slots: number;
  initial_generated_slots: number;
  judged_slots: number;
  rejected_slots: number;
  regeneration_attempted_slots: number;
  regenerated_pass_slots: number;
  accepted_with_concerns_slots: number;
  initial_pass_slots: number;
  blocked_slots: number;
  judge_unavailable_slots: number;
  persisted_slots: number;
  response_slots: number;
  ui_visible_slots?: number;
  publishable_slots: number;
  missing_slots: number;
  duplicate_slot_ids: string[];
  count_integrity_pass: boolean;
  unresolved_final_states: number;
  hard_fail_accepted: number;
  order8c_version: string;
};

export type SlotLineage = {
  planner_slot_id: string;
  slot_id: string;
  seed_id: string | null;
  context_id: string | null;
  regeneration_context_ids: string[];
  generation_attempt_count: number;
  judge_attempt_count: number;
  regeneration_route_history: string[];
  final_state: SlotFinalState;
  persisted_id: string | null;
  response_index: number;
  final_text_length: number;
};

export type WeeklyQaWarning = {
  code: string;
  severity: "WARN" | "INFO";
  detail: string;
};

export type WeeklyPublicationSummary = {
  requested_slots: number;
  returned_slots: number;
  publishable_slots: number;
  blocked_slots: number;
  judge_unavailable_slots: number;
  initial_pass_slots: number;
  regenerated_pass_slots: number;
  accepted_with_concerns_slots: number;
  total_generation_attempts: number;
  total_judge_calls: number;
  total_regeneration_attempts: number;
  count_integrity_pass: boolean;
  hard_fail_accepted: number;
  weekly_quality_warnings: WeeklyQaWarning[];
  ledger: WeeklyCountLedger;
  lineages: SlotLineage[];
  order8c_version: string;
};

export const ORDER8C_GUARDS = {
  version: ORDER8C_VERSION,
  no_silent_drop: ORDER8C_NO_SILENT_DROP,
  no_unresolved_final_state: ORDER8C_NO_UNRESOLVED_FINAL_STATE,
  no_count_only_fake_slots: ORDER8C_NO_COUNT_ONLY_FAKE_SLOTS,
  publishable_separate: ORDER8C_PUBLISHABLE_SEPARATE_FROM_SLOT,
  blocked_retained: ORDER8C_BLOCKED_RETAINED,
  judge_unavailable_retained: ORDER8C_JUDGE_UNAVAILABLE_RETAINED,
  no_fixed_42: ORDER8C_NO_FIXED_42,
  no_hard_cap_9: ORDER8C_NO_HARD_CAP_9,
} as const;

const UNRESOLVED = new Set([
  "RETRY_REQUIRED",
  "PENDING",
  "RECOVERY_PENDING",
  "GENERATION_RETRY_REQUIRED",
  "GENERATION_ATTEMPTED",
  "CONTEXT_READY",
]);

const PUBLISHABLE = new Set<SlotFinalState>([
  "ACCEPTED_PASS",
  "ACCEPTED_WITH_CONCERNS",
  "REGENERATED_PASS",
]);

export function isPublishableFinalState(s: SlotFinalState): boolean {
  return PUBLISHABLE.has(s);
}

export function isTerminalFinalState(s: string): boolean {
  return (
    s === "ACCEPTED_PASS" ||
    s === "ACCEPTED_WITH_CONCERNS" ||
    s === "REGENERATED_PASS" ||
    s === "BLOCKED" ||
    s === "JUDGE_UNAVAILABLE"
  );
}

export function normalizeFinalState(slot: Record<string, unknown>): SlotFinalState {
  const explicit = String(slot.slot_final_state || slot.final_state || "").toUpperCase();
  if (isTerminalFinalState(explicit)) return explicit as SlotFinalState;

  const judge = String(slot.judge_status || slot.final_judge_status || "").toUpperCase();
  const gen = String(slot.generation_status || slot.lifecycle_status || "").toUpperCase();
  const text = String(slot.final_text || "");
  const regenAttempts = Number(slot.semantic_regen_attempts || 0);

  if (judge === "JUDGE_UNAVAILABLE") return "JUDGE_UNAVAILABLE";
  if (gen.includes("BLOCK") || explicit === "BLOCKED") return "BLOCKED";
  if (!text && (gen.includes("RETRY") || UNRESOLVED.has(gen))) return "BLOCKED";
  if (!text) return "BLOCKED";

  if (regenAttempts > 0 && (judge === "PASS" || judge === "PASS_WITH_CONCERNS")) {
    return "REGENERATED_PASS";
  }
  if (judge === "PASS_WITH_CONCERNS") return "ACCEPTED_WITH_CONCERNS";
  if (judge === "PASS" || gen === "GENERATED" || gen === "RECOVERED") return "ACCEPTED_PASS";
  if (judge === "REJECT") return "BLOCKED";
  return "BLOCKED";
}

export function computeCanonicalRequested(postsPerDay: number, daysCount: number): number {
  const ppd = Math.min(8, Math.max(5, Math.floor(Number(postsPerDay) || 6)));
  const days = Math.min(7, Math.max(1, Math.floor(Number(daysCount) || 7)));
  return ppd * days;
}

export function buildSlotLineage(
  slot: Record<string, unknown>,
  responseIndex: number,
): SlotLineage {
  const slotId = String(slot.slotId || slot.slot_id || `IDX${responseIndex}`);
  const plannerId = String(slot.planner_slot_id || slot.slotId || slot.slot_id || slotId);
  const routes = Array.isArray(slot.regeneration_route_history)
    ? (slot.regeneration_route_history as string[]).map(String)
    : slot.last_route
      ? [String(slot.last_route)]
      : [];
  const ctxIds = Array.isArray(slot.regeneration_context_ids)
    ? (slot.regeneration_context_ids as string[]).map(String)
    : [];
  const finalState = normalizeFinalState(slot);
  return {
    planner_slot_id: plannerId,
    slot_id: slotId,
    seed_id: slot.seed_id != null ? String(slot.seed_id) : null,
    context_id: slot.context_id != null ? String(slot.context_id) : null,
    regeneration_context_ids: ctxIds,
    generation_attempt_count: Number(slot.generation_attempts || slot.semantic_regen_attempts || 0) + 1,
    judge_attempt_count: Number(slot.judge_attempt_count || (slot.judge_call_attempted ? 1 : 0)) +
      Number(slot.semantic_regen_attempts || 0),
    regeneration_route_history: routes,
    final_state: finalState,
    persisted_id: slot.persisted_id != null ? String(slot.persisted_id) : null,
    response_index: responseIndex,
    final_text_length: String(slot.final_text || "").length,
  };
}

export function buildWeeklyCountLedger(args: {
  requested_slots: number;
  planner_slots?: number;
  slots: Record<string, unknown>[];
  persisted_slots?: number;
  ui_visible_slots?: number;
}): WeeklyCountLedger {
  const requested = Math.max(0, Math.floor(args.requested_slots));
  const slots = args.slots || [];
  const lineages = slots.map((s, i) => buildSlotLineage(s, i));

  const seen = new Set<string>();
  const dups: string[] = [];
  for (const L of lineages) {
    const id = L.slot_id;
    if (!id) continue;
    if (seen.has(id)) dups.push(id);
    else seen.add(id);
  }

  let initial_pass = 0;
  let accepted_concerns = 0;
  let regenerated_pass = 0;
  let blocked = 0;
  let ju = 0;
  let rejected = 0;
  let regen_attempted = 0;
  let judged = 0;
  let gen_attempted = 0;
  let initial_generated = 0;
  let unresolved = 0;
  let hard_fail_accepted = 0;

  for (const L of lineages) {
    gen_attempted++;
    judged++;
    if (L.regeneration_route_history.length > 0 || L.generation_attempt_count > 1) {
      regen_attempted++;
    }
    switch (L.final_state) {
      case "ACCEPTED_PASS":
        initial_pass++;
        initial_generated++;
        break;
      case "ACCEPTED_WITH_CONCERNS":
        accepted_concerns++;
        initial_generated++;
        break;
      case "REGENERATED_PASS":
        regenerated_pass++;
        initial_generated++;
        break;
      case "BLOCKED":
        blocked++;
        rejected++;
        break;
      case "JUDGE_UNAVAILABLE":
        ju++;
        break;
      default:
        unresolved++;
        blocked++;
    }
    if (L.final_state.startsWith("ACCEPTED") || L.final_state === "REGENERATED_PASS") {
      if (Number(slots[L.response_index]?.hard_fail_count || 0) > 0) hard_fail_accepted++;
    }
  }

  const returned = slots.length;
  const publishable = initial_pass + accepted_concerns + regenerated_pass;
  const missing = Math.max(0, requested - returned);
  const integrity =
    missing === 0 &&
    dups.length === 0 &&
    unresolved === 0 &&
    returned === requested;

  return {
    requested_slots: requested,
    planner_slots: args.planner_slots ?? requested,
    seeded_slots: returned,
    context_ready_slots: returned,
    generation_attempted_slots: gen_attempted,
    initial_generated_slots: initial_generated,
    judged_slots: judged,
    rejected_slots: rejected,
    regeneration_attempted_slots: regen_attempted,
    regenerated_pass_slots: regenerated_pass,
    accepted_with_concerns_slots: accepted_concerns,
    initial_pass_slots: initial_pass,
    blocked_slots: blocked,
    judge_unavailable_slots: ju,
    persisted_slots: args.persisted_slots ?? returned,
    response_slots: returned,
    ui_visible_slots: args.ui_visible_slots,
    publishable_slots: publishable,
    missing_slots: missing,
    duplicate_slot_ids: dups,
    count_integrity_pass: integrity,
    unresolved_final_states: unresolved,
    hard_fail_accepted,
    order8c_version: ORDER8C_VERSION,
  };
}

export function evaluateOrder8cCompletionGate(args: {
  requested_slots: number;
  planner_slots?: number;
  slots: Record<string, unknown>[];
  persisted_slots?: number;
  ui_visible_slots?: number;
}): { pass: boolean; ledger: WeeklyCountLedger; lineages: SlotLineage[]; reasons: string[] } {
  const ledger = buildWeeklyCountLedger(args);
  const lineages = (args.slots || []).map((s, i) => buildSlotLineage(s, i));
  const reasons: string[] = [];
  if (ledger.missing_slots > 0) reasons.push(`missing_slots:${ledger.missing_slots}`);
  if (ledger.duplicate_slot_ids.length) reasons.push(`duplicate_slot_ids:${ledger.duplicate_slot_ids.join(",")}`);
  if (ledger.unresolved_final_states > 0) reasons.push(`unresolved:${ledger.unresolved_final_states}`);
  if (ledger.response_slots !== ledger.requested_slots) {
    reasons.push(`response_ne_requested:${ledger.response_slots}/${ledger.requested_slots}`);
  }
  for (const L of lineages) {
    if (!isTerminalFinalState(L.final_state)) reasons.push(`non_terminal:${L.slot_id}:${L.final_state}`);
    if (
      (L.final_state === "ACCEPTED_PASS" ||
        L.final_state === "ACCEPTED_WITH_CONCERNS" ||
        L.final_state === "REGENERATED_PASS") &&
      L.final_text_length === 0
    ) {
      reasons.push(`empty_text_on_accepted:${L.slot_id}`);
    }
  }
  return {
    pass: reasons.length === 0 && ledger.count_integrity_pass,
    ledger,
    lineages,
    reasons,
  };
}

export function buildWeeklyPublicationSummary(args: {
  requested_slots: number;
  slots: Record<string, unknown>[];
  total_generation_attempts?: number;
  total_judge_calls?: number;
  total_regeneration_attempts?: number;
  quality_warnings?: WeeklyQaWarning[];
}): WeeklyPublicationSummary {
  const gate = evaluateOrder8cCompletionGate({
    requested_slots: args.requested_slots,
    slots: args.slots,
  });
  const warnings = args.quality_warnings || [];
  return {
    requested_slots: args.requested_slots,
    returned_slots: gate.ledger.response_slots,
    publishable_slots: gate.ledger.publishable_slots,
    blocked_slots: gate.ledger.blocked_slots,
    judge_unavailable_slots: gate.ledger.judge_unavailable_slots,
    initial_pass_slots: gate.ledger.initial_pass_slots,
    regenerated_pass_slots: gate.ledger.regenerated_pass_slots,
    accepted_with_concerns_slots: gate.ledger.accepted_with_concerns_slots,
    total_generation_attempts: args.total_generation_attempts ?? gate.ledger.generation_attempted_slots,
    total_judge_calls: args.total_judge_calls ?? gate.ledger.judged_slots,
    total_regeneration_attempts: args.total_regeneration_attempts ?? gate.ledger.regeneration_attempted_slots,
    count_integrity_pass: gate.pass,
    hard_fail_accepted: gate.ledger.hard_fail_accepted,
    weekly_quality_warnings: warnings,
    ledger: gate.ledger,
    lineages: gate.lineages,
    order8c_version: ORDER8C_VERSION,
  };
}

/** Make a blocked pad slot with stable identity — not a fake content post */
export function makeBlockedPadSlot(index: number, dayOffset = 0): Record<string, unknown> {
  const slotId = `D${dayOffset + 1}P${index + 1}`;
  return {
    slotId,
    planner_slot_id: slotId,
    slot_id: slotId,
    dayOffset,
    primaryTopic: "BLOCKED_SLOT",
    editorial_mode: "OBSERVATION",
    final_text: "",
    generation_status: "GENERATION_BLOCKED",
    slot_final_state: "BLOCKED",
    judge_status: "REJECT",
    seed_id: null,
    context_id: null,
    semantic_regen_attempts: 0,
    block_reasons: ["order8c_count_pad_blocked"],
    order8c_version: ORDER8C_VERSION,
  };
}

export function preserveSlotCountNoFakeContent(
  slots: Record<string, unknown>[],
  requested: number,
): Record<string, unknown>[] {
  const out = slots.slice();
  let i = out.length;
  while (out.length < requested) {
    out.push(makeBlockedPadSlot(i, Math.floor(i / 8)));
    i++;
  }
  return out;
}
