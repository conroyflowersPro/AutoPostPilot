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

function s(v: unknown, max = 240): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function mode(v: unknown): EditorialMode {
  const value = s(v, 40).toUpperCase();
  const ok = ["INFORMATIVE", "COMPARE", "OPINION", "EXPERIENCE", "CASUAL_OBSERVATION"];
  return (ok.includes(value) ? value : "INFORMATIVE") as EditorialMode;
}

export type GrowthRole = "RETURN" | "BRIDGE" | "REACH";

export const REACH_PER_DAY_TARGET = 1;
export const REACH_PER_DAY_MAX = 2;

export function growthRole(v: unknown): GrowthRole {
  const value = s(v, 20).toUpperCase();
  if (value === "PRESENCE") return "RETURN";
  if (value === "REACH") return "REACH";
  if (value === "BRIDGE") return "BRIDGE";
  return "RETURN";
}

/** One REACH per day, never more than two. Extra REACH becomes RETURN. Missing REACH takes a non-EXPERIENCE slot when possible. */
export function enforceReachDailyCap<T extends { day_offset: number; strategic_role: string; editorial_mode?: string }>(
  slots: T[],
): T[] {
  const byDay = new Map<number, T[]>();
  for (const slot of slots) {
    const day = Number(slot.day_offset);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(slot);
  }
  for (const daySlots of byDay.values()) {
    const reachAt: number[] = [];
    for (let i = 0; i < daySlots.length; i += 1) {
      if (String(daySlots[i].strategic_role || "").toUpperCase() === "REACH") reachAt.push(i);
    }
    while (reachAt.length > REACH_PER_DAY_MAX) {
      const idx = reachAt.pop();
      if (idx == null) break;
      daySlots[idx].strategic_role = "RETURN";
    }
    if (reachAt.length === 0 && daySlots.length) {
      let pick = daySlots.findIndex((slot) => String(slot.editorial_mode || "").toUpperCase() !== "EXPERIENCE");
      if (pick < 0) pick = daySlots.length - 1;
      daySlots[pick].strategic_role = "REACH";
    }
  }
  return slots;
}

function creatorDaySlotsSystem(days: number[], perDay: number[]): string {
  const spec = days.map((d) => `day_offset ${d} = ${perDay[d] || QUOTA_PER_DAY_MIN} slots`).join("; ");
  return [
    "You are Creator DNA filling AP slot intents for the listed day_offset values only.",
    creatorDnaBlock(),
    `day_offset is 0-based. Fill ${spec}. Do not emit any other day_offset.`,
    "Each slot: slot_id, day_offset, growth_role (RETURN|BRIDGE|REACH), editorial_mode (INFORMATIVE|COMPARE|OPINION|EXPERIENCE|CASUAL_OBSERVATION), planner_intent.",
    "REACH: 1 per day_offset, never more than 2. Prefer CASUAL_OBSERVATION or easy INFORMATIVE. PRESENCE is not a role and is not REACH.",
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

const PAD_MODES: EditorialMode[] = ["INFORMATIVE", "COMPARE", "OPINION", "CASUAL_OBSERVATION"];

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
    let slotId = s(item?.slot_id, 40) || `D${day + 1}P${n + 1}`;
    if (seen.has(slotId)) slotId = `D${day + 1}P${n + 1}`;
    const intent = s(item?.planner_intent || item?.intent || item?.purpose, 240)
      || `${role} ${mode(item?.editorial_mode)} AP original`;
    seen.add(slotId);
    dayCounts.set(day, n + 1);
    slots.push({
      slot_id: slotId,
      day_offset: day,
      strategic_role: role,
      editorial_mode: mode(item?.editorial_mode),
      planner_intent: intent,
    });
  }
  if (!slots.length) return null;
  for (const day of days) {
    const cap = args.postsPerDay[day] || QUOTA_PER_DAY_MIN;
    while ((dayCounts.get(day) || 0) < cap) {
      const n = dayCounts.get(day) || 0;
      let seq = n + 1;
      let slotId = `D${day + 1}P${seq}`;
      while (seen.has(slotId)) {
        seq += 1;
        slotId = `D${day + 1}P${seq}`;
      }
      const editorial_mode = PAD_MODES[n % PAD_MODES.length];
      const role = n % 3 === 0 ? "BRIDGE" : "RETURN";
      seen.add(slotId);
      dayCounts.set(day, n + 1);
      slots.push({
        slot_id: slotId,
        day_offset: day,
        strategic_role: role,
        editorial_mode,
        planner_intent: `${role} ${editorial_mode} AP original`,
      });
    }
  }
  if (slots.length !== want) return null;
  return enforceReachDailyCap(slots);
}

export async function inferCreatorWeekVolume(args: {
  xaiKey: string;
  audience: AudienceXStatus;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<{ posts_per_day: number[]; summary: string }>> {
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 1200,
    timeoutMs: args.timeoutMs,
    system: [
      "You are Creator DNA locking seven-day AP volume only. Do not emit slots.",
      creatorDnaBlock(),
      audienceStatusBlock(args.audience),
      "volume_gates: each day 4-8 originals, week 28-56, no empty day. Handmade does not change volume.",
      "Return strict JSON: posts_per_day (7 integers), strategy_summary.",
    ].join("\n"),
    user: {
      audience_x_status: args.audience,
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
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSlotIntent[]>> {
  const wanted = args.days.reduce((n, d) => n + (args.postsPerDay[d] || QUOTA_PER_DAY_MIN), 0);
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 3500,
    timeoutMs: args.timeoutMs,
    system: creatorDaySlotsSystem(args.days, args.postsPerDay),
    user: {
      audience_counts: compactAudienceCounts(args.audience),
      posts_per_day: args.postsPerDay,
      day_offsets: args.days,
      required_slot_count_this_call: wanted,
      already_slot_count: args.already.length,
      operator_note: args.operatorNote || "",
    },
    parse: (raw) => parseCreatorDaySlots({
      raw,
      days: args.days,
      postsPerDay: args.postsPerDay,
    }),
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
      "You are Creator DNA relabeling a batch of Judge-rejected AP slots.",
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
        out.push({
          strategy_slot_id: id,
          strategic_role: growthRole(item.growth_role || item.strategic_role),
          editorial_mode: mode(item.editorial_mode),
          planner_intent: s(item.planner_intent, 240),
        });
      }
      return out.length ? out : null;
    },
  });
}
