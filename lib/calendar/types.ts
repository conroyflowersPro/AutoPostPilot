/** Account Activity Calendar — logical types (v5.0.0)
 * No DB migration yet. UI consumes this shape.
 */

export type ActivityOrigin =
  | "WEEKLY_PLANNER"
  | "WILD_FREE"
  | "WILD_GROWTH"
  | "CREATOR_REQUEST"
  | "MANUAL_CREATOR";

export type ActivityAction = "ORIGINAL" | "QUOTE" | "REPOST" | "SKIP";

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
  date: string; // YYYY-MM-DD (LA-oriented display day)
  scheduled_at?: string | null;
  published_at?: string | null;
  origin: ActivityOrigin;
  action_type: ActivityAction;
  status: ActivityStatus;
  topic?: string;
  subtopic?: string;
  angle?: string;
  source_post_url?: string | null;
  final_text?: string | null;
  generated_text?: string | null;
  manual_action_required?: boolean;
  duplicate_warning?: string | null;
  performance_summary?: string | null;
  fedica_pipeline_id?: string | null;
};

export type DaySummary = {
  date: string;
  activities: CalendarActivity[];
  isHighActivity: boolean;
  hasManualAction: boolean;
  hasDuplicateWarning: boolean;
};

export type ControlCenterSummary = {
  scheduled: number;
  wildFreeStatus: string;
  wildGrowthStatus: string;
  manualActions: number;
  published: number;
  duplicateWarnings: number;
};
