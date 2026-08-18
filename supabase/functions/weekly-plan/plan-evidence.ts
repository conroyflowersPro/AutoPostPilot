/**
 * Agent승 WEEKLY plan evidence. Canonical Post/Analytics/Sync rows only.
 * Do not invent Topic→Role, Topic→time, or USER_DIRECT-ratio slot recipes.
 * Collection API is not called here.
 */
import { isSyncOriginal } from "./audience-x-status.ts";

export const AGENT_SEUNG_PLAN_EVIDENCE_VERSION = "agent-seung-plan-evidence-v1";

export type PlanOrigin = "USER_DIRECT" | "AP_PIPELINE" | "UNKNOWN";

export type CompactPlanMetrics = {
  id: string;
  d: string;
  t: string;
  origin: PlanOrigin;
  fol: number;
  pv: number;
  bm: number;
  rp: number;
  rps: number;
  qt: number;
  lk: number;
  imp: number;
  sh: number;
  de: number;
};

export type OriginPopulation = {
  origin: PlanOrigin;
  originals: number;
  recent_times: string[];
  posts: CompactPlanMetrics[];
};

export type AgentSeungPlanEvidence = {
  version: string;
  analytics_coverage_days: number;
  account_daily: Array<{
    d: string;
    fol: number;
    unf: number;
    pv: number;
    bm: number;
    rp: number;
    rps: number;
    lk: number;
    imp: number;
  }>;
  user_direct: OriginPopulation;
  ap_pipeline: OriginPopulation;
  unknown: OriginPopulation;
  sync_gap: {
    user_direct: CompactPlanMetrics[];
    ap_pipeline: CompactPlanMetrics[];
    unknown: CompactPlanMetrics[];
  };
  occupied_times: string[];
  start_date: string;
  notes: string[];
  fedica_best_posting_time: {
    status: "present" | "missing" | "stale";
    windows: unknown;
    note: string;
  };
};

const AP_ORIGIN =
  /AP_PIPELINE|APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED|SYSTEM_ASSISTED/;
const DIRECT_ORIGIN = /USER_DIRECT|MANUAL|HANDMADE|CREATOR_DIRECT/;

export function classifyPlanOrigin(value: string | null | undefined): PlanOrigin {
  const v = String(value || "").toUpperCase().trim();
  if (!v) return "UNKNOWN";
  if (DIRECT_ORIGIN.test(v)) return "USER_DIRECT";
  if (AP_ORIGIN.test(v)) return "AP_PIPELINE";
  return "UNKNOWN";
}

function s(v: unknown, max = 72): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function isoDay(raw: string): string {
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return String(raw || "").slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

export function compactPlanMetrics(row: {
  post_id?: string | null;
  x_post_id?: string | null;
  published_at?: string;
  content?: string;
  text_body?: string;
  origin?: PlanOrigin;
  metrics?: Record<string, number | null | undefined>;
  followers_gained?: number;
  profile_visits?: number;
  bookmarks?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  likes?: number;
  impressions?: number;
  shares?: number;
  detail_expands?: number;
}): CompactPlanMetrics {
  const m = row.metrics || {};
  const origin = row.origin || "UNKNOWN";
  const text = origin === "USER_DIRECT" ? s(row.content || row.text_body, 72) : "";
  return {
    id: s(row.post_id || row.x_post_id, 40),
    d: s(row.published_at, 40),
    t: text,
    origin,
    fol: n(m.followers_gained ?? row.followers_gained),
    pv: n(m.profile_visits ?? row.profile_visits),
    bm: n(m.bookmarks ?? row.bookmarks),
    rp: n(m.replies ?? row.replies),
    rps: n(m.reposts ?? row.reposts),
    qt: n(m.quotes ?? row.quotes),
    lk: n(m.likes ?? row.likes),
    imp: n(m.impressions ?? row.impressions),
    sh: n(m.shares ?? row.shares),
    de: n(m.detail_expands ?? row.detail_expands),
  };
}

export function emptyOriginPopulation(origin: PlanOrigin): OriginPopulation {
  return { origin, originals: 0, recent_times: [], posts: [] };
}

function bagPosts(rows: CompactPlanMetrics[], origin: PlanOrigin, cap = 120): OriginPopulation {
  const posts = rows.filter((r) => r.origin === origin).slice(0, cap);
  return {
    origin,
    originals: posts.length,
    recent_times: posts.map((p) => p.d).filter(Boolean).slice(0, 40),
    posts,
  };
}

export const PLAN_EVIDENCE_NOTES = [
  "Analytics is primary performance evidence. Keep metric columns separate. Do not collapse into one engagement score.",
  "Sync fills Analytics holes only. A post already in Analytics is not a second evidence row.",
  "UNKNOWN origin is not USER_DIRECT. Keep its performance metrics. Do not use it as voice, emergence, or handmade thinking evidence.",
  "Do not average USER_DIRECT and AP_PIPELINE into one success population. Do not learn Creator Voice from AP_PIPELINE.",
  "Complexity/Emergence is a judgment, not a mix recipe: is planned AP going rigid, where is USER_DIRECT moving, can Identity stay while Growth opens. No fixed USER_DIRECT ratio. No fixed slot pattern.",
  "Date and time are part of the seven-day strategy. Consider freshness, same-author density, and time for each original to earn engagement.",
  "Adjacent planned originals need at least 2 hours. That is a constraint. Do not emit a repeating clock grid. Do not add jitter to look irregular.",
  "14:00–22:00 PT are audience hours to consider, not an AP For You window and not a template.",
  "Fedica Best Posting Time is timing evidence when present. If missing, say so. Do not replace it with a 14:00–22:00 grid.",
  "Do not invent Topic→Role, Topic→time, Editorial Mode→time, or USER_DIRECT-ratio slot mappings. Infer this job from the evidence.",
] as const;

export function emptyFedicaBestPostingTime(): AgentSeungPlanEvidence["fedica_best_posting_time"] {
  return {
    status: "missing",
    windows: null,
    note: "Fedica Best Posting Time not loaded. Missing evidence. Do not substitute a 14:00–22:00 clock.",
  };
}

const BPT_KEY =
  /best.?posting.?time|best\s*time|posting[_\s-]*time|reach by time|followers by time|최적.*시간|게시\s*시간|타임존|timezone/i;

export function extractFedicaBestPostingTime(raw: unknown): AgentSeungPlanEvidence["fedica_best_posting_time"] {
  const hits: Record<string, unknown> = {};
  const walk = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${k}` : k;
      if (BPT_KEY.test(k) || (typeof v === "string" && BPT_KEY.test(v))) hits[keyPath] = v;
      if (v && typeof v === "object") walk(v, keyPath);
    }
  };
  walk(raw, "");
  if (!Object.keys(hits).length) return emptyFedicaBestPostingTime();
  return {
    status: "present",
    windows: hits,
    note: "Fedica Best Posting Time is timing evidence. Not Audience DNA. Not a clock template.",
  };
}

export function buildAgentSeungPlanEvidence(args: {
  startDate: string;
  analyticsPosts: Array<{
    post_id?: string | null;
    published_at?: string;
    content?: string;
    metrics?: Record<string, number | null | undefined>;
  }>;
  analyticsCoverageDays?: number;
  accountDaily?: Array<Record<string, unknown>>;
  syncPosts: Array<{
    x_post_id?: string | null;
    published_at?: string;
    text_body?: string;
    action_type?: string;
    post_type?: string;
    system_origin_class?: string | null;
    origin?: string | null;
  }>;
  occupiedTimes?: string[];
  originByPostId?: Record<string, PlanOrigin | string>;
  fedicaBestPostingTime?: AgentSeungPlanEvidence["fedica_best_posting_time"] | null;
}): AgentSeungPlanEvidence {
  const originById = args.originByPostId || {};
  const analyticsRows: CompactPlanMetrics[] = [];
  const analyticsIds = new Set<string>();
  for (const row of args.analyticsPosts || []) {
    const id = String(row.post_id || "").trim();
    if (id) analyticsIds.add(id);
    analyticsRows.push(
      compactPlanMetrics({
        ...row,
        origin: classifyPlanOrigin(originById[id] || ""),
      }),
    );
  }
  const syncGapDirect: CompactPlanMetrics[] = [];
  const syncGapAp: CompactPlanMetrics[] = [];
  const syncGapUnknown: CompactPlanMetrics[] = [];
  const syncOriginTimes: Array<{ origin: PlanOrigin; at: string }> = [];
  for (const row of args.syncPosts || []) {
    if (!isSyncOriginal(row)) continue;
    const id = String(row.x_post_id || "").trim();
    const origin = classifyPlanOrigin(row.system_origin_class || row.origin);
    const at = String(row.published_at || "");
    if (at) syncOriginTimes.push({ origin, at });
    if (id && analyticsIds.has(id)) continue;
    const compact = compactPlanMetrics({
      post_id: id,
      published_at: at,
      text_body: row.text_body,
      origin,
    });
    if (origin === "AP_PIPELINE") syncGapAp.push(compact);
    else if (origin === "USER_DIRECT") syncGapDirect.push(compact);
    else syncGapUnknown.push(compact);
  }
  const userDirect = bagPosts(analyticsRows, "USER_DIRECT");
  const apPipeline = bagPosts(analyticsRows, "AP_PIPELINE");
  const unknown = bagPosts(analyticsRows, "UNKNOWN");
  for (const hit of syncOriginTimes) {
    const target =
      hit.origin === "AP_PIPELINE" ? apPipeline : hit.origin === "USER_DIRECT" ? userDirect : unknown;
    if (hit.at && !target.recent_times.includes(hit.at)) {
      target.recent_times.push(hit.at);
    }
  }
  userDirect.originals = Math.max(userDirect.originals, userDirect.recent_times.length);
  apPipeline.originals = Math.max(apPipeline.originals, apPipeline.recent_times.length);
  unknown.originals = Math.max(unknown.originals, unknown.recent_times.length);

  const dates = new Set(analyticsRows.map((r) => isoDay(r.d)).filter(Boolean));
  return {
    version: AGENT_SEUNG_PLAN_EVIDENCE_VERSION,
    analytics_coverage_days: Number(args.analyticsCoverageDays) || dates.size,
    account_daily: (args.accountDaily || []).slice(0, 31).map((row) => ({
      d: s(row.date || row.d, 10),
      fol: n(row.new_follows ?? row.fol),
      unf: n(row.unfollows ?? row.unf),
      pv: n(row.profile_visits ?? row.pv),
      bm: n(row.bookmarks ?? row.bm),
      rp: n(row.replies ?? row.rp),
      rps: n(row.reposts ?? row.rps),
      lk: n(row.likes ?? row.lk),
      imp: n(row.impressions ?? row.imp),
    })),
    user_direct: userDirect,
    ap_pipeline: apPipeline,
    unknown,
    sync_gap: {
      user_direct: syncGapDirect.slice(0, 40),
      ap_pipeline: syncGapAp.slice(0, 40),
      unknown: syncGapUnknown.slice(0, 40),
    },
    occupied_times: [...new Set((args.occupiedTimes || []).filter(Boolean))].slice(0, 80),
    start_date: String(args.startDate || "").slice(0, 10),
    notes: [...PLAN_EVIDENCE_NOTES],
    fedica_best_posting_time: args.fedicaBestPostingTime || emptyFedicaBestPostingTime(),
  };
}

export const PLAN_EVIDENCE_PAGE_SIZE = 28;

export type PlanEvidenceDigest = {
  cadence_note: string;
  user_direct_note: string;
  ap_pipeline_note: string;
  unknown_perf_note: string;
  recent_topics: string[];
  occupied_hours_note: string;
  timing_note: string;
  complexity_emergence_note: string;
  pages_consumed: number;
  thin: boolean;
};

export function emptyPlanEvidenceDigest(pagesConsumed = 0, thin = true): PlanEvidenceDigest {
  return {
    cadence_note: "",
    user_direct_note: "",
    ap_pipeline_note: "",
    unknown_perf_note: "",
    recent_topics: [],
    occupied_hours_note: "",
    timing_note: "",
    complexity_emergence_note: "",
    pages_consumed: pagesConsumed,
    thin,
  };
}

export function parsePlanEvidenceDigest(raw: unknown, pagesConsumed: number): PlanEvidenceDigest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.slots || o.posts_per_day || o.growth_role || o.planned_at) return null;
  const topics = Array.isArray(o.recent_topics)
    ? o.recent_topics.map((t) => s(t, 80)).filter(Boolean).slice(0, 12)
    : [];
  return {
    cadence_note: s(o.cadence_note, 400),
    user_direct_note: s(o.user_direct_note, 400),
    ap_pipeline_note: s(o.ap_pipeline_note, 400),
    unknown_perf_note: s(o.unknown_perf_note, 400),
    recent_topics: topics,
    occupied_hours_note: s(o.occupied_hours_note, 280),
    timing_note: s(o.timing_note, 280),
    complexity_emergence_note: s(o.complexity_emergence_note, 400),
    pages_consumed: pagesConsumed,
    thin: o.thin === true || (!s(o.cadence_note, 400) && !topics.length),
  };
}

/** Date order only. Does not rank importance or drop origins. */
export function pagePlanEvidenceRows(evidence: AgentSeungPlanEvidence): CompactPlanMetrics[] {
  const rows = [
    ...evidence.user_direct.posts,
    ...evidence.sync_gap.user_direct,
    ...evidence.ap_pipeline.posts,
    ...evidence.sync_gap.ap_pipeline,
    ...evidence.unknown.posts,
    ...evidence.sync_gap.unknown,
  ];
  const seen = new Set<string>();
  const unique: CompactPlanMetrics[] = [];
  for (const row of rows) {
    const key = `${row.origin}:${row.id || row.d}:${row.t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  unique.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  return unique;
}

/** Volume/slots payload after Agent승 digest. No raw post dump. */
export function planEvidenceForVolumeAndSlots(
  evidence: AgentSeungPlanEvidence,
  digest: PlanEvidenceDigest,
): Record<string, unknown> {
  return {
    evidence_version: evidence.version,
    start_date: evidence.start_date,
    analytics_coverage_days: evidence.analytics_coverage_days,
    counts: {
      user_direct: evidence.user_direct.originals,
      ap_pipeline: evidence.ap_pipeline.originals,
      unknown: evidence.unknown.originals,
    },
    occupied_times: evidence.occupied_times,
    timing: {
      fedica_best_posting_time: evidence.fedica_best_posting_time,
      audience_hours_pt: {
        start: "14:00",
        end: "22:00",
        role: "audience_evidence_not_fixed_window",
      },
      min_gap_hours: 2,
    },
    digest,
    notes: evidence.notes,
  };
}

export function planEvidenceForModel(evidence: AgentSeungPlanEvidence): Record<string, unknown> {
  return {
    evidence_version: evidence.version,
    start_date: evidence.start_date,
    analytics_coverage_days: evidence.analytics_coverage_days,
    account_overview_daily: evidence.account_daily,
    user_direct: {
      originals: evidence.user_direct.originals,
      recent_times: evidence.user_direct.recent_times.slice(0, 24),
      posts: evidence.user_direct.posts.slice(0, 80),
    },
    ap_pipeline: {
      originals: evidence.ap_pipeline.originals,
      recent_times: evidence.ap_pipeline.recent_times.slice(0, 24),
      posts: evidence.ap_pipeline.posts.slice(0, 80),
    },
    unknown_origin_performance: {
      originals: evidence.unknown.originals,
      recent_times: evidence.unknown.recent_times.slice(0, 24),
      posts: evidence.unknown.posts.slice(0, 80),
      note: "Performance metrics only. Not voice, emergence, or handmade thinking evidence.",
    },
    sync_gap: evidence.sync_gap,
    occupied_times: evidence.occupied_times,
    timing: {
      fedica_best_posting_time: evidence.fedica_best_posting_time,
      audience_hours_pt: {
        start: "14:00",
        end: "22:00",
        role: "audience_evidence_not_fixed_window",
      },
      min_gap_hours: 2,
    },
    notes: evidence.notes,
  };
}
