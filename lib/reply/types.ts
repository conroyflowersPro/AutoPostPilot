/** Reply & Engagement Intelligence v1 types */

export type OpportunityType =
  | "EVENT_DISCUSSION"
  | "FAN_INTERACTION"
  | "TECHNICAL_DISCUSSION"
  | "RELATIONSHIP_MAINTENANCE"
  | "COMMUNITY"
  | "QUESTION_WORTH_ANSWER"
  | "THANKS_SUPPORT"
  | "CURRENT_TOPIC"
  | "OTHER";

export type SuggestedEngagementIntent =
  | "LIGHT_OPINION"
  | "FAN_INTERACTION"
  | "TECHNICAL_ANSWER"
  | "EXPERIENCE_SHARE"
  | "THANKS"
  | "CONGRATULATION"
  | "SUPPORT"
  | "AGREEMENT"
  | "CASUAL_REACTION"
  | "QUESTION_REPLY"
  | "OTHER";

export type ReplyIntent =
  | "QUESTION"
  | "AGREEMENT"
  | "DISAGREEMENT"
  | "HUMOR"
  | "CONGRATULATION"
  | "THANKS"
  | "SUPPORT"
  | "TECHNICAL_DISCUSSION"
  | "EXPERIENCE_QUESTION"
  | "CORRECTION"
  | "INFORMATION_REQUEST"
  | "CASUAL_REACTION"
  | "COMMUNITY_INTERACTION"
  | "UNKNOWN";

export type EngagementOpportunity = {
  id: string;
  opportunity_type: OpportunityType;
  topic: string;
  why_relevant: string;
  relationship_context: "UNKNOWN" | "PRIOR_INTERACTION" | "RECURRING";
  event_context?: {
    event_name?: string;
    phase?: string;
  } | null;
  suggested_intent: SuggestedEngagementIntent;
  context_freshness: "FRESH" | "STORED" | "STALE" | "UNKNOWN";
  api_required: boolean;
  api_action_label?: string | null;
  source: "SHARED_CONTEXT" | "CREATOR_DNA" | "STORED" | "X_API";
};

export type ThreadContext = {
  target_id: string;
  target_text: string;
  target_author_id?: string | null;
  target_author_username?: string | null;
  created_at?: string | null;
  conversation_id?: string | null;
  parent_id?: string | null;
  parent_text?: string | null;
  root_id?: string | null;
  root_text?: string | null;
  fetched_via: "X_API" | "DIRECT_PASTE" | "NONE";
};

export type ReplySuggestion = {
  text: string;
  style: "SHORT_NATURAL" | "EXPLAIN" | "HUMOR" | "OTHER";
  notes?: string | null;
};
