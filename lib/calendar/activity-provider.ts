/**
 * Operational activity provider.
 * Production: empty / DB-backed — NEVER silent demo fallback.
 * Demo fixtures only when explicitly enabled.
 */

import { CalendarActivity, AccountSyncState, HomeDashboardData, ControlCenterSummary } from "./types";
import { getDemoActivities } from "./demo-data";

function demoEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CALENDAR_DEMO === "1" ||
    process.env.CALENDAR_DEMO === "1"
  );
}

export async function getOperationalActivities(_viewMonth: Date): Promise<CalendarActivity[]> {
  return [];
}

export async function getCalendarActivities(viewMonth: Date): Promise<CalendarActivity[]> {
  if (demoEnabled()) {
    return getDemoActivities(viewMonth);
  }
  return getOperationalActivities(viewMonth);
}

export async function getAccountSyncState(): Promise<AccountSyncState> {
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
