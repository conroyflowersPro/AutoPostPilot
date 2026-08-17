/**
 * Operational activity provider.
 * X_ACTUAL from account_activities; planned from SeungContent.
 * Demo fixtures only when explicitly enabled.
 */

import { createClient } from "@/lib/supabase/server";
import {
  CalendarActivity,
  AccountSyncState,
  HomeDashboardData,
  ControlCenterSummary,
  ActivityOrigin,
  ActivityAction,
  ActivityStatus,
} from "./types";
import { getDemoActivities } from "./demo-data";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { inscribeMonthFromActivities, mergeBookedScheduleDays, ptDateKey, type ActivityForInscribe } from "./planner-inscribe";

function demoEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CALENDAR_DEMO === "1" ||
    process.env.CALENDAR_DEMO === "1"
  );
}

/** DB null → undefined for CalendarActivity optional strings */
function optStr(v: string | null | undefined): string | undefined {
  return v ?? undefined;
}

function mapXActivity(row: {
  id: string;
  activity_date: string;
  origin: string;
  action_type: string;
  status: string;
  x_post_id?: string | null;
  text_body?: string | null;
  source_post_url?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
  topic?: string | null;
  duplicate_warning?: string | null;
}): CalendarActivity {
  return {
    activity_id: row.id,
    date: row.activity_date,
    scheduled_at: row.scheduled_at ?? null,
    published_at: row.published_at ?? null,
    origin: (row.origin as ActivityOrigin) || "X_ACTUAL",
    action_type: (row.action_type as ActivityAction) || "ORIGINAL",
    status: (row.status as ActivityStatus) || "PUBLISHED",
    x_post_id: optStr(row.x_post_id),
    final_text: optStr(row.text_body),
    source_post_url: optStr(row.source_post_url),
    topic: optStr(row.topic),
    duplicate_warning: optStr(row.duplicate_warning),
  };
}

function mapPlanned(row: {
  id: string;
  content: string | null;
  scheduled_at: string | null;
  status: string | null;
  pipeline_id: string | null;
  fedica_post_id: string | null;
}): CalendarActivity | null {
  if (!row.scheduled_at) return null;
  const date = ptDateKey(row.scheduled_at);
  let origin: ActivityOrigin = "WEEKLY_PLANNER";
  const pid = String(row.pipeline_id || "");
  if (pid === "42338") origin = "WILD_GROWTH";

  let status: ActivityStatus = "DRAFT";
  const s = (row.status || "").toLowerCase();
  if (s === "scheduled" || s === "scheduling") status = "SCHEDULED";
  else if (s === "reviewed") status = "APPROVED";
  else if (s === "published") status = "PUBLISHED";
  else if (s === "draft") status = "DRAFT";

  return {
    activity_id: `plan-${row.id}`,
    date,
    scheduled_at: row.scheduled_at,
    published_at: status === "PUBLISHED" ? row.scheduled_at : null,
    origin,
    action_type: "ORIGINAL",
    status,
    final_text: optStr(row.content),
    generated_text: optStr(row.content),
    fedica_pipeline_id: optStr(row.pipeline_id),
  };
}

export async function getOperationalActivities(
  viewMonth: Date
): Promise<CalendarActivity[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const from = format(startOfMonth(viewMonth), "yyyy-MM-dd");
    const to = format(endOfMonth(viewMonth), "yyyy-MM-dd");
    const out: CalendarActivity[] = [];

    const { data: conn } = await supabase
      .from("account_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    if (conn?.id) {
      const { data: actual } = await supabase
        .from("account_activities")
        .select(
          "id, activity_date, origin, action_type, status, x_post_id, text_body, source_post_url, published_at, scheduled_at, topic, duplicate_warning"
        )
        .eq("account_id", conn.id)
        .gte("activity_date", from)
        .lte("activity_date", to)
        .order("published_at", { ascending: false });

      for (const row of actual || []) {
        out.push(mapXActivity(row));
      }
    }

    const { data: planned } = await supabase
      .from("SeungContent")
      .select("id, content, scheduled_at, status, pipeline_id, fedica_post_id")
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null);

    for (const row of planned || []) {
      const m = mapPlanned(row);
      if (m && m.date >= from && m.date <= to) out.push(m);
    }

    return out;
  } catch {
    return [];
  }
}

export async function getCalendarActivities(
  viewMonth: Date
): Promise<CalendarActivity[]> {
  if (demoEnabled()) {
    return getDemoActivities(viewMonth);
  }
  return getOperationalActivities(viewMonth);
}

function emptyAccount(): AccountSyncState {
  return {
    status: "not_connected",
    handle: null,
    displayName: null,
    followersCount: null,
    followingCount: null,
    lastSuccessfulSyncAt: null,
    lastSyncAttemptAt: null,
    lastError: null,
    timezone: null,
  };
}

export async function getAccountSyncState(): Promise<AccountSyncState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return emptyAccount();

    const { data } = await supabase
      .from("account_connections")
      .select(
        "handle, display_name, followers_count, following_count, last_successful_sync_at, last_sync_attempt_at, last_sync_status, last_sync_error, timezone, access_token"
      )
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    if (!data?.access_token) {
      return {
        ...emptyAccount(),
        handle: data?.handle || null,
        displayName: data?.display_name || null,
      };
    }

    let status: AccountSyncState["status"] = "never_synced";
    if (data.last_successful_sync_at) status = "ok";
    else if (data.last_sync_status === "failed") status = "failed";
    else if (data.last_sync_status === "connected") status = "never_synced";

    return {
      status,
      handle: data.handle,
      displayName: data.display_name,
      followersCount: data.followers_count,
      followingCount: data.following_count,
      lastSuccessfulSyncAt: data.last_successful_sync_at,
      lastSyncAttemptAt: data.last_sync_attempt_at,
      lastError: data.last_sync_error,
      timezone: data.timezone,
    };
  } catch {
    return emptyAccount();
  }
}

function emptyToday(): ControlCenterSummary {
  return {
    scheduled: 0,
    wildFreeStatus: "not run",
    wildGrowthStatus: "not run",
    manualActions: 0,
    published: 0,
    duplicateWarnings: 0,
    actualPublished: 0,
  };
}

async function buildTodaySummary(): Promise<ControlCenterSummary> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return emptyToday();

    const today = format(new Date(), "yyyy-MM-dd");

    const { data: conn } = await supabase
      .from("account_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    let actualPublished = 0;
    if (conn?.id) {
      const { count } = await supabase
        .from("account_activities")
        .select("id", { count: "exact", head: true })
        .eq("account_id", conn.id)
        .eq("activity_date", today)
        .eq("origin", "X_ACTUAL");
      actualPublished = count || 0;
    }

    const { count: scheduled } = await supabase
      .from("SeungContent")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", `${today}T00:00:00`)
      .lte("scheduled_at", `${today}T23:59:59`);

    return {
      scheduled: scheduled || 0,
      wildFreeStatus: "not run",
      wildGrowthStatus: "not run",
      manualActions: 0,
      published: actualPublished,
      duplicateWarnings: 0,
      actualPublished,
    };
  } catch {
    return emptyToday();
  }
}

export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  const account = await getAccountSyncState();
  const today = await buildTodaySummary();

  let recentActual: CalendarActivity[] = [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: conn } = await supabase
        .from("account_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", "x")
        .maybeSingle();
      if (conn?.id) {
        const { data } = await supabase
          .from("account_activities")
          .select(
            "id, activity_date, origin, action_type, status, x_post_id, text_body, source_post_url, published_at, topic"
          )
          .eq("account_id", conn.id)
          .eq("origin", "X_ACTUAL")
          .order("published_at", { ascending: false })
          .limit(8);
        recentActual = (data || []).map(mapXActivity);
      }
    }
  } catch {
    recentActual = [];
  }

  return {
    account,
    today,
    recentActual,
    todayPlan: [],
  };
}

/** Planner-inscribed month counts from last X sync. No Grok. No leftover drafts. */
export async function getQueueMonthInscription(year: number, month1to12: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { days: [], accountId: null as string | null };
    const { data: conn } = await supabase
      .from("account_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();
    const { data: booked } = await supabase
      .from("SeungContent")
      .select("scheduled_at")
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null);
    let synced: ActivityForInscribe[] = [];
    if (conn?.id) {
      const fromDate = new Date(Date.UTC(year, month1to12 - 1, 0));
      const toDate = new Date(Date.UTC(year, month1to12, 1));
      const from = fromDate.toISOString().slice(0, 10);
      const to = toDate.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("account_activities")
        .select("activity_date, published_at, action_type, post_type, system_origin_class, origin")
        .eq("account_id", conn.id)
        .eq("origin", "X_ACTUAL")
        .gte("activity_date", from)
        .lte("activity_date", to)
        .limit(800);
      synced = data || [];
    }
    const days = mergeBookedScheduleDays(
      inscribeMonthFromActivities(synced, year, month1to12),
      booked || [],
      year,
      month1to12,
    );
    return { days, accountId: conn?.id || null };
  } catch {
    return { days: [], accountId: null as string | null };
  }
}
