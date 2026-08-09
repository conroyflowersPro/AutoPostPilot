export type EngagementOpportunity = {
  id: string;
  source: "LOCAL" | "STORED" | "X_API";
  /** Primary label (legacy / list title) */
  title: string;
  reason?: string;
  tweet_id?: string;
  tweet_url?: string;
  author?: string;
  text_preview?: string;
  live?: boolean;

  /** UI / reply deep-link fields (Today engagement) */
  topic?: string;
  reply_href?: string;
  x_url?: string;
  suggested_intent?: string;
  opportunity_type?: string;
  api_required?: boolean;
  why_relevant?: string;
  event_context?: {
    phase?: string;
    event_id?: string;
    label?: string;
    [key: string]: unknown;
  };
};

export type ReplyContextScope =
  | "target_only"
  | "parent"
  | "root"
  | "other_reactions";

export type ReplySuggestRequest = {
  tweetUrl?: string;
  tweetId?: string;
  scope?: ReplyContextScope;
  consent?: boolean;
};

/** AI reply suggestion — not Creator evidence */
export type ReplySuggestion = {
  text: string;
  style?: "SHORT_NATURAL" | "EXPLAIN" | "HUMOR" | "OTHER" | string;
  notes?: string | null;
};
