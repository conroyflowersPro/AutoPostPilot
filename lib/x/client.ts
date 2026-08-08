/**
 * Official X API client boundary.
 * No live calls until OAuth user tokens are configured.
 * Forbidden: scraping, browser automation, unofficial endpoints.
 */

export type XUserProfile = {
  id: string;
  username: string;
  name: string;
  profileImageUrl?: string;
  followersCount?: number;
  followingCount?: number;
  tweetCount?: number;
};

export type XTimelinePost = {
  id: string;
  text: string;
  createdAt: string;
  referencedTweets?: { type: string; id: string }[];
  publicMetrics?: Record<string, number>;
};

export type XClient = {
  getMe(): Promise<XUserProfile>;
  getUserTimeline(params: {
    userId: string;
    sinceId?: string;
    maxResults?: number;
    paginationToken?: string;
  }): Promise<{ posts: XTimelinePost[]; nextToken?: string }>;
};

export class XClientNotConfiguredError extends Error {
  constructor() {
    super(
      "X API user credentials are not configured. Connect X OAuth (tweet.read, users.read) before enabling Daily Sync."
    );
    this.name = "XClientNotConfiguredError";
  }
}

export function createXClient(): XClient {
  return {
    async getMe() {
      throw new XClientNotConfiguredError();
    },
    async getUserTimeline() {
      throw new XClientNotConfiguredError();
    },
  };
}
