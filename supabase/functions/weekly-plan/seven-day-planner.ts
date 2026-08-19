/**
 * Seven-day Planner.
 *
 * Seed Generator explores. Planner strategizes, selects, allocates, and
 * recovers. Writer creates. Judge only validates the final post.
 *
 * Every exported call is one xAI request so generation-job can persist between
 * ticks and stay resumable on mobile.
 */
import type { CadenceSignal, ConcreteSeed, EditorialMode } from "./seed-engine.ts";
import { creatorDnaBlock, engineRulesAsWill } from "./engine-dna.ts";
import { plannerArchitectureLock } from "./engine-architecture.ts";
import type { PlannerIntelligenceBlocks } from "./planner-intelligence.ts";
import { MAX_WEEKLY_SLOTS, MIN_WEEKLY_SLOTS, QUOTA_PER_DAY_MAX, QUOTA_PER_DAY_MIN } from "./quota-inference.ts";
import { BUNDLED_X_ANALYTICS_WINDOW } from "./x-analytics-30d-bundled.ts";
import { diversifyAssignments } from "./situation-diversity.ts";
import { isLivedSelfSeed, livedAsOf, LIVED_GROUNDING_INSUFFICIENT } from "./seed-ownership.ts";

export const STRATEGY_DAYS_PER_TICK = 2;

export const SEVEN_DAY_PLANNER_VERSION = "seven_day_planner_v1";
export const PLANNING_HORIZON_DAYS = 7;

export function strategyCoversSevenDays(slots: Array<{ day_offset: number }>): boolean {
  if (slots.length < MIN_WEEKLY_SLOTS || slots.length > MAX_WEEKLY_SLOTS) return false;
  const byDay = Array.from({ length: PLANNING_HORIZON_DAYS }, () => 0);
  for (const slot of slots) {
    const day = Math.max(0, Math.min(PLANNING_HORIZON_DAYS - 1, Math.round(Number(slot.day_offset) || 0)));
    byDay[day] += 1;
  }
  return byDay.every((n) => n >= QUOTA_PER_DAY_MIN && n <= QUOTA_PER_DAY_MAX);
}

export type XAnalyticsPublishedPost = {
  post_id: string | null;
  published_at: string;
  content: string;
  metrics: Record<string, number | null>;
  features?: Record<string, unknown> | null;
};

export type XAnalyticsDailyAccountPulse = {
  date: string;
  impressions: number;
  likes: number;
  engagements: number;
  bookmarks: number;
  shares: number;
  new_follows: number;
  unfollows: number;
  replies: number;
  reposts: number;
  profile_visits: number;
};

function parseBundledWindow(parsed: any): {
  rows: XAnalyticsPublishedPost[];
  account_daily: XAnalyticsDailyAccountPulse[];
} {
  const rows: XAnalyticsPublishedPost[] = [];
  for (const item of Array.isArray(parsed?.posts) ? parsed.posts : []) {
    const publishedAt = s(item?.published_at, 40);
    const parsedAt = Date.parse(publishedAt);
    if (!Number.isFinite(parsedAt)) continue;
    if (item?.features?.isReply === true) continue;
    rows.push({
      post_id: item?.post_id ? s(item.post_id, 100) : null,
      published_at: new Date(parsedAt).toISOString(),
      content: s(item?.content, 240),
      metrics: {
        followers_gained: Number(item?.metrics?.followers_gained) || 0,
        profile_visits: Number(item?.metrics?.profile_visits) || 0,
        bookmarks: Number(item?.metrics?.bookmarks) || 0,
        replies: Number(item?.metrics?.replies) || 0,
        reposts: Number(item?.metrics?.reposts) || 0,
        likes: Number(item?.metrics?.likes) || 0,
        impressions: Number(item?.metrics?.impressions) || 0,
        quotes: Number(item?.metrics?.quotes) || 0,
        shares: Number(item?.metrics?.shares) || 0,
        detail_expands: Number(item?.metrics?.detail_expands) || 0,
      },
      features: item?.features && typeof item.features === "object" ? item.features : { is_original: true },
    });
  }
  const accountDaily: XAnalyticsDailyAccountPulse[] = [];
  for (const pulse of Array.isArray(parsed?.account_daily) ? parsed.account_daily : []) {
    const parsedAt = Date.parse(s(pulse?.date, 60));
    if (!Number.isFinite(parsedAt)) continue;
    accountDaily.push({
      date: new Date(parsedAt).toISOString().slice(0, 10),
      impressions: Number(pulse?.impressions) || 0,
      likes: Number(pulse?.likes) || 0,
      engagements: Number(pulse?.engagements) || 0,
      bookmarks: Number(pulse?.bookmarks) || 0,
      shares: Number(pulse?.shares) || 0,
      new_follows: Number(pulse?.new_follows) || 0,
      unfollows: Number(pulse?.unfollows) || 0,
      replies: Number(pulse?.replies) || 0,
      reposts: Number(pulse?.reposts) || 0,
      profile_visits: Number(pulse?.profile_visits) || 0,
    });
  }
  return { rows, account_daily: accountDaily };
}

function loadBundledXAnalyticsWindow(): {
  rows: XAnalyticsPublishedPost[];
  account_daily: XAnalyticsDailyAccountPulse[];
  source: "module" | "file" | "empty";
  error: string;
} {
  try {
    const fromModule = parseBundledWindow(BUNDLED_X_ANALYTICS_WINDOW);
    if (fromModule.rows.length || fromModule.account_daily.length) {
      return { ...fromModule, source: "module", error: "" };
    }
  } catch (e: any) {
    const moduleError = s(e?.message || "bundled_module_failed", 120);
    try {
      const raw = Deno.readTextFileSync(new URL("./x-analytics-30d-window.json", import.meta.url));
      return { ...parseBundledWindow(JSON.parse(raw)), source: "file", error: moduleError };
    } catch (e2: any) {
      return { rows: [], account_daily: [], source: "empty", error: `${moduleError}; ${s(e2?.message || "read_failed", 120)}` };
    }
  }
  try {
    const raw = Deno.readTextFileSync(new URL("./x-analytics-30d-window.json", import.meta.url));
    const fromFile = parseBundledWindow(JSON.parse(raw));
    if (fromFile.rows.length || fromFile.account_daily.length) {
      return { ...fromFile, source: "file", error: "module_empty" };
    }
  } catch (e: any) {
    return { rows: [], account_daily: [], source: "empty", error: s(e?.message || "bundled_read_failed", 180) };
  }
  return { rows: [], account_daily: [], source: "empty", error: "bundled_window_empty" };
}

export async function loadRecentXAnalyticsPublished(
  supabase: { from: (table: string) => any },
  days = 30,
): Promise<{
  rows: XAnalyticsPublishedPost[];
  coverage_days: number;
  account_daily: XAnalyticsDailyAccountPulse[];
  bundled_source?: "module" | "file" | "empty";
  bundled_error?: string;
}> {
  const sinceMs = Date.now() - Math.max(1, Math.min(30, days)) * 24 * 3600 * 1000;
  const since = new Date(sinceMs).toISOString();
  const bundled = loadBundledXAnalyticsWindow();
  const rows: XAnalyticsPublishedPost[] = [];
  const dates = new Set<string>();
  const seenPosts = new Set<string>();

  const pushRow = (row: XAnalyticsPublishedPost) => {
    const parsed = Date.parse(row.published_at);
    if (!Number.isFinite(parsed) || parsed < sinceMs) return;
    const postKey = row.post_id
      ? `id:${s(row.post_id, 100)}`
      : `fallback:${new Date(parsed).toISOString()}|${s(row.content, 160)}`;
    if (seenPosts.has(postKey)) return;
    seenPosts.add(postKey);
    dates.add(new Date(parsed).toISOString().slice(0, 10));
    rows.push(row);
  };

  for (const row of bundled.rows) pushRow(row);

  try {
    let { data, error } = await supabase
      .from("post_metrics")
      .select("post_id, content_snippet, published_at, action_type, followers_gained, profile_visits, bookmarks, replies, reposts, likes, impressions, quotes, shares, detail_expands, features")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(1000);
    if (error && /column|schema/i.test(String(error.message || ""))) {
      const fallback = await supabase
        .from("post_metrics")
        .select("content_snippet, published_at, followers_gained, profile_visits, bookmarks, replies, reposts, likes, impressions, quotes, features")
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(1000);
      data = fallback.data;
      error = fallback.error;
    }
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const actionType = s(row?.action_type, 40).toUpperCase();
        if (/REPLY|REPOST|RETWEET/.test(actionType) || row?.features?.isReply === true) continue;
        const publishedAt = s(row?.published_at, 40);
        const parsed = Date.parse(publishedAt);
        if (!publishedAt || !Number.isFinite(parsed)) continue;
        pushRow({
          post_id: row?.post_id ? s(row.post_id, 100) : null,
          published_at: new Date(parsed).toISOString(),
          content: s(row?.content_snippet, 240),
          metrics: {
            followers_gained: Number(row?.followers_gained) || 0,
            profile_visits: Number(row?.profile_visits) || 0,
            bookmarks: Number(row?.bookmarks) || 0,
            replies: Number(row?.replies) || 0,
            reposts: Number(row?.reposts) || 0,
            likes: Number(row?.likes) || 0,
            impressions: Number(row?.impressions) || 0,
            quotes: Number(row?.quotes) || 0,
            shares: Number(row?.shares) || 0,
            detail_expands: Number(row?.detail_expands) || 0,
          },
          features: row?.features && typeof row.features === "object" ? row.features : null,
        });
      }
    }

    const latestRun = await supabase
      .from("learning_runs")
      .select("raw_meta")
      .eq("source", "x_analytics_csv")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rawDaily = latestRun?.data?.raw_meta?.dailyAccountPulse;
    const accountDaily: XAnalyticsDailyAccountPulse[] = [];
    if (Array.isArray(rawDaily) && rawDaily.length) {
      for (const pulse of rawDaily.slice(0, 31)) {
        const parsed = Date.parse(s(pulse?.date, 60));
        if (!Number.isFinite(parsed) || parsed < Date.parse(since)) continue;
        accountDaily.push({
          date: new Date(parsed).toISOString().slice(0, 10),
          impressions: Number(pulse?.impressions) || 0,
          likes: Number(pulse?.likes) || 0,
          engagements: Number(pulse?.engagements) || 0,
          bookmarks: Number(pulse?.bookmarks) || 0,
          shares: Number(pulse?.shares) || 0,
          new_follows: Number(pulse?.newFollows) || 0,
          unfollows: Number(pulse?.unfollows) || 0,
          replies: Number(pulse?.replies) || 0,
          reposts: Number(pulse?.reposts) || 0,
          profile_visits: Number(pulse?.profileVisits) || 0,
        });
      }
    }
    rows.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
    return {
      rows,
      coverage_days: dates.size,
      account_daily: accountDaily.length ? accountDaily : bundled.account_daily.filter((d) => Date.parse(d.date) >= Date.parse(since)),
      bundled_source: bundled.source,
      bundled_error: bundled.error,
    };
  } catch {
    rows.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
    return {
      rows,
      coverage_days: dates.size,
      account_daily: bundled.account_daily.filter((d) => Date.parse(d.date) >= Date.parse(since)),
      bundled_source: bundled.source,
      bundled_error: bundled.error,
    };
  }
}

export type PlannerSlotIntent = {
  slot_id: string;
  day_offset: number;
  strategic_role: string;
  editorial_mode: EditorialMode;
  planner_intent: string;
  planned_at?: string;
  planned_pt?: string;
};

export type SevenDayStrategy = {
  strategy_summary: string;
  profile_diversity_intent: string;
  slots: PlannerSlotIntent[];
  analytics_rows_used: number;
  analytics_coverage_days: number;
  analytics_request_needed: boolean;
  analytics_request_reason: string;
  version: string;
};

export type PlannerSeedAssignment = {
  slot_id: string;
  seed_id: string;
  planner_intent: string;
  editorial_mode: EditorialMode;
};

export type PlannerExplorationRequest = {
  slot_id: string;
  exploration_direction: string;
};

export type PlannerSelection = {
  assignments: PlannerSeedAssignment[];
  missing: PlannerExplorationRequest[];
  version: string;
};

export type PlannerRecovery = {
  action: "RESELECT_EXISTING" | "TARGETED_EXPLORE";
  seed_id: string;
  strategic_role: string;
  editorial_mode: EditorialMode;
  planner_intent: string;
  exploration_direction: string;
  version: string;
};

export type PlannerCallResult<T> = {
  ok: boolean;
  value: T | null;
  error: string | null;
  attempted: boolean;
};

const VALID_MODES = new Set<EditorialMode>([
  "INFORMATIVE",
  "COMPARE",
  "OPINION",
  "EXPERIENCE",
  "CASUAL_OBSERVATION",
]);

function s(v: unknown, max = 240): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function extractJson(raw: string): any {
  const txt = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(txt);
  } catch {}
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(txt.slice(a, b + 1));
    } catch {}
  }
  return null;
}

function messageText(body: any): string {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p: any) => String(p?.text || p?.content || "")).join("");
  return content && typeof content === "object" ? JSON.stringify(content) : "";
}

export async function callPlanner<T>(args: {
  xaiKey: string;
  system: string;
  user: Record<string, unknown>;
  parse: (raw: any) => T | null;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<PlannerCallResult<T>> {
  if (!args.xaiKey) return { ok: false, value: null, error: "missing_xai_key", attempted: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 32000);
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${args.xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.6",
        reasoning_effort: "low",
        temperature: 0.45,
        max_tokens: args.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: JSON.stringify(args.user) },
        ],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        value: null,
        error: s(body?.error?.message || `xai_http_${response.status}`, 180),
        attempted: true,
      };
    }
    const parsed = extractJson(messageText(body));
    const value = args.parse(parsed);
    return value
      ? { ok: true, value, error: null, attempted: true }
      : { ok: false, value: null, error: "planner_json_unusable", attempted: true };
  } catch (e: any) {
    return {
      ok: false,
      value: null,
      error: e?.name === "AbortError" ? "xai_timeout" : s(e?.message || "planner_call_failed", 180),
      attempted: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

function mode(v: unknown): EditorialMode {
  const value = s(v, 40).toUpperCase() as EditorialMode;
  return VALID_MODES.has(value) ? value : "INFORMATIVE";
}

function compactPublishedFlow(rows: XAnalyticsPublishedPost[]) {
  return rows.slice(0, 180).map((row) => ({
    d: s(row.published_at, 40),
    t: s(row.content, 72),
    fol: Number(row.metrics?.followers_gained) || 0,
    pv: Number(row.metrics?.profile_visits) || 0,
    bm: Number(row.metrics?.bookmarks) || 0,
    rp: Number(row.metrics?.replies) || 0,
    rps: Number(row.metrics?.reposts) || 0,
    qt: Number(row.metrics?.quotes) || 0,
    lk: Number(row.metrics?.likes) || 0,
    imp: Number(row.metrics?.impressions) || 0,
    sh: Number(row.metrics?.shares) || 0,
    de: Number(row.metrics?.detail_expands) || 0,
  }));
}

function compactAccountDaily(rows: XAnalyticsDailyAccountPulse[] | undefined) {
  return (rows || []).slice(0, 31).map((row) => ({
    d: s(row.date, 10),
    fol: Number(row.new_follows) || 0,
    unf: Number(row.unfollows) || 0,
    pv: Number(row.profile_visits) || 0,
    bm: Number(row.bookmarks) || 0,
    rp: Number(row.replies) || 0,
    rps: Number(row.reposts) || 0,
    lk: Number(row.likes) || 0,
    imp: Number(row.impressions) || 0,
  }));
}

function strategySystem(): string {
  return [
    "You are the seven-day Planner for @Seung4680.",
    plannerArchitectureLock(),
    "Your only job in this call is to infer the seven-day account strategy and slot intents. Do not inspect or select Seeds. Do not write posts. Do not choose prose, thought order, tone, humor, Mechanism, Rail, hook, ending, or sentence form.",
    "Planning Horizon is seven days. Intelligence horizons remain whatever their evidence supports.",
    "Use only recent_x_analytics as the recent published-flow record. It contains actual published X Analytics rows, up to 30 days, compacted to date, short text, and outcome metrics. Keep metric columns separate. Do not collapse into one engagement score. Do not substitute drafts, Seed candidates, virtual plans, or estimated missing days.",
    "account_overview_daily is account-level daily context only. Use it for cadence and profile-level trend, never to attribute an account total to an individual post.",
    "handmade_cadence is real published-account rhythm from USER_DIRECT originals. Empty recent_x_analytics does NOT mean the account posts once a day. Do not collapse the week to 7 slots because analytics rows are missing.",
    "You own weekly volume and placement. There is no separate Quota call. Lock seven calendar days with no empty day. At least 4 originals per day, at most 8. Week floor 28, week ceiling 56. Mode overlap is allowed. 30-day posts inform placement, not a uniqueness ban.",
    "Date and time are part of seven-day strategy. Adjacent planned originals at least 2 hours. Do not start every day at 14:00. Do not emit a repeating 2-hour grid or add jitter. 14:00–22:00 PT are audience posting hours to consider, not an AP For You window.",
    "Recent repetition is profile-level strategic context. Do not ban or penalize an Editorial Mode merely because it appeared often. Infer whether the account has become monotonously similar overall, then adjust this seven-day composition.",
    "No fixed mode ratio, no fixed topic ratio, no pattern rotation. Infer the strategy for this cycle.",
    "volume_gates are hard. Return exactly final_slot_count slot intents, one per locked cell, covering all seven days.",
    "If available analytics are thin, still lock a full seven-day volume from handmade_cadence and DNA. Do not estimate missing analytics dates. Set analytics_request_needed when additional real X Analytics would improve placement, not as an excuse to plan 1/day.",
    "Each slot contains strategic_role, editorial_mode, planner_intent, planned_at, and planned_pt. planner_intent says why this slot exists and what it should accomplish—not how to write it.",
    "Return strict JSON with top-level keys strategy_summary, profile_diversity_intent, final_slot_count, slots, analytics_request_needed, analytics_request_reason. Each slot has slot_id, day_offset, strategic_role, editorial_mode, planner_intent, planned_at, planned_pt. No prose outside JSON.",
  ].join("\n");
}

export type SevenDayVolume = {
  posts_per_day: number[];
  summary: string;
  profile_diversity_intent: string;
  analytics_request_needed: boolean;
  analytics_request_reason: string;
};

export function clampWeekVolume(postsPerDay: unknown): number[] {
  const raw = Array.isArray(postsPerDay) ? postsPerDay : [];
  const out = Array.from({ length: PLANNING_HORIZON_DAYS }, (_, i) => {
    const n = Math.round(Number(raw[i]) || QUOTA_PER_DAY_MIN);
    return Math.max(QUOTA_PER_DAY_MIN, Math.min(QUOTA_PER_DAY_MAX, n));
  });
  let sum = out.reduce((a, b) => a + b, 0);
  let i = 0;
  while (sum < MIN_WEEKLY_SLOTS && i < 80) {
    const d = i % PLANNING_HORIZON_DAYS;
    if (out[d] < QUOTA_PER_DAY_MAX) {
      out[d] += 1;
      sum += 1;
    }
    i += 1;
  }
  i = 0;
  while (sum > MAX_WEEKLY_SLOTS && i < 80) {
    const d = i % PLANNING_HORIZON_DAYS;
    if (out[d] > QUOTA_PER_DAY_MIN) {
      out[d] -= 1;
      sum -= 1;
    }
    i += 1;
  }
  return out;
}

export const SEED_ASSIGN_CHUNK = 5;

export function nextUnassignedSlotChunk<T extends { slot_id: string }>(
  slots: T[],
  assignedIds: Iterable<string>,
  size = SEED_ASSIGN_CHUNK,
): T[] {
  const have = new Set([...assignedIds].map((id) => String(id || "")));
  return (slots || []).filter((slot) => !have.has(String(slot.slot_id || ""))).slice(0, Math.max(1, size));
}

export function nextUnassignedDayOffsets(
  slots: Array<{ slot_id: string; day_offset: number }>,
  assignedIds: Iterable<string>,
  batch = STRATEGY_DAYS_PER_TICK,
): number[] {
  const have = new Set([...assignedIds].map((id) => String(id || "")));
  const need = new Set<number>();
  for (const slot of slots || []) {
    if (!have.has(String(slot.slot_id || ""))) {
      const day = Math.max(0, Math.min(PLANNING_HORIZON_DAYS - 1, Math.round(Number(slot.day_offset) || 0)));
      need.add(day);
    }
  }
  const days: number[] = [];
  for (let d = 0; d < PLANNING_HORIZON_DAYS && days.length < batch; d++) {
    if (need.has(d)) days.push(d);
  }
  return days;
}

export function nextStrategyDayOffsets(
  slots: Array<{ day_offset: number }>,
  postsPerDay: number[],
  batch = STRATEGY_DAYS_PER_TICK,
): number[] {
  const counts = Array.from({ length: PLANNING_HORIZON_DAYS }, () => 0);
  for (const slot of slots || []) {
    const day = Math.max(0, Math.min(PLANNING_HORIZON_DAYS - 1, Math.round(Number(slot.day_offset) || 0)));
    counts[day] += 1;
  }
  const days: number[] = [];
  for (let d = 0; d < PLANNING_HORIZON_DAYS && days.length < batch; d++) {
    const want = postsPerDay[d] || QUOTA_PER_DAY_MIN;
    if (counts[d] < want) days.push(d);
  }
  return days;
}

function volumeSystem(): string {
  return [
    "You are the seven-day Planner for @Seung4680.",
    plannerArchitectureLock(),
    "This call locks weekly volume only. Do not emit slots. Do not inspect Seeds. Do not write posts. Agent승 infers timestamps later from evidence; do not assume a 14:00–22:00 grid.",
    "Planning Horizon is seven days. Use only recent_x_analytics as the recent published-flow record. handmade_cadence is real published-account rhythm. Empty recent_x_analytics does NOT mean the account posts once a day.",
    "volume_gates are hard: each day 4-8 originals, week floor 28, week ceiling 56, no empty day.",
    "Return strict JSON with posts_per_day (7 integers), strategy_summary, profile_diversity_intent, analytics_request_needed, analytics_request_reason. No prose outside JSON.",
  ].join("\n");
}

function daySlotsSystem(days: number[]): string {
  return [
    "You are the seven-day Planner for @Seung4680.",
    plannerArchitectureLock(),
    `This call fills slot intents for day_offset values ${days.join(", ")} only. Do not emit other days.`,
    "Each slot contains slot_id, day_offset, strategic_role, editorial_mode, planner_intent, planned_at, and planned_pt. planner_intent says why this slot exists—not how to write it. Infer timestamps from evidence. Min gap 2 hours. No clock grid.",
    "Fill exactly posts_per_day[d] slots for each requested day. Mode overlap is allowed. No fixed mode ratio.",
    "Return strict JSON with slots array. No prose outside JSON.",
  ].join("\n");
}

function plannerUserPayload(args: {
  intelligence: PlannerIntelligenceBlocks;
  cadence?: CadenceSignal | null;
  analytics: XAnalyticsPublishedPost[];
  analyticsCoverageDays: number;
  accountDaily?: XAnalyticsDailyAccountPulse[];
  operatorNote?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const analytics = compactPublishedFlow(args.analytics || []);
  return {
    creator_dna: creatorDnaBlock(),
    engine_rules: engineRulesAsWill(),
    intelligence: args.intelligence,
    planning_horizon_days: PLANNING_HORIZON_DAYS,
    editorial_mode_labels: [...VALID_MODES],
    handmade_cadence: args.cadence || null,
    volume_gates: {
      min_originals_per_day: QUOTA_PER_DAY_MIN,
      max_originals_per_day: QUOTA_PER_DAY_MAX,
      min_week_slots: MIN_WEEKLY_SLOTS,
      max_week_slots: MAX_WEEKLY_SLOTS,
      empty_days_forbidden: true,
      mode_overlap_allowed: true,
    },
    recent_x_analytics: analytics,
    account_overview_daily: compactAccountDaily(args.accountDaily),
    analytics_rows_available: analytics.length,
    analytics_coverage_days: args.analyticsCoverageDays,
    operator_note_overlay_only: s(args.operatorNote, 180) || null,
    ...(args.extra || {}),
  };
}

export async function inferSevenDayVolume(args: {
  xaiKey: string;
  analytics: XAnalyticsPublishedPost[];
  analyticsCoverageDays: number;
  accountDaily?: XAnalyticsDailyAccountPulse[];
  intelligence: PlannerIntelligenceBlocks;
  cadence?: CadenceSignal | null;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<SevenDayVolume>> {
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 800,
    timeoutMs: args.timeoutMs ?? 20000,
    system: volumeSystem(),
    user: plannerUserPayload(args),
    parse: (raw): SevenDayVolume | null => {
      if (!raw) return null;
      const posts_per_day = clampWeekVolume(raw.posts_per_day);
      const summary = s(raw.strategy_summary || raw.summary, 600);
      if (!summary) return null;
      return {
        posts_per_day,
        summary,
        profile_diversity_intent: s(raw.profile_diversity_intent, 400),
        analytics_request_needed: raw.analytics_request_needed === true,
        analytics_request_reason: s(raw.analytics_request_reason, 300),
      };
    },
  });
}

export async function inferSevenDaySlotsForDays(args: {
  xaiKey: string;
  days: number[];
  postsPerDay: number[];
  already: PlannerSlotIntent[];
  analytics: XAnalyticsPublishedPost[];
  analyticsCoverageDays: number;
  accountDaily?: XAnalyticsDailyAccountPulse[];
  intelligence: PlannerIntelligenceBlocks;
  cadence?: CadenceSignal | null;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSlotIntent[]>> {
  const days = (args.days || []).filter((d) => d >= 0 && d < PLANNING_HORIZON_DAYS);
  const allowed = new Set(days);
  const want = days.reduce((sum, d) => sum + (args.postsPerDay[d] || QUOTA_PER_DAY_MIN), 0);
  const perDayCap = new Map(days.map((d) => [d, args.postsPerDay[d] || QUOTA_PER_DAY_MIN]));
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 2800,
    timeoutMs: args.timeoutMs ?? 28000,
    system: daySlotsSystem(days),
    user: plannerUserPayload({
      ...args,
      extra: {
        requested_day_offsets: days,
        posts_per_day: args.postsPerDay,
        slots_already_planned: (args.already || []).map((slot) => ({
          slot_id: slot.slot_id,
          day_offset: slot.day_offset,
          strategic_role: slot.strategic_role,
          editorial_mode: slot.editorial_mode,
          planner_intent: slot.planner_intent,
        })),
        required_slot_count_this_call: want,
      },
    }),
    parse: (raw): PlannerSlotIntent[] | null => {
      if (!raw || !Array.isArray(raw.slots) || want < 1) return null;
      const slots: PlannerSlotIntent[] = [];
      const seen = new Set((args.already || []).map((slot) => slot.slot_id));
      const dayCounts = new Map<number, number>();
      for (let i = 0; i < raw.slots.length && slots.length < want; i++) {
        const item = raw.slots[i] || {};
        let slotId = s(item.slot_id, 40) || `D${Number(item.day_offset) || 0}S${i + 1}`;
        if (seen.has(slotId)) slotId = `${slotId}_${slots.length + 1}`;
        const day = Math.max(0, Math.min(PLANNING_HORIZON_DAYS - 1, Math.round(Number(item.day_offset) || 0)));
        if (!allowed.has(day)) continue;
        const cap = perDayCap.get(day) || QUOTA_PER_DAY_MIN;
        const n = dayCounts.get(day) || 0;
        if (n >= cap) continue;
        const role = s(item.strategic_role, 120);
        const intent = s(item.planner_intent, 240);
        if (!role || !intent) continue;
        seen.add(slotId);
        dayCounts.set(day, n + 1);
        slots.push({
          slot_id: slotId,
          day_offset: day,
          strategic_role: role,
          editorial_mode: mode(item.editorial_mode),
          planner_intent: intent,
        });
      }
      if (slots.length !== want) return null;
      return slots;
    },
  });
}

export async function inferSevenDayStrategy(args: {
  xaiKey: string;
  analytics: XAnalyticsPublishedPost[];
  analyticsCoverageDays: number;
  accountDaily?: XAnalyticsDailyAccountPulse[];
  intelligence: PlannerIntelligenceBlocks;
  cadence?: CadenceSignal | null;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<SevenDayStrategy>> {
  const analytics = compactPublishedFlow(args.analytics || []);
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 7000,
    timeoutMs: args.timeoutMs ?? 28000,
    system: strategySystem(),
    user: {
      creator_dna: creatorDnaBlock(),
      engine_rules: engineRulesAsWill(),
      intelligence: args.intelligence,
      planning_horizon_days: PLANNING_HORIZON_DAYS,
      editorial_mode_labels: [...VALID_MODES],
      handmade_cadence: args.cadence || null,
      volume_gates: {
        min_originals_per_day: QUOTA_PER_DAY_MIN,
        max_originals_per_day: QUOTA_PER_DAY_MAX,
        min_week_slots: MIN_WEEKLY_SLOTS,
        max_week_slots: MAX_WEEKLY_SLOTS,
        empty_days_forbidden: true,
        mode_overlap_allowed: true,
      },
      recent_x_analytics: analytics,
      account_overview_daily: compactAccountDaily(args.accountDaily),
      analytics_rows_available: analytics.length,
      analytics_coverage_days: args.analyticsCoverageDays,
      operator_note_overlay_only: s(args.operatorNote, 180) || null,
    },
    parse: (raw): SevenDayStrategy | null => {
      if (!raw || !Array.isArray(raw.slots)) return null;
      const requested = Math.round(Number(raw.final_slot_count) || raw.slots.length);
      if (requested < MIN_WEEKLY_SLOTS || requested > MAX_WEEKLY_SLOTS) return null;
      const slots: PlannerSlotIntent[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < raw.slots.length && slots.length < requested; i++) {
        const item = raw.slots[i] || {};
        const slotId = s(item.slot_id, 40) || `S${i + 1}`;
        if (seen.has(slotId)) continue;
        seen.add(slotId);
        slots.push({
          slot_id: slotId,
          day_offset: Math.max(0, Math.min(PLANNING_HORIZON_DAYS - 1, Math.round(Number(item.day_offset) || 0))),
          strategic_role: s(item.strategic_role, 120),
          editorial_mode: mode(item.editorial_mode),
          planner_intent: s(item.planner_intent, 240),
        });
      }
      if (slots.length !== requested || slots.some((slot) => !slot.strategic_role || !slot.planner_intent)) return null;
      if (!strategyCoversSevenDays(slots)) return null;
      return {
        strategy_summary: s(raw.strategy_summary, 600),
        profile_diversity_intent: s(raw.profile_diversity_intent, 400),
        slots,
        analytics_rows_used: analytics.length,
        analytics_coverage_days: Math.max(0, args.analyticsCoverageDays),
        analytics_request_needed: raw.analytics_request_needed === true,
        analytics_request_reason: s(raw.analytics_request_reason, 300),
        version: SEVEN_DAY_PLANNER_VERSION,
      };
    },
  });
}

function selectionSystem(dayScoped: boolean): string {
  return [
    "You are the seven-day Planner attaching Seeds. Creator DNA already judged RETURN/BRIDGE/REACH and editorial types. Do not change those.",
    dayScoped
      ? "Assign Seeds only for chunk_slot_ids. Weekly context is for judgment. Do not emit assignments for already ASSIGNED slots."
      : "Preserve the supplied strategy types. Select one Seed from seed_pool for each strategy slot.",
    "Do not write posts and do not decide prose, tone, thought order, humor, Mechanism, Rail, hook, ending, or sentence form.",
    "Do not judge types. Do not close a type because the pool is empty — leave missing and request Seed Generator.",
    "Do not change editorial_mode. Code will not change it either.",
    "planner_intent may clarify placement for the selected Seed but must remain strategy, not writing instructions.",
    "Use only seed_id values present in seed_pool or lived_grounding. Do not invent Seeds. Do not assign one Seed to multiple slots. Do not reuse reserved_seed_ids.",
    "lived_grounding items are unused lived facts. They are not posts to rewrite. A large lived_grounding list is supply, not an EXPERIENCE quota.",
    "EXPERIENCE slots take lived_grounding owner SELF ids only. Prefer newer as_of when the situation matches. PUBLIC_X owner OTHER never goes on EXPERIENCE. Other slots take seed_pool (public) only. Do not put lived_grounding on INFORMATIVE, OPINION, COMPARE, or CASUAL_OBSERVATION.",
    "Do not place the same situation cluster on consecutive slots. FSD/driving/parking/intersection at most 2 per day. If the pool is overweight on one cluster, prefer another seed. If the seed is not FSD, do not pick a seed that bolts on charging, Uber, or generic driving.",
    "If no current candidate fits a non-EXPERIENCE slot, leave it unassigned and return a bounded exploration_direction describing the field.",
    `If an EXPERIENCE slot has no unused lived_grounding, leave it in missing with exploration_direction ${LIVED_GROUNDING_INSUFFICIENT}. Do not assign a public seed. Do not change Mode.`,
    "If must_fill is true, fill non-EXPERIENCE chunk slots from unused seed_pool. EXPERIENCE without unused lived_grounding still goes to missing as lived_grounding_insufficient. Do not invent a Seed.",
    "Return strict JSON with assignments and missing arrays. Assignment keys: slot_id, seed_id, planner_intent, editorial_mode. Missing keys: slot_id, exploration_direction. No prose outside JSON.",
  ].join("\n");
}

function compactSeedForSelect(seed: ConcreteSeed) {
  const occurred = String((seed as any).occurred_at || (seed as any).published_at || "");
  const recency = isLivedSelfSeed(seed as any) ? livedAsOf(occurred || undefined) : null;
  const scene = s(seed.concrete_subject, 80);
  const tension = s(seed.point_or_tension, 80);
  return {
    seed_id: seed.seed_id,
    scene,
    tension: tension || null,
    source: String((seed as any).source_kind || (seed as any).source || seed.cluster || "").slice(0, 32) || null,
    owner: (seed as any).owner || "OTHER",
    freshness: recency ? { as_of: recency.as_of, days_ago: recency.days_ago } : null,
    cluster: seed.cluster,
    viral: !!(seed as any).viral,
  };
}

function compactLivedGrounding(seed: ConcreteSeed) {
  const occurred = String((seed as any).occurred_at || (seed as any).published_at || "");
  const recency = livedAsOf(occurred || undefined);
  const facts = Array.isArray((seed as any).experience_facts)
    ? (seed as any).experience_facts.map((x: unknown) => s(x, 72)).filter(Boolean).slice(0, 3)
    : [];
  return {
    seed_id: seed.seed_id,
    kind: "LIVED_GROUNDING",
    cluster: seed.cluster,
    facts,
    as_of: recency.as_of,
    days_ago: recency.days_ago,
    owner: "SELF",
  };
}

function seedFitsSlotMode(seed: ConcreteSeed | undefined, mode: string): boolean {
  const m = String(mode || "").toUpperCase();
  const lived = isLivedSelfSeed(seed as any);
  if (m === "EXPERIENCE") return !!lived;
  return !lived;
}

function compactSlotForSelect(slot: PlannerSlotIntent) {
  return {
    slot_id: slot.slot_id,
    day_offset: slot.day_offset,
    strategic_role: slot.strategic_role,
    editorial_mode: slot.editorial_mode,
    planner_intent: slot.planner_intent,
  };
}

export function parsePlannerSelection(
  raw: any,
  slots: PlannerSlotIntent[],
  validSeedIds: Set<string>,
  reservedSeedIds: Set<string>,
  pool: ConcreteSeed[] = [],
  mustFill = false,
): PlannerSelection | null {
  if (!raw || !Array.isArray(raw.assignments)) return null;
  if (!mustFill && !Array.isArray(raw.missing)) return null;
  const validSlotIds = new Set(slots.map((slot) => slot.slot_id));
  const seedById = new Map(pool.map((seed) => [String(seed.seed_id || ""), seed]));
  const assignments: PlannerSeedAssignment[] = [];
  const missing: PlannerExplorationRequest[] = [];
  const usedSlots = new Set<string>();
  const usedSeeds = new Set<string>([...reservedSeedIds]);
  const unusedLivedLeft = () => pool.some((seed) => {
    const id = String(seed.seed_id || "");
    return id && validSeedIds.has(id) && !usedSeeds.has(id) && isLivedSelfSeed(seed as any);
  });
  const experienceMissingDirection = () =>
    unusedLivedLeft() ? "EXPERIENCE" : LIVED_GROUNDING_INSUFFICIENT;
  for (const item of raw.assignments) {
    const slotId = s(item?.slot_id, 40);
    const seedId = s(item?.seed_id, 100);
    if (!validSlotIds.has(slotId) || !validSeedIds.has(seedId) || usedSlots.has(slotId) || usedSeeds.has(seedId)) continue;
    const strategySlot = slots.find((slot) => slot.slot_id === slotId)!;
    const seed = seedById.get(seedId);
    if (!seedFitsSlotMode(seed, strategySlot.editorial_mode)) continue;
    usedSlots.add(slotId);
    usedSeeds.add(seedId);
    assignments.push({
      slot_id: slotId,
      seed_id: seedId,
      planner_intent: s(item?.planner_intent, 240) || strategySlot.planner_intent,
      editorial_mode: strategySlot.editorial_mode,
    });
  }
  if (mustFill) {
    const unfilledPublic = slots.filter((slot) =>
      String(slot.editorial_mode || "").toUpperCase() !== "EXPERIENCE" && !usedSlots.has(slot.slot_id),
    );
    if (unfilledPublic.length) return null;
  }
  for (const item of raw.missing || []) {
    const slotId = s(item?.slot_id, 40);
    if (!validSlotIds.has(slotId) || usedSlots.has(slotId)) continue;
    const strategySlot = slots.find((slot) => slot.slot_id === slotId);
    const livedHole = String(strategySlot?.editorial_mode || "").toUpperCase() === "EXPERIENCE";
    const direction = livedHole
      ? experienceMissingDirection()
      : s(item?.exploration_direction, 240);
    if (!direction) continue;
    usedSlots.add(slotId);
    missing.push({ slot_id: slotId, exploration_direction: direction });
  }
  for (const slot of slots) {
    if (!usedSlots.has(slot.slot_id)) {
      missing.push({
        slot_id: slot.slot_id,
        exploration_direction: String(slot.editorial_mode || "").toUpperCase() === "EXPERIENCE"
          ? experienceMissingDirection()
          : slot.planner_intent,
      });
    }
  }
  if (mustFill && missing.some((item) => item.exploration_direction === "EXPERIENCE")) return null;
  const diversified = pool.length
    ? diversifyAssignments(assignments, slots, pool)
    : assignments;
  const kept: PlannerSeedAssignment[] = [];
  const usedAfter = new Set<string>();
  for (const item of diversified) {
    const strategySlot = slots.find((slot) => slot.slot_id === item.slot_id);
    const seed = seedById.get(item.seed_id);
    if (!strategySlot || !seedFitsSlotMode(seed, strategySlot.editorial_mode) || usedAfter.has(item.slot_id)) {
      if (strategySlot && !usedAfter.has(item.slot_id) && String(strategySlot.editorial_mode || "").toUpperCase() === "EXPERIENCE") {
        missing.push({ slot_id: item.slot_id, exploration_direction: experienceMissingDirection() });
        usedAfter.add(item.slot_id);
      }
      continue;
    }
    usedAfter.add(item.slot_id);
    kept.push({ ...item, editorial_mode: strategySlot.editorial_mode });
  }
  const stillMissing = missing.filter((item) => !kept.some((a) => a.slot_id === item.slot_id));
  for (const slot of slots) {
    if (!kept.some((a) => a.slot_id === slot.slot_id) && !stillMissing.some((m) => m.slot_id === slot.slot_id)) {
      stillMissing.push({
        slot_id: slot.slot_id,
        exploration_direction: String(slot.editorial_mode || "").toUpperCase() === "EXPERIENCE"
          ? experienceMissingDirection()
          : slot.planner_intent,
      });
    }
  }
  if (mustFill) {
    const unfilledPublic = slots.filter((slot) =>
      String(slot.editorial_mode || "").toUpperCase() !== "EXPERIENCE"
      && !kept.some((a) => a.slot_id === slot.slot_id),
    );
    if (unfilledPublic.length) return null;
    if (stillMissing.some((item) => item.exploration_direction === "EXPERIENCE")) return null;
  }
  return { assignments: kept, missing: stillMissing, version: SEVEN_DAY_PLANNER_VERSION };
}

export async function selectSeedsForSevenDayPlan(args: {
  xaiKey: string;
  strategy: SevenDayStrategy;
  seedPool: ConcreteSeed[];
  livedGrounding?: ConcreteSeed[];
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSelection>> {
  const publicPool = (args.seedPool || []).filter((seed) => !isLivedSelfSeed(seed as any)).slice(0, 96);
  const lived = (args.livedGrounding || (args.seedPool || []).filter((seed) => isLivedSelfSeed(seed as any))).slice(0, 80);
  const pool = [...lived, ...publicPool];
  const validSeedIds = new Set(pool.map((seed) => String(seed.seed_id || "")));
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 6000,
    timeoutMs: args.timeoutMs,
    system: selectionSystem(false),
    user: {
      seven_day_strategy: args.strategy,
      seed_pool: publicPool.map(compactSeedForSelect),
      lived_grounding: lived.map(compactLivedGrounding),
    },
    parse: (raw) => parsePlannerSelection(raw, args.strategy.slots, validSeedIds, new Set(), pool),
  });
}

/** Live job: bounded unassigned slots per tick. Weekly context stays. */
export async function selectSeedsForChunk(args: {
  xaiKey: string;
  strategy: SevenDayStrategy;
  seedPool: ConcreteSeed[];
  chunkSlots: PlannerSlotIntent[];
  alreadyAssigned?: PlannerSeedAssignment[];
  lastLivedReject?: Array<{ slot_id: string; rejected_seed_id: string; cluster: string; newer: Array<{ seed_id: string }> }>;
  livedGrounding?: ConcreteSeed[];
  mustFill?: boolean;
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSelection>> {
  const assigned = args.alreadyAssigned || [];
  const assignedSlotIds = new Set(assigned.map((item) => String(item.slot_id || "")));
  const reservedSeedIds = new Set(assigned.map((item) => String(item.seed_id || "")).filter(Boolean));
  for (const item of args.lastLivedReject || []) {
    if (item.rejected_seed_id) reservedSeedIds.add(String(item.rejected_seed_id));
  }
  const slots = (args.chunkSlots || []).filter((slot) => !assignedSlotIds.has(slot.slot_id));
  const publicPool = (args.seedPool || []).filter((seed) =>
    !isLivedSelfSeed(seed as any) && !reservedSeedIds.has(String(seed.seed_id || "")),
  );
  const lived = (args.livedGrounding || (args.seedPool || []).filter((seed) => isLivedSelfSeed(seed as any)))
    .filter((seed) => !reservedSeedIds.has(String(seed.seed_id || "")));
  const pool = [...lived, ...publicPool];
  const validSeedIds = new Set(pool.map((seed) => String(seed.seed_id || "")));
  const seedById = new Map(pool.map((seed) => [String(seed.seed_id), seed]));
  const week = (args.strategy.slots || []).map((slot) => {
    const hit = assigned.find((item) => item.slot_id === slot.slot_id);
    return {
      slot_id: slot.slot_id,
      day_offset: slot.day_offset,
      strategic_role: slot.strategic_role,
      editorial_mode: slot.editorial_mode,
      planner_intent: slot.planner_intent,
      seed_state: hit ? "ASSIGNED" : (slots.some((s) => s.slot_id === slot.slot_id) ? "ASSIGNING" : "UNASSIGNED"),
      seed_id: hit?.seed_id || "",
    };
  });
  const usedClusters = assigned
    .map((item) => seedById.get(item.seed_id)?.cluster || "")
    .filter(Boolean);
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 1600,
    timeoutMs: args.timeoutMs ?? 28000,
    system: selectionSystem(true),
    user: {
      strategy_summary: args.strategy.strategy_summary,
      week_slots: week,
      chunk_slot_ids: slots.map((s) => s.slot_id),
      assigned_seed_ids: [...reservedSeedIds],
      last_lived_reject: args.lastLivedReject || [],
      must_fill: args.mustFill === true,
      unassigned_slot_ids: week.filter((s) => s.seed_state !== "ASSIGNED").map((s) => s.slot_id),
      used_clusters: usedClusters,
      seed_pool: publicPool.map(compactSeedForSelect),
      lived_grounding: lived.map(compactLivedGrounding),
    },
    parse: (raw) => parsePlannerSelection(raw, slots, validSeedIds, reservedSeedIds, pool, args.mustFill === true),
  });
}

/** Live job: two days per tick. Compact payload. Does not close the week. */
export async function selectSeedsForDays(args: {
  xaiKey: string;
  strategy: SevenDayStrategy;
  seedPool: ConcreteSeed[];
  days: number[];
  alreadyAssigned?: PlannerSeedAssignment[];
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSelection>> {
  const daySet = new Set((args.days || []).map((d) => Math.max(0, Math.min(PLANNING_HORIZON_DAYS - 1, Math.round(Number(d) || 0)))));
  const assigned = args.alreadyAssigned || [];
  const assignedSlotIds = new Set(assigned.map((item) => String(item.slot_id || "")));
  const slots = args.strategy.slots.filter((slot) => daySet.has(slot.day_offset) && !assignedSlotIds.has(slot.slot_id));
  return selectSeedsForChunk({
    xaiKey: args.xaiKey,
    strategy: args.strategy,
    seedPool: args.seedPool,
    chunkSlots: slots,
    alreadyAssigned: assigned,
    timeoutMs: args.timeoutMs,
  });
}

/** Attach Seeds to already-judged slots. Does not change RETURN/BRIDGE/REACH or types. */
export async function attachSeedsForSlots(args: {
  xaiKey: string;
  strategy: SevenDayStrategy;
  slots: PlannerSlotIntent[];
  seedPool: ConcreteSeed[];
  reservedSeedIds?: string[];
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSelection>> {
  const reservedSeedIds = new Set((args.reservedSeedIds || []).filter(Boolean));
  const slots = args.slots || [];
  const publicPool = (args.seedPool || []).filter((seed) =>
    !isLivedSelfSeed(seed as any) && !reservedSeedIds.has(String(seed.seed_id || "")),
  ).slice(0, 96);
  const lived = (args.seedPool || []).filter((seed) =>
    isLivedSelfSeed(seed as any) && !reservedSeedIds.has(String(seed.seed_id || "")),
  ).slice(0, 80);
  const pool = [...lived, ...publicPool];
  const validSeedIds = new Set(pool.map((seed) => String(seed.seed_id || "")));
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 2000,
    timeoutMs: args.timeoutMs ?? 28000,
    system: selectionSystem(true),
    user: {
      strategy_summary: args.strategy.strategy_summary,
      slots: slots.map(compactSlotForSelect),
      reserved_seed_ids: [...reservedSeedIds],
      seed_pool: publicPool.map(compactSeedForSelect),
      lived_grounding: lived.map(compactLivedGrounding),
    },
    parse: (raw) => parsePlannerSelection(raw, slots, validSeedIds, reservedSeedIds, pool),
  });
}

function recoverySystem(): string {
  return [
    "You are the seven-day Planner attaching a Seed after Creator DNA relabeled a Judge-rejected slot.",
    "Do not change growth_role or editorial_mode. Creator DNA already judged those. Place a Seed only.",
    "Use the existing Seed pool first. Do not write the post and do not prescribe creative form.",
    "If an existing Seed fits, choose RESELECT_EXISTING and a seed_id from available_seed_pool. Reusing the rejected Seed is allowed when the seven-day plan still needs that kind, unless it is in abandoned_seed_ids. abandoned_seed_ids are discarded Seeds: never pick them. already_saved_seed_ids and remaining_unwritten_seed_ids are facts, not bans. If none fits, choose TARGETED_EXPLORE and describe only the field/direction Seed Generator should explore. Seed Generator will then return a batch of candidates in that field, not one seed.",
    "Do not treat a different possible writing choice as a reason to redesign strategy. Use Judge reasons only to understand why the final post was not publishable.",
    "Return strict JSON with action, seed_id, strategic_role, editorial_mode, planner_intent, exploration_direction. Copy the supplied role and mode. No prose outside JSON.",
  ].join("\n");
}

export async function recoverRejectedPlannerSlot(args: {
  xaiKey: string;
  strategy: SevenDayStrategy;
  rejectedSlot: Record<string, unknown>;
  judgeReasons: string[];
  availableSeedPool: ConcreteSeed[];
  poolFacts?: {
    rejected_seed_id?: string;
    already_saved_seed_ids?: string[];
    remaining_unwritten_seed_ids?: string[];
    abandoned_seed_ids?: string[];
  };
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerRecovery>> {
  const pool = (args.availableSeedPool || []).slice(0, 96);
  const validSeedIds = new Set(pool.map((seed) => String(seed.seed_id || "")));
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 2200,
    timeoutMs: args.timeoutMs,
    system: recoverySystem(),
    user: {
      seven_day_strategy: args.strategy,
      rejected_slot: args.rejectedSlot,
      semantic_judge_reasons: (args.judgeReasons || []).map((reason) => s(reason, 120)).slice(0, 12),
      pool_facts: args.poolFacts || {},
      available_seed_pool: pool.map((seed) => ({
        seed_id: seed.seed_id,
        cluster: seed.cluster,
        concrete_subject: seed.concrete_subject,
        point_or_tension: seed.point_or_tension || null,
        grounding_reasons: seed.grounding_reasons || [],
      })),
    },
    parse: (raw): PlannerRecovery | null => {
      if (!raw) return null;
      const action = s(raw.action, 40).toUpperCase();
      if (action !== "RESELECT_EXISTING" && action !== "TARGETED_EXPLORE") return null;
      const seedId = s(raw.seed_id, 100);
      const direction = s(raw.exploration_direction, 240);
      if (action === "RESELECT_EXISTING" && !validSeedIds.has(seedId)) return null;
      if (action === "TARGETED_EXPLORE" && !direction) return null;
      return {
        action,
        seed_id: action === "RESELECT_EXISTING" ? seedId : "",
        strategic_role: s(raw.strategic_role, 120),
        editorial_mode: mode(raw.editorial_mode),
        planner_intent: s(raw.planner_intent, 240),
        exploration_direction: action === "TARGETED_EXPLORE" ? direction : "",
        version: SEVEN_DAY_PLANNER_VERSION,
      };
    },
  });
}
