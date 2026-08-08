/**
 * Data source discovery for Initial Baseline (Phase 1)
 * Does not invent missing data. Returns AVAILABLE / PARTIAL / MISSING only.
 */

import type { CoverageSlice, Confidence } from "./types";

export type DiscoveryInput = {
  postMetrics?: {
    count: number;
    earliest: string | null;
    latest: string | null;
    hasPostId: number;
    metricFieldsPresent: string[];
  };
  seungContent?: {
    count: number;
    earliest: string | null;
    latest: string | null;
    originManual: number;
    originAi: number;
  };
  importHistory?: {
    count: number;
    sources: string[];
    earliestCoverage: string | null;
    latestCoverage: string | null;
  };
  accountActivities?: {
    count: number;
    earliest: string | null;
    latest: string | null;
  };
  accountConnection?: {
    connected: boolean;
    handle?: string | null;
    xUserId?: string | null;
    oauthConfigured: boolean;
  };
  fedica?: {
    hasData: boolean;
    note?: string;
  };
  revenue?: {
    postsWithRevenue: number;
  };
  bootstrapHistorical?: {
    samplePosts: number;
    windowNote: string;
  };
};

export function discoverCoverage(input: DiscoveryInput): CoverageSlice[] {
  const slices: CoverageSlice[] = [];

  if (input.seungContent && input.seungContent.count > 0) {
    slices.push({
      domain: "X Posts (SeungContent)",
      availability: "PARTIAL",
      earliest: input.seungContent.earliest,
      latest: input.seungContent.latest,
      count: input.seungContent.count,
      source: "seung_content",
      fieldsAvailable: ["content", "published_at", "origin"],
      fieldsMissing: ["full_archive", "impressions_native"],
      notes: `DB stored posts ${input.seungContent.count}. Manual ${input.seungContent.originManual}, AI-assisted ${input.seungContent.originAi}. Not full X archive.`,
      confidence: input.seungContent.count >= 50 ? "MEDIUM" : "LOW",
    });
  } else {
    slices.push({
      domain: "X Posts (SeungContent)",
      availability: "MISSING",
      earliest: null,
      latest: null,
      count: 0,
      source: "seung_content",
      fieldsAvailable: [],
      fieldsMissing: ["all"],
      notes: "No SeungContent rows discovered for baseline.",
      confidence: "HIGH",
    });
  }

  if (input.postMetrics && input.postMetrics.count > 0) {
    const missingCommon = [
      "replies", "quotes", "bookmarks", "detail_expands", "profile_visits",
      "followers_gained", "impressions", "revenue",
    ].filter((f) => !input.postMetrics!.metricFieldsPresent.includes(f));

    slices.push({
      domain: "Performance Metrics",
      availability: missingCommon.length > 4 ? "PARTIAL" : "AVAILABLE",
      earliest: input.postMetrics.earliest,
      latest: input.postMetrics.latest,
      count: input.postMetrics.count,
      source: "post_metrics",
      fieldsAvailable: input.postMetrics.metricFieldsPresent,
      fieldsMissing: missingCommon,
      notes: `post_metrics rows=${input.postMetrics.count}, with post_id=${input.postMetrics.hasPostId}`,
      confidence: input.postMetrics.count >= 30 ? "MEDIUM" : "LOW",
    });
  } else {
    slices.push({
      domain: "Performance Metrics",
      availability: "MISSING",
      earliest: null,
      latest: null,
      count: 0,
      source: "post_metrics",
      fieldsAvailable: [],
      fieldsMissing: [
        "replies", "quotes", "bookmarks", "detail_expands", "profile_visits",
        "followers_gained", "impressions", "likes", "reposts", "revenue",
      ],
      notes: "No X Analytics CSV / post_metrics rows. Quality Engagement evaluation blocked for metrics-based claims.",
      confidence: "HIGH",
    });
  }

  if (input.importHistory && input.importHistory.count > 0) {
    slices.push({
      domain: "Analytics Import History",
      availability: "AVAILABLE",
      earliest: input.importHistory.earliestCoverage,
      latest: input.importHistory.latestCoverage,
      count: input.importHistory.count,
      source: "x_analytics_csv",
      fieldsAvailable: ["source", "coverage_start", "coverage_end", "record_count"],
      fieldsMissing: [],
      notes: `Imports: ${input.importHistory.sources.join(", ") || "unknown"}`,
      confidence: "HIGH",
    });
  } else {
    slices.push({
      domain: "Analytics Import History",
      availability: "MISSING",
      earliest: null,
      latest: null,
      count: 0,
      source: "x_analytics_csv",
      fieldsAvailable: [],
      fieldsMissing: ["import records"],
      notes: "No analytics_import_history rows yet.",
      confidence: "HIGH",
    });
  }

  if (input.accountConnection?.oauthConfigured && input.accountConnection.connected) {
    slices.push({
      domain: "X API (live)",
      availability: "PARTIAL",
      earliest: null,
      latest: null,
      count: null,
      source: "x_api",
      fieldsAvailable: ["account_profile", "sync_runs"],
      fieldsMissing: ["full_timeline_archive", "reply_graph_complete"],
      notes: `Connected as @${input.accountConnection.handle || "?"}. API rate limits prevent full history pull.`,
      confidence: "MEDIUM",
    });
  } else {
    slices.push({
      domain: "X API (live)",
      availability: "MISSING",
      earliest: null,
      latest: null,
      count: null,
      source: "x_api",
      fieldsAvailable: [],
      fieldsMissing: ["oauth_tokens", "timeline"],
      notes: "X OAuth not configured or not connected. Live sync unavailable.",
      confidence: "HIGH",
    });
  }

  if (input.accountActivities && input.accountActivities.count > 0) {
    slices.push({
      domain: "Account Activities / Replies",
      availability: "PARTIAL",
      earliest: input.accountActivities.earliest,
      latest: input.accountActivities.latest,
      count: input.accountActivities.count,
      source: "account_activities",
      fieldsAvailable: ["activity_date", "activity_type"],
      fieldsMissing: ["full_reply_threads", "original_author_response_flag"],
      notes: "Activity rows present; not equivalent to full conversation graph.",
      confidence: "LOW",
    });
  } else {
    slices.push({
      domain: "Account Activities / Replies",
      availability: "MISSING",
      earliest: null,
      latest: null,
      count: 0,
      source: "account_activities",
      fieldsAvailable: [],
      fieldsMissing: ["replies", "mentions", "relationship_signals"],
      notes: "No account_activities for relationship baseline.",
      confidence: "HIGH",
    });
  }

  if (input.fedica?.hasData) {
    slices.push({
      domain: "Fedica / Audience DNA",
      availability: "PARTIAL",
      earliest: null,
      latest: null,
      count: null,
      source: "fedica",
      fieldsAvailable: ["keywords", "pipeline_signals"],
      fieldsMissing: ["verified_demographics", "fresh_interest_graph"],
      notes: input.fedica.note || "Fedica signals referenced; freshness unknown.",
      confidence: "LOW",
    });
  } else {
    slices.push({
      domain: "Fedica / Audience DNA",
      availability: "MISSING",
      earliest: null,
      latest: null,
      count: null,
      source: "fedica",
      fieldsAvailable: [],
      fieldsMissing: ["interest_graph", "sentiment", "demographics", "best_posting_time"],
      notes: "No Fedica dataset loaded into baseline. Best Posting Time remains Fedica responsibility — currently unknown.",
      confidence: "HIGH",
    });
  }

  const revCount = input.revenue?.postsWithRevenue ?? 0;
  slices.push({
    domain: "Revenue",
    availability: revCount > 0 ? "PARTIAL" : "MISSING",
    earliest: null,
    latest: null,
    count: revCount,
    source: "monetization",
    fieldsAvailable: revCount > 0 ? ["revenue"] : [],
    fieldsMissing: revCount > 0 ? ["revenue_per_impression", "payout_reports"] : ["all"],
    notes: revCount > 0 ? `${revCount} posts with non-zero revenue field.` : "Revenue Baseline = Insufficient Data. Do not invent.",
    confidence: revCount > 0 ? "LOW" : "HIGH",
  });

  if (input.bootstrapHistorical) {
    slices.push({
      domain: "Bootstrap Historical X Search",
      availability: "PARTIAL",
      earliest: null,
      latest: null,
      count: input.bootstrapHistorical.samplePosts,
      source: "bootstrap_historical_search",
      fieldsAvailable: ["text_sample", "topic_hints"],
      fieldsMissing: ["metrics", "complete_timeline"],
      notes: `${input.bootstrapHistorical.windowNote}. Sample only — NOT performance evidence.`,
      confidence: "LOW",
    });
  }

  return slices;
}

export function earliestReliableFromCoverage(
  slices: CoverageSlice[]
): { earliest: string | null; latest: string | null; note: string } {
  const dates: string[] = [];
  const latestDates: string[] = [];
  for (const s of slices) {
    if (s.availability === "MISSING") continue;
    if (s.earliest) dates.push(s.earliest);
    if (s.latest) latestDates.push(s.latest);
  }
  dates.sort();
  latestDates.sort();
  if (!dates.length) {
    return {
      earliest: null,
      latest: null,
      note: "No reliable dated coverage. Baseline cannot claim a historical window until data is imported.",
    };
  }
  return {
    earliest: dates[0],
    latest: latestDates[latestDates.length - 1] || null,
    note: "Window derived from actual stored records only — not hard-coded.",
  };
}
