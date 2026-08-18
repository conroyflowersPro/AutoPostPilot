/**
 * Creator DNA judges seven-day AP slots: RETURN|BRIDGE|REACH + editorial type.
 * Audience DNA supplies X status only. Planner does not judge types.
 * REACH is 1 per day, max 2. PRESENCE is not a role.
 */
import { creatorDnaBlock } from "./engine-dna.ts";
import {
  callPlanner,
  clampWeekVolume,
  type PlannerCallResult,
  type PlannerSlotIntent,
} from "./seven-day-planner.ts";
import { QUOTA_PER_DAY_MIN, QUOTA_DAYS } from "./quota-inference.ts";
import type { EditorialMode } from "./seed-engine.ts";
import {
  audienceStatusBlock,
  type AudienceXStatus,
} from "./audience-x-status.ts";
import {
  planEvidenceForModel,
  planEvidenceForVolumeAndSlots,
  parsePlanEvidenceDigest,
  emptyPlanEvidenceDigest,
  type AgentSeungPlanEvidence,
  type PlanEvidenceDigest,
} from "./plan-evidence.ts";

function s(v: unknown, max = 240): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseSlotMode(v: unknown): EditorialMode | null {
  const value = s(v, 40).toUpperCase().replace(/\s+/g, "_");
  if (value === "OBSERVATION" || value === "CASUAL") return "CASUAL_OBSERVATION";
  const ok = ["INFORMATIVE", "COMPARE", "OPINION", "EXPERIENCE", "CASUAL_OBSERVATION"];
  return ok.includes(value) ? (value as EditorialMode) : null;
}

export type GrowthRole = "RETURN" | "BRIDGE" | "REACH";

export const REACH_PER_DAY_TARGET = 1;
export const REACH_PER_DAY_MAX = 2;

export function growthRole(v: unknown): GrowthRole | null {
  const value = s(v, 20).toUpperCase();
  if (value === "REACH") return "REACH";
  if (value === "BRIDGE") return "BRIDGE";
  if (value === "RETURN") return "RETURN";
  return null;
}

/** Constraint check only. Does not invent REACH or rewrite extra REACH. */
export function reachDailyConstraintOk<T extends { day_offset: number; strategic_role: string }>(
  slots: T[],
): boolean {
  const byDay = new Map<number, number>();
  const dayHas = new Set<number>();
  for (const slot of slots) {
    const day = Number(slot.day_offset);
    if (!Number.isFinite(day)) continue;
    dayHas.add(day);
    if (String(slot.strategic_role || "").toUpperCase() === "REACH") {
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
  }
  for (const day of dayHas) {
    const n = byDay.get(day) || 0;
    if (n < 1 || n > REACH_PER_DAY_MAX) return false;
  }
  return true;
}

function creatorDaySlotsSystem(days: number[], perDay: number[]): string {
  const spec = days.map((d) => `day_offset ${d} = ${perDay[d] || QUOTA_PER_DAY_MIN} slots`).join("; ");
  return [
    "You are Agent승 filling AP slot intents for the listed day_offset values only.",
    creatorDnaBlock(),
    `day_offset is 0-based. Fill ${spec}. Do not emit any other day_offset.`,
    "Each slot: slot_id, day_offset, growth_role (RETURN|BRIDGE|REACH), editorial_mode (INFORMATIVE|COMPARE|OPINION|EXPERIENCE|CASUAL_OBSERVATION), planner_intent, planned_at (ISO UTC), planned_pt (America/Los_Angeles wall time).",
    "Every slot must include planned_at and planned_pt. Infer the clock from evidence. Do not omit a time. Code will not invent one.",
    "Adjacent originals at least 2 hours apart — that is a minimum, not a 2-hour step. Stay on that calendar day, before the next day. 14:00–22:00 PT is audience evidence, not a box.",
    "Do not leave Role, Editorial Mode, or timestamp blank. If a field is missing the runtime re-asks you; it does not fill it.",
    "USER_DIRECT and AP_PIPELINE are separate populations. Do not average them. Do not learn Creator Voice from AP_PIPELINE.",
    "Complexity/Emergence is a judgment, not a ratio or slot recipe. Keep Creator Identity and long-term account growth together.",
    "REACH: 1 per day_offset, never more than 2. Prefer CASUAL_OBSERVATION or easy INFORMATIVE. PRESENCE is not a role and is not REACH. Do not freeze RETURN/BRIDGE share.",
    "SCENE: consecutive slots must not share the same situation cluster. Driving-family scenes are at most 2 per day_offset. Do not repeat the previous slot's verdict angle.",
    "EXPERIENCE only within lived_scene_count. Do not force EXPERIENCE share when lived originals are missing or thin. BRIDGE+EXPERIENCE almost never. REACH+EXPERIENCE only if universalized.",
    "planner_intent says why the slot exists, not how to write it.",
    "Return strict JSON: { \"slots\": [ ... ] }. Fill every required slot. No prose outside JSON.",
  ].join("\n");
}

function compactAudienceCounts(audience: AudienceXStatus) {
  return {
    analytics_originals: audience.analytics_originals,
    sync_gap_originals: audience.sync_gap_originals,
    lived_scene_count: audience.lived_scene_count,
  };
}

function slotItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.slots)) return raw.slots;
  if (Array.isArray(raw.day_slots)) return raw.day_slots;
  return [];
}

function rawDayNumber(item: any): number {
  const n = Number(item?.day_offset ?? item?.dayOffset);
  if (Number.isFinite(n)) return Math.round(n);
  const fromId = /^D(\d+)/i.exec(s(item?.slot_id, 12));
  if (fromId) return Number(fromId[1]);
  return NaN;
}

/** Grok often emits 1-based 일차 (1,2) while the job sends 0-based day_offset (0,1). */
export function creatorDaysAreOneBased(rawOffsets: number[], allowed: number[]): boolean {
  const nums = rawOffsets.filter((n) => Number.isFinite(n));
  if (!nums.length || !allowed.length) return false;
  const zeroOk = nums.filter((n) => allowed.includes(n)).length;
  const oneOk = nums.filter((n) => allowed.includes(n - 1)).length;
  return oneOk > zeroOk;
}

export function parseCreatorDaySlots(args: {
  raw: any;
  days: number[];
  postsPerDay: number[];
}): PlannerSlotIntent[] | null {
  const days = (args.days || []).filter((d) => d >= 0 && d < QUOTA_DAYS);
  const want = days.reduce((n, d) => n + (args.postsPerDay[d] || QUOTA_PER_DAY_MIN), 0);
  if (want < 1) return null;
  const items = slotItems(args.raw);
  const offsets = items.map(rawDayNumber).filter((n) => Number.isFinite(n));
  const oneBased = creatorDaysAreOneBased(offsets, days);
  const slots: PlannerSlotIntent[] = [];
  const dayCounts = new Map<number, number>();
  const seen = new Set<string>();
  for (const item of items) {
    let day = rawDayNumber(item);
    if (oneBased) day -= 1;
    if (!days.includes(day)) continue;
    const cap = args.postsPerDay[day] || QUOTA_PER_DAY_MIN;
    const n = dayCounts.get(day) || 0;
    if (n >= cap) continue;
    const role = growthRole(item?.growth_role || item?.strategic_role);
    const editorial_mode = parseSlotMode(item?.editorial_mode);
    const planned_at = s(item?.planned_at, 48);
    const planned_pt = s(item?.planned_pt || item?.planned_time, 48);
    if (!role || !editorial_mode || (!planned_at && !planned_pt)) continue;
    const intent = s(item?.planner_intent || item?.intent || item?.purpose, 240);
    if (!intent) continue;
    let slotId = s(item?.slot_id, 40) || `D${day + 1}P${n + 1}`;
    if (seen.has(slotId)) slotId = `D${day + 1}P${n + 1}`;
    seen.add(slotId);
    dayCounts.set(day, n + 1);
    slots.push({
      slot_id: slotId,
      day_offset: day,
      strategic_role: role,
      editorial_mode,
      planner_intent: intent,
      planned_at: planned_at || undefined,
      planned_pt: planned_pt || undefined,
    });
  }
  if (slots.length !== want) return null;
  if (!reachDailyConstraintOk(slots)) return null;
  return slots;
}

function plannerEvidencePayload(
  evidence: AgentSeungPlanEvidence | null | undefined,
  digest?: PlanEvidenceDigest | null,
): Record<string, unknown> | null {
  if (!evidence) return null;
  if (digest) return planEvidenceForVolumeAndSlots(evidence, digest);
  return planEvidenceForModel(evidence);
}

export async function inferPlanEvidenceDigest(args: {
  xaiKey: string;
  page: unknown[];
  pageIndex: number;
  pageCount: number;
  previous: PlanEvidenceDigest | null;
  accountDaily?: unknown;
  counts: { user_direct: number; ap_pipeline: number; unknown: number };
  occupiedTimes: string[];
  fedicaBestPostingTime: unknown;
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlanEvidenceDigest>> {
  const consumed = Math.min(args.pageIndex + 1, Math.max(1, args.pageCount));
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 1200,
    timeoutMs: args.timeoutMs ?? 52000,
    system: [
      "You are Agent승 reading AP weekly plan evidence in pages.",
      "Update the running digest from this page plus the previous digest.",
      "Do not emit slots, Role, Editorial Mode, REACH, timestamps, or posts_per_day.",
      "Do not invent posts or missing metrics. Thin evidence stays thin.",
      "UNKNOWN is performance only. Do not treat it as voice or handmade thinking.",
      "Return strict JSON: cadence_note, user_direct_note, ap_pipeline_note, unknown_perf_note, recent_topics, occupied_hours_note, timing_note, complexity_emergence_note, thin.",
    ].join("\n"),
    user: {
      previous_digest: args.previous || emptyPlanEvidenceDigest(),
      page: args.page,
      page_index: args.pageIndex,
      page_count: args.pageCount,
      account_daily: args.pageIndex === 0 ? args.accountDaily || [] : undefined,
      counts: args.counts,
      occupied_times: args.occupiedTimes,
      fedica_best_posting_time: args.fedicaBestPostingTime,
    },
    parse: (raw) => parsePlanEvidenceDigest(raw, consumed),
  });
}

export async function inferCreatorWeekVolume(args: {
  xaiKey: string;
  audience: AudienceXStatus;
  planEvidence?: AgentSeungPlanEvidence | null;
  digest?: PlanEvidenceDigest | null;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<{ posts_per_day: number[]; summary: string }>> {
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 1400,
    timeoutMs: args.timeoutMs,
    system: [
      "You are Agent승 locking seven-day AP volume only. Do not emit slots.",
      creatorDnaBlock(),
      audienceStatusBlock(args.audience),
      "Use the Agent승 evidence digest plus counts and occupied times. Raw post dumps are not on this call.",
      "30-day Analytics metrics stay separate. Sync is gap-fill only. USER_DIRECT and AP_PIPELINE stay separate. Do not average them. Complexity/Emergence is a judgment, not a ratio.",
      "volume_gates: each day 4-8 originals, week 28-56, no empty day. Handmade does not change volume.",
      "Return strict JSON: posts_per_day (7 integers), strategy_summary.",
    ].join("\n"),
    user: {
      audience_x_status: args.audience,
      plan_evidence: plannerEvidencePayload(args.planEvidence, args.digest),
      operator_note: args.operatorNote || "",
    },
    parse: (raw) => {
      if (!raw) return null;
      const posts_per_day = clampWeekVolume(raw.posts_per_day);
      return { posts_per_day, summary: s(raw.strategy_summary, 600) };
    },
  });
}

export async function inferCreatorSlotsForDays(args: {
  xaiKey: string;
  audience: AudienceXStatus;
  days: number[];
  postsPerDay: number[];
  already: PlannerSlotIntent[];
  planEvidence?: AgentSeungPlanEvidence | null;
  digest?: PlanEvidenceDigest | null;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSlotIntent[]>> {
  const wanted = args.days.reduce((n, d) => n + (args.postsPerDay[d] || QUOTA_PER_DAY_MIN), 0);
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 4000,
    timeoutMs: args.timeoutMs,
    system: creatorDaySlotsSystem(args.days, args.postsPerDay),
    user: {
      audience_counts: compactAudienceCounts(args.audience),
      plan_evidence: plannerEvidencePayload(args.planEvidence, args.digest),
      posts_per_day: args.postsPerDay,
      day_offsets: args.days,
      required_slot_count_this_call: wanted,
      already_planned: (args.already || []).map((slot) => ({
        slot_id: slot.slot_id,
        day_offset: slot.day_offset,
        strategic_role: slot.strategic_role,
        editorial_mode: slot.editorial_mode,
        planned_at: slot.planned_at || "",
        planned_pt: slot.planned_pt || "",
      })),
      operator_note: args.operatorNote || "",
    },
    parse: (raw) => parseCreatorDaySlots({
      raw,
      days: args.days,
      postsPerDay: args.postsPerDay,
    }),
  });
}

export async function inferCreatorSlotReplan(args: {
  xaiKey: string;
  audience: AudienceXStatus;
  weekSlots: PlannerSlotIntent[];
  replanSlotId: string;
  judgeReasons: string[];
  seedPool: Array<{ seed_id: string; concrete_subject?: string; cluster?: string; editorial_mode?: string }>;
  planEvidence?: AgentSeungPlanEvidence | null;
  occupiedTimes?: string[];
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSlotIntent & { seed_id?: string }>> {
  const current = (args.weekSlots || []).find((slot) => slot.slot_id === args.replanSlotId);
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 1800,
    timeoutMs: args.timeoutMs,
    system: [
      "You are Agent승 replanning ONE AP slot. The rest of the week stays.",
      creatorDnaBlock(),
      "Judge flagged this slot's strategy as invalid. You infer the replacement Role, Editorial Mode, timestamp, planner_intent, and seed_id from the evidence and seed pool.",
      "Do not rewrite other slots. Do not restart the seven-day plan. Code will not invent Role, Mode, REACH, or time if you omit them.",
      "Every replacement slot needs planned_at and planned_pt. Infer the clock. Minimum 2 hours from adjacent originals, not a 2-hour step. Same calendar day, before the next day.",
      "Return strict JSON: { \"slot\": { slot_id, day_offset, growth_role, editorial_mode, planner_intent, planned_at, planned_pt, seed_id } }.",
    ].join("\n"),
    user: {
      audience_counts: compactAudienceCounts(args.audience),
      plan_evidence: args.planEvidence ? planEvidenceForModel(args.planEvidence) : null,
      week_slots: (args.weekSlots || []).map((slot) => ({
        slot_id: slot.slot_id,
        day_offset: slot.day_offset,
        strategic_role: slot.strategic_role,
        editorial_mode: slot.editorial_mode,
        planned_at: slot.planned_at || "",
        planned_pt: slot.planned_pt || "",
      })),
      replan_slot_id: args.replanSlotId,
      current_slot: current || null,
      judge_invalidation_reasons: (args.judgeReasons || []).map((r) => s(r, 160)).slice(0, 12),
      available_seeds: (args.seedPool || []).slice(0, 40),
      occupied_times: (args.occupiedTimes || []).slice(0, 40),
    },
    parse: (raw) => {
      const item = raw?.slot || raw?.slots?.[0] || raw;
      if (!item) return null;
      const role = growthRole(item.growth_role || item.strategic_role);
      const editorial_mode = parseSlotMode(item.editorial_mode);
      const planned_at = s(item.planned_at, 48);
      const planned_pt = s(item.planned_pt || item.planned_time, 48);
      const intent = s(item.planner_intent || item.intent, 240);
      const slot_id = s(item.slot_id || args.replanSlotId, 40);
      if (!role || !editorial_mode || (!planned_at && !planned_pt) || !intent || !slot_id) return null;
      const seed_id = s(item.seed_id, 80);
      if (args.seedPool.length && !seed_id) return null;
      if (args.seedPool.length && !args.seedPool.some((seed) => seed.seed_id === seed_id)) return null;
      return {
        slot_id,
        day_offset: Number.isFinite(Number(item.day_offset)) ? Number(item.day_offset) : Number(current?.day_offset || 0),
        strategic_role: role,
        editorial_mode,
        planner_intent: intent,
        planned_at: planned_at || undefined,
        planned_pt: planned_pt || undefined,
        seed_id: seed_id || undefined,
      };
    },
  });
}

export async function creatorRelabelRejectBatch(args: {
  xaiKey: string;
  audience: AudienceXStatus;
  rejected: Array<{
    strategy_slot_id: string;
    growth_role?: string;
    editorial_mode?: string;
    planner_intent?: string;
    judge_reasons?: string[];
  }>;
  timeoutMs?: number;
}): Promise<PlannerCallResult<Array<{
  strategy_slot_id: string;
  strategic_role: string;
  editorial_mode: EditorialMode;
  planner_intent: string;
}>>> {
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 4000,
    timeoutMs: args.timeoutMs,
    system: [
      "You are Agent승 relabeling a batch of Judge-rejected AP slots.",
      creatorDnaBlock(),
      "Keep RETURN, BRIDGE, or REACH and one of the five types. REACH stays 1 per day, max 2 — do not relabel a batch into extra REACH. Do not write posts. Planner will place and pick Seeds.",
      "Return strict JSON: slots array with strategy_slot_id, growth_role, editorial_mode, planner_intent.",
    ].join("\n"),
    user: {
      audience_x_status: args.audience,
      rejected: args.rejected,
    },
    parse: (raw) => {
      const items = Array.isArray(raw?.slots) ? raw.slots : [];
      const out = [];
      for (const item of items) {
        const id = s(item.strategy_slot_id || item.slot_id, 40);
        if (!id) continue;
        const role = growthRole(item.growth_role || item.strategic_role);
        const editorial_mode = parseSlotMode(item.editorial_mode);
        if (!role || !editorial_mode) continue;
        out.push({
          strategy_slot_id: id,
          strategic_role: role,
          editorial_mode,
          planner_intent: s(item.planner_intent, 240),
        });
      }
      return out.length ? out : null;
    },
  });
}
