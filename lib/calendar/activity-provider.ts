/**
 * Operational activity provider.
 * Production: empty / DB-backed — NEVER silent demo fallback.
 * Demo fixtures only when explicitly enabled.
 */

import { createClient } from "@/lib/supabase/server";
import {
  CalendarActivity,
  AccountSyncState,
  HomeDashboardData,
  ControlCenterSummary,
} from "./types";
import { getDemoActivities } from "./demo-data";

function demoEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CALENDAR_DEMO === "1" ||
    process.env.CALENDAR_DEMO === "1"
  );
}

/** Real operational fetch — currently empty until activities are synced. */
export async function getOperationalActivities(
  _viewMonth: Date
): Promise<CalendarActivity[]> {
  return [];
}

export async function getCalendarActivities(
  viewMonth: Date
): Promise<CalendarActivity[]> {
  if (demoEnabled()) {
    return getDemoActivities(viewMonth);
  }
  return getOperationalActivities(viewMonth);
}

export async function getAccountSyncState(): Promise<AccountSyncState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
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
        status: "not_connected",
        handle: data?.handle || null,
        displayName: data?.display_name || null,
        followersCount: data?.followers_count ?? null,
        followingCount: data?.following_count ?? null,
        lastSuccessfulSyncAt: data?.last_successful_sync_at || null,
        lastSyncAttemptAt: data?.last_sync_attempt_at || null,
        lastError: data?.last_sync_error || null,
        timezone: data?.timezone || null,
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

export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  const account = await getAccountSyncState();
  return {
    account,
    today: emptyToday(),
    recentActual: [],
    todayPlan: [],
  };
}
