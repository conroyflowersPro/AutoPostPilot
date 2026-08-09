export type EngagementOpportunity = {
  id: string;
  source: "LOCAL" | "STORED" | "X_API";
  title: string;
  reason?: string;
  tweet_id?: string;
  tweet_url?: string;
  author?: string;
  text_preview?: string;
  live?: boolean;
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
