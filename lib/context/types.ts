/**
 * Shared Current Context — Planner + Manual Composer common world model.
 * Not Creator DNA. Temporal situation evidence with freshness.
 */
export type EventType =
  | "LAFC_MATCH"
  | "FSD_RELEASE"
  | "TESLA_EVENT"
  | "XAI_AI_EVENT"
  | "GAME_RELEASE"
  | "GAME_UPDATE"
  | "SOFTWARE_UPDATE"
  | "SPORTS_MATCH"
  | "OTHER";

export type EventPhase =
  | "UPCOMING"
  | "PRE_EVENT"
  | "LIVE"
  | "POST_EVENT"
  | "RECENT"
  | "UNKNOWN";

export type CreatorRelevance = "high" | "medium" | "low" | "none";

export type KnownEvent = {
  event_id: string;
  event_type: EventType;
  event_name: string;
  start_time: string; // ISO
  end_time?: string | null;
  home_away?: "home" | "away" | "neutral" | null;
  opponent?: string | null;
  location?: string | null;
  source: string;
  creator_relevance: CreatorRelevance;
  notes?: string;
};

export type EventContextItem = KnownEvent & {
  phase: EventPhase;
  lead_time_hours: number | null;
  content_window: {
    pre_ok: boolean;
    live_ok: boolean;
    post_ok: boolean;
  };
  suggested_angles: string[];
  media_hints: string[];
};

export type XContextTopic = {
  topic: string;
  status: "active" | "emerging" | "declining" | "quiet" | "unknown";
  relevance: CreatorRelevance;
  evidence_type: string;
  source: string;
  observed_at: string;
  freshness_hours: number | null;
};

export type PlannerContextSlice = {
  related_planned_topic?: string | null;
  editorial_intent?: string | null;
};

export type CreatorContextSlice = {
  relevant_interests: string[];
  relevant_patterns: string[];
};

export type SharedCurrentContext = {
  context_timestamp: string;
  timezone: string;
  active_events: EventContextItem[];
  upcoming_events: EventContextItem[];
  recent_events: EventContextItem[];
  x_context: XContextTopic[];
  planner_context: PlannerContextSlice;
  creator_context: CreatorContextSlice;
  indicators: string[];
  /** Compact prompt block for Planner / Manual Composer */
  prompt_block: string;
  /** Provenance — not permanent Creator truth */
  provenance: {
    events_source: string;
    x_context_source: string;
    built_by: "shared_current_context_v1";
  };
};

export type BuildContextInput = {
  now?: Date | string;
  /** Optional known events (calendar / user / external) */
  events?: KnownEvent[];
  /** Optional current X topic signals — never stored as Creator DNA */
  xTopics?: Array<Partial<XContextTopic> & { topic: string }>;
  planner?: PlannerContextSlice;
  timezone?: string;
};
