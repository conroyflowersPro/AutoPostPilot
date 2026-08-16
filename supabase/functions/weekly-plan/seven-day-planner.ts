/**
 * Seven-day Planner.
 *
 * Seed Generator explores. Planner strategizes, selects, allocates, and
 * recovers. Writer creates. Judge only validates the final post.
 *
 * Every exported call is one xAI request so generation-job can persist between
 * ticks and stay resumable on mobile.
 */
import type { ConcreteSeed, EditorialMode } from "./seed-engine.ts";
import { creatorDnaBlock, engineRulesAsWill } from "./engine-dna.ts";
import { plannerArchitectureLock } from "./engine-architecture.ts";
import type { PlannerIntelligenceBlocks } from "./planner-intelligence.ts";

export const SEVEN_DAY_PLANNER_VERSION = "seven_day_planner_v1";
export const PLANNING_HORIZON_DAYS = 7;

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

function loadBundledXAnalyticsWindow(): {
  rows: XAnalyticsPublishedPost[];
  account_daily: XAnalyticsDailyAccountPulse[];
} {
  try {
    const raw = Deno.readTextFileSync(new URL("./x-analytics-30d-window.json", import.meta.url));
    const parsed = JSON.parse(raw);
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
  } catch {
    return { rows: [], account_daily: [] };
  }
}

export async function loadRecentXAnalyticsPublished(
  supabase: { from: (table: string) => any },
  days = 30,
): Promise<{
  rows: XAnalyticsPublishedPost[];
  coverage_days: number;
  account_daily: XAnalyticsDailyAccountPulse[];
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
    };
  } catch {
    rows.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
    return {
      rows,
      coverage_days: dates.size,
      account_daily: bundled.account_daily.filter((d) => Date.parse(d.date) >= Date.parse(since)),
    };
  }
}

export type PlannerSlotIntent = {
  slot_id: string;
  day_offset: number;
  strategic_role: string;
  editorial_mode: EditorialMode;
  planner_intent: string;
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

type PlannerCallResult<T> = {
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

async function callPlanner<T>(args: {
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
    d: s(row.published_at, 10),
    t: s(row.content, 72),
    fol: Number(row.metrics?.followers_gained) || 0,
    pv: Number(row.metrics?.profile_visits) || 0,
    bm: Number(row.metrics?.bookmarks) || 0,
    rp: Number(row.metrics?.replies) || 0,
    imp: Number(row.metrics?.impressions) || 0,
  }));
}

function compactAccountDaily(rows: XAnalyticsDailyAccountPulse[] | undefined) {
  return (rows || []).slice(0, 31).map((row) => ({
    d: s(row.date, 10),
    fol: Number(row.new_follows) || 0,
    unf: Number(row.unfollows) || 0,
    pv: Number(row.profile_visits) || 0,
    bm: Number(row.bookmarks) || 0,
    imp: Number(row.impressions) || 0,
  }));
}

function strategySystem(): string {
  return [
    "You are the seven-day Planner for @Seung4680.",
    plannerArchitectureLock(),
    "Your only job in this call is to infer the seven-day account strategy and slot intents. Do not inspect or select Seeds. Do not write posts. Do not choose prose, thought order, tone, humor, Mechanism, Rail, hook, ending, or sentence form.",
    "Planning Horizon is seven days. Intelligence horizons remain whatever their evidence supports.",
    "Use only recent_x_analytics as the recent published-flow record. It contains actual published X Analytics rows, up to 30 days, compacted to date, short text, and outcome metrics. Do not substitute drafts, Seed candidates, virtual plans, or estimated missing days.",
    "account_overview_daily is account-level daily context only. Use it for cadence and profile-level trend, never to attribute an account total to an individual post.",
    "Recent repetition is profile-level strategic context. Do not ban or penalize an Editorial Mode merely because it appeared often. Infer whether the account has become monotonously similar overall, then adjust this seven-day composition.",
    "No fixed mode ratio, no fixed topic ratio, no pattern rotation. Infer the strategy for this cycle.",
    "capacity_recommendation is operational context, not a command. Choose a final slot count that is credible for seven days and return exactly that many slot intents.",
    "If available analytics are thin, use only what exists. Do not estimate missing dates. Set analytics_request_needed only when additional real X Analytics is materially needed.",
    "Each slot contains strategic_role, editorial_mode, and planner_intent only. planner_intent says why this slot exists and what it should accomplish—not how to write it.",
    "Return strict JSON with top-level keys strategy_summary, profile_diversity_intent, final_slot_count, slots, analytics_request_needed, analytics_request_reason. Each slot has slot_id, day_offset, strategic_role, editorial_mode, planner_intent. No prose outside JSON.",
  ].join("\n");
}

export async function inferSevenDayStrategy(args: {
  xaiKey: string;
  capacityRecommendation: number;
  analytics: XAnalyticsPublishedPost[];
  analyticsCoverageDays: number;
  accountDaily?: XAnalyticsDailyAccountPulse[];
  intelligence: PlannerIntelligenceBlocks;
  operatorNote?: string;
  timeoutMs?: number;
}): Promise<PlannerCallResult<SevenDayStrategy>> {
  const analytics = compactPublishedFlow(args.analytics || []);
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 2800,
    timeoutMs: args.timeoutMs ?? 22000,
    system: strategySystem(),
    user: {
      creator_dna: creatorDnaBlock(),
      engine_rules: engineRulesAsWill(),
      intelligence: args.intelligence,
      planning_horizon_days: PLANNING_HORIZON_DAYS,
      editorial_mode_labels: [...VALID_MODES],
      capacity_recommendation: args.capacityRecommendation,
      recent_x_analytics: analytics,
      account_overview_daily: compactAccountDaily(args.accountDaily),
      analytics_rows_available: analytics.length,
      analytics_coverage_days: args.analyticsCoverageDays,
      operator_note_overlay_only: s(args.operatorNote, 180) || null,
    },
    parse: (raw): SevenDayStrategy | null => {
      if (!raw || !Array.isArray(raw.slots)) return null;
      const requested = Math.max(1, Math.min(56, Math.round(Number(raw.final_slot_count) || raw.slots.length)));
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

function selectionSystem(): string {
  return [
    "You are the seven-day Planner selecting and allocating Seeds after strategy already exists.",
    "Preserve the supplied strategy. Select one Seed from seed_pool for each strategy slot. Do not write posts and do not decide prose, tone, thought order, humor, Mechanism, Rail, hook, ending, or sentence form.",
    "Seed Generator explored; you own strategic fit, selection, and allocation. Do not use a fixed ratio, numeric ranking system, or frozen mapping.",
    "planner_intent may clarify the strategic purpose for the selected Seed but must remain strategy, not writing instructions.",
    "Use only seed_id values present in seed_pool. Do not invent Seeds. Do not assign one Seed to multiple slots.",
    "If no current candidate fits a slot, leave it unassigned and return a bounded exploration_direction describing the field the Seed Generator should explore. Do not choose a final Seed in that direction.",
    "Return strict JSON with assignments and missing arrays. Assignment keys: slot_id, seed_id, planner_intent, editorial_mode. Missing keys: slot_id, exploration_direction. No prose outside JSON.",
  ].join("\n");
}

export async function selectSeedsForSevenDayPlan(args: {
  xaiKey: string;
  strategy: SevenDayStrategy;
  seedPool: ConcreteSeed[];
  timeoutMs?: number;
}): Promise<PlannerCallResult<PlannerSelection>> {
  const pool = (args.seedPool || []).slice(0, 96);
  const validSeedIds = new Set(pool.map((seed) => String(seed.seed_id || "")));
  const validSlotIds = new Set(args.strategy.slots.map((slot) => slot.slot_id));
  return callPlanner({
    xaiKey: args.xaiKey,
    maxTokens: 6000,
    timeoutMs: args.timeoutMs,
    system: selectionSystem(),
    user: {
      seven_day_strategy: args.strategy,
      seed_pool: pool.map((seed) => ({
        seed_id: seed.seed_id,
        cluster: seed.cluster,
        concrete_subject: seed.concrete_subject,
        point_or_tension: seed.point_or_tension || null,
        grounding_reasons: seed.grounding_reasons || [],
        creator_evidence_available: !!seed.creator_evidence_available,
      })),
    },
    parse: (raw): PlannerSelection | null => {
      if (!raw || !Array.isArray(raw.assignments) || !Array.isArray(raw.missing)) return null;
      const assignments: PlannerSeedAssignment[] = [];
      const missing: PlannerExplorationRequest[] = [];
      const usedSlots = new Set<string>();
      const usedSeeds = new Set<string>();
      for (const item of raw.assignments) {
        const slotId = s(item?.slot_id, 40);
        const seedId = s(item?.seed_id, 100);
        if (!validSlotIds.has(slotId) || !validSeedIds.has(seedId) || usedSlots.has(slotId) || usedSeeds.has(seedId)) continue;
        usedSlots.add(slotId);
        usedSeeds.add(seedId);
        const strategySlot = args.strategy.slots.find((slot) => slot.slot_id === slotId)!;
        assignments.push({
          slot_id: slotId,
          seed_id: seedId,
          planner_intent: s(item?.planner_intent, 240) || strategySlot.planner_intent,
          editorial_mode: strategySlot.editorial_mode,
        });
      }
      for (const item of raw.missing) {
        const slotId = s(item?.slot_id, 40);
        const direction = s(item?.exploration_direction, 240);
        if (!validSlotIds.has(slotId) || usedSlots.has(slotId) || !direction) continue;
        usedSlots.add(slotId);
        missing.push({ slot_id: slotId, exploration_direction: direction });
      }
      for (const slot of args.strategy.slots) {
        if (!usedSlots.has(slot.slot_id)) {
          missing.push({ slot_id: slot.slot_id, exploration_direction: slot.planner_intent });
        }
      }
      return { assignments, missing, version: SEVEN_DAY_PLANNER_VERSION };
    },
  });
}

function recoverySystem(): string {
  return [
    "You are the seven-day Planner recovering one slot after Semantic Judge rejected a completed post.",
    "Judge rejection is not permanent Seed rejection. Reconsider the slot in the context of the whole seven-day strategy.",
    "Use the existing Seed pool first. You may preserve or adjust the slot strategic role, Editorial Mode, and Planner Intent. Do not write the post and do not prescribe creative form.",
    "If an existing Seed fits, choose RESELECT_EXISTING and a seed_id from available_seed_pool. Reusing the rejected Seed is allowed when the seven-day plan still needs that kind, unless it is in abandoned_seed_ids. abandoned_seed_ids are discarded Seeds: never pick them. already_saved_seed_ids and remaining_unwritten_seed_ids are facts, not bans. If none fits, choose TARGETED_EXPLORE and describe only the field/direction Seed Generator should explore. Seed Generator will then return a batch of candidates in that field, not one seed.",
    "Do not treat a different possible writing choice as a reason to redesign strategy. Use Judge reasons only to understand why the final post was not publishable.",
    "Return strict JSON with action, seed_id, strategic_role, editorial_mode, planner_intent, exploration_direction. No prose outside JSON.",
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
