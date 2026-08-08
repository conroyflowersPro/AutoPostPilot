/** Account Activity Calendar — operational types (v5.1+)
 * Distinguishes ACTUAL X activity from AutoPostPilot planned activity.
 */

export type ActivityOrigin =
  | "X_ACTUAL"
  | "WEEKLY_PLANNER"
  | "WILD_FREE"
  | "WILD_GROWTH"
  | "CREATOR_REQUEST"
  | "MANUAL_CREATOR";

export type ActivityAction = "ORIGINAL" | "QUOTE" | "REPOST" | "REPLY" | "SKIP";

export type ActivityStatus =
  | "DRAFT"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "SKIPPED"
  | "REPLACED"
  | "DEFERRED"
  | "NOT_RUN"
  | "GENERATED"
  | "SELECTED"
  | "REJECTED"
  | "DEFERRED_WILD"
  | "MANUAL_ACTION_REQUIRED"
  | "COMPLETED"
  | "DISMISSED"
  | "FAILED";

export type CalendarActivity = {
  activity_id: string;
  date: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  origin: ActivityOrigin;
  action_type: ActivityAction;
  status: ActivityStatus;
  topic?: string;
  subtopic?: string;
  angle?: string;
  source_post_url?: string | null;
  x_post_id?: string | null;
  final_text?: string | null;
  generated_text?: string | null;
  manual_action_required?: boolean;
  duplicate_warning?: string | null;
  performance_summary?: string | null;
  fedica_pipeline_id?: string | null;
  planned_activity_id?: string | null;
};

export type ControlCenterSummary = {
  scheduled: number;
  wildFreeStatus: string;
  wildGrowthStatus: string;
  manualActions: number;
  published: number;
  duplicateWarnings: number;
  actualPublished: number;
};

export type XSyncStatus = "not_connected" | "never_synced" | "ok" | "failed";

export type AccountSyncState = {
  status: XSyncStatus;
  handle?: string | null;
  displayName?: string | null;
  followersCount?: number | null;
  followingCount?: number | null;
  lastSuccessfulSyncAt?: string | null;
  lastSyncAttemptAt?: string | null;
  lastError?: string | null;
  timezone?: string | null;
};

export type HomeDashboardData = {
  account: AccountSyncState;
  today: ControlCenterSummary;
  recentActual: CalendarActivity[];
  todayPlan: CalendarActivity[];
};
