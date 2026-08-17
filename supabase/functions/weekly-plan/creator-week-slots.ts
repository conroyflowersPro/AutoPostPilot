/**
 * Creator DNA judges seven-day AP slots: RETURN|BRIDGE + editorial type.
 * Audience DNA supplies X status only. Planner does not judge types.
 */
import { creatorDnaBlock, engineRulesAsWill } from "./engine-dna.ts";
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

const GROWTH_ROLES = new Set(["RETURN", "BRIDGE"]);

function s(v: unknown, max = 240): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function mode(v: unknown): EditorialMode {
  const value = s(v, 40).toUpperCase();
  const ok = ["INFORMATIVE", "COMPARE", "OPINION", "EXPERIENCE", "CASUAL_OBSERVATION"];
  return (ok.includes(value) ? value : "INFORMATIVE") as EditorialMode;
}

function growthRole(v: unknown): "RETURN" | "BRIDGE" {
  const value = s(v, 20).toUpperCase();
  if (value === "BRIDGE") return "BRIDGE";
  return "RETURN";
}

function creatorJudgeSystem(): string {
  return [
    "You are Creator DNA judging this account's next seven-day AP slots.",
    creatorDnaBlock(),
    engineRulesAsWill(),
    "Audience DNA below is X status only. You judge. Do not let Audience overwrite identity.",
    "AP roles are RETURN or BRIDGE only. Do not emit PRESENCE. Handmade presence is not an AP slot.",
    "Each slot needs growth_role, editorial_mode (INFORMATIVE|COMPARE|OPINION|EXPERIENCE|CASUAL_OBSERVATION), planner_intent.",
    "RETURN+EXPERIENCE count must be <= lived_scene_count (Analytics originals + sync-gap originals).",
    "BRIDGE+EXPERIENCE should be rare (almost never). Circulating compare seeds stay COMPARE or INFORMATIVE, never EXPERIENCE.",
    "Do not leave an empty day. Each day 4-8 originals. Week 28-56.",
    "Do not move AP days to make room for handmade. Do not reduce handmade.",
    "Revenue DNA does not pick this mix. Current X Context does not vote.",
    "Return strict JSON: posts_per_day (7 ints), strategy_summary, slots. Each slot: slot_id, day_offset, growth_role, editorial_mode, planner_intent. No prose outside JSON.",
  ].join("\n");
}

function creatorDaySlotsSystem(days: number[]): string {
  return [
    "You are Creator DNA filling AP slot intents for the listed day_offset values only.",
    creatorDnaBlock(),
    `Fill day_offset values ${days.join(", ")} only. growth_role is RETURN or BRIDGE. editorial_mode is one of the five types.`,
    "Do not emit PRESENCE. RETURN+EXPERIENCE must stay within lived_scene_count remaining.",
    "Do not change types later via Planner. Planner only places time and Seeds.",
    "Return strict JSON with slots array. No prose outside JSON.",
  ].join("\n");
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
    maxTokens: 5000,
    timeoutMs: args.timeoutMs,
    system: creatorDaySlotsSystem(args.days) + "\n" + audienceStatusBlock(args.audience),
    user: {
      audience_x_status: args.audience,
      audience_block: audienceStatusBlock(args.audience),
      posts_per_day: args.postsPerDay,
      day_offsets: args.days,
      already_slot_count: args.already.length,
      operator_note: args.operatorNote || "",
    },
    parse: (raw) => {
      const items = Array.isArray(raw?.slots) ? raw.slots : [];
      const slots: PlannerSlotIntent[] = [];
      for (const item of items) {
        const day = Math.max(0, Math.min(QUOTA_DAYS - 1, Math.round(Number(item.day_offset) || 0)));
        if (!args.days.includes(day)) continue;
        const role = growthRole(item.growth_role || item.strategic_role);
        if (!GROWTH_ROLES.has(role)) continue;
        slots.push({
          slot_id: s(item.slot_id, 40) || `D${day + 1}P${slots.filter((x) => x.day_offset === day).length + 1}`,
          day_offset: day,
          strategic_role: role,
          editorial_mode: mode(item.editorial_mode),
          planner_intent: s(item.planner_intent, 240),
        });
      }
      if (slots.length !== wanted) return null;
      if (slots.some((slot) => !slot.planner_intent)) return null;
      return slots;
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
      "You are Creator DNA relabeling a batch of Judge-rejected AP slots.",
      creatorDnaBlock(),
      "Keep RETURN or BRIDGE and one of the five types. Do not write posts. Planner will place and pick Seeds.",
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
