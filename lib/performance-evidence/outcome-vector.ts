/**
 * performance-outcome-v1 — multi-dimensional outcomes, not scalar score
 */
import type { OutcomeAxis } from "./contract-v1";
import {
  OPTIONAL_OUTCOME_AXES,
  OUTCOME_AXES_V1,
  PERFORMANCE_OUTCOME_VERSION,
} from "./contract-v1";
import type { MetricBag } from "./types";

export type OutcomePresence = "PRESENT" | "NOT_AVAILABLE";

export type OutcomeDimension = {
  axis: OutcomeAxis;
  presence: OutcomePresence;
  /** Optional derived strength 0–1 only when PRESENT; never invent for NOT_AVAILABLE */
  strength: number | null;
  supportingMetricKeys: string[];
  notes?: string;
};

export type PerformanceOutcomeVector = {
  version: typeof PERFORMANCE_OUTCOME_VERSION;
  dimensions: OutcomeDimension[];
  /** Explicitly forbidden as canonical ranking truth */
  universalScalarScore: null;
};

function familyHas(
  bag: MetricBag | undefined,
  keys: string[]
): { present: boolean; keys: string[] } {
  const found: string[] = [];
  if (!bag) return { present: false, keys: found };
  for (const k of keys) {
    const m = bag[k];
    if (m && m.presence !== "MISSING") found.push(k);
  }
  return { present: found.length > 0, keys: found };
}

/**
 * Derive outcome vector from metric bags.
 * Missing families/axes → NOT_AVAILABLE (never zero-fill).
 */
export function deriveOutcomeVector(input: {
  publicMetrics?: MetricBag;
  organicMetrics?: MetricBag;
  nonPublicMetrics?: MetricBag;
}): PerformanceOutcomeVector {
  const pub = input.publicMetrics;
  const non = input.nonPublicMetrics;

  const reachKeys = [
    "impression_count",
    "impressions",
    "retweet_count",
    "repost_count",
    "quote_count",
  ];
  const utilityKeys = ["bookmark_count", "bookmarks"];
  const discussionKeys = ["reply_count", "replies", "quote_count"];
  const profileKeys = [
    "profile_clicks",
    "user_profile_clicks",
    "profile_visits",
  ];

  const reach = familyHas(pub, reachKeys);
  const utility = familyHas(pub, utilityKeys);
  const discussion = familyHas(pub, discussionKeys);
  const profile = familyHas(non, profileKeys);

  const dims: OutcomeDimension[] = [
    {
      axis: "REACH",
      presence: reach.present ? "PRESENT" : "NOT_AVAILABLE",
      strength: null,
      supportingMetricKeys: reach.keys,
    },
    {
      axis: "UTILITY",
      presence: utility.present ? "PRESENT" : "NOT_AVAILABLE",
      strength: null,
      supportingMetricKeys: utility.keys,
    },
    {
      axis: "DISCUSSION",
      presence: discussion.present ? "PRESENT" : "NOT_AVAILABLE",
      strength: null,
      supportingMetricKeys: discussion.keys,
    },
    {
      axis: "PROFILE_CURIOSITY",
      presence: profile.present ? "PRESENT" : "NOT_AVAILABLE",
      strength: null,
      supportingMetricKeys: profile.keys,
      notes: profile.present
        ? undefined
        : "Optional axis — absent non_public profile metrics",
    },
  ];

  for (const axis of OPTIONAL_OUTCOME_AXES) {
    if (axis === "PROFILE_CURIOSITY") continue;
    dims.push({
      axis,
      presence: "NOT_AVAILABLE",
      strength: null,
      supportingMetricKeys: [],
      notes: "No evidence in store — dimension not zero-filled",
    });
  }

  return {
    version: PERFORMANCE_OUTCOME_VERSION,
    dimensions: dims,
    universalScalarScore: null,
  };
}

export function assertNoUniversalScalar(
  v: PerformanceOutcomeVector
): boolean {
  return v.universalScalarScore === null;
}

export { OUTCOME_AXES_V1 };
