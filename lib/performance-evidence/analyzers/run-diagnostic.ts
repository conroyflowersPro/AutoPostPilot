/**
 * Source-agnostic diagnostic runner.
 */
import type {
  EvidenceSourceAdapter,
  NormalizedEvidence,
  DiagnosticReport,
  MetricCoverage,
  FamilyCoverage,
  ActivityCounts,
  PerformanceVerdict,
  Population,
  MetricFamily,
  SnapshotStats,
  MonthlyBucket,
  DistributionStats,
  CorrelationPair,
  DataQualityIssue,
} from "../types";
import {
  numericOrNull,
  percentile,
  mean,
  stdDev,
  skewness,
  pearson,
  spearman,
  KNOWN_PUBLIC_KEYS,
} from "../metric-utils";

function matches(e: NormalizedEvidence, pop: Population): boolean {
  if (pop === "ALL") return true;
  if (pop === "CREATOR_PUBLISHING") return e.isOriginal || e.isQuote;
  if (pop === "ORIGINAL") return e.isOriginal;
  if (pop === "QUOTE") return e.isQuote;
  if (pop === "REPLY" || pop === "SOCIAL_INTERACTION") return e.isReply;
  if (pop === "REPOST") return e.isRepost;
  return false;
}

export async function runPerformanceDiagnostic(
  adapter: EvidenceSourceAdapter,
  options?: { accountId?: string; pageSize?: number }
): Promise<DiagnosticReport> {
  const all: NormalizedEvidence[] = [];
  for await (const batch of adapter.iterateEvidence(options)) {
    all.push(...batch);
  }

  const activity: ActivityCounts = {
    total: 0,
    byPostType: {},
    byActivityType: {},
    creatorPublishing: 0,
    socialInteraction: 0,
    redistribution: 0,
    unknown: 0,
  };
  for (const e of all) {
    activity.total += 1;
    activity.byPostType[e.postType] = (activity.byPostType[e.postType] || 0) + 1;
    activity.byActivityType[e.activityType] =
      (activity.byActivityType[e.activityType] || 0) + 1;
    if (e.isOriginal || e.isQuote) activity.creatorPublishing += 1;
    if (e.isReply) activity.socialInteraction += 1;
    if (e.isRepost) activity.redistribution += 1;
  }

  const issues: DataQualityIssue[] = [];
  let sawZero = false;
  let sawMissing = false;
  for (const e of all) {
    for (const mv of Object.values(e.publicMetrics)) {
      if (mv.presence === "PRESENT_ZERO") sawZero = true;
      if (mv.presence === "MISSING") sawMissing = true;
    }
  }
  if (sawZero) {
    issues.push({
      code: "PRESENT_ZERO_DISTINGUISHED",
      severity: "info",
      message: "PRESENT_ZERO observed — missing≠0 discipline intact",
    });
  }
  if (!sawMissing && all.length > 0) {
    issues.push({
      code: "NO_MISSING_OBSERVED",
      severity: "info",
      message: "No MISSING public keys in sample",
    });
  }

  function metricCov(pop: Population): MetricCoverage[] {
    const subset = all.filter((r) => matches(r, pop));
    const eligible = subset.length;
    return KNOWN_PUBLIC_KEYS.map((key) => {
      let present = 0,
        missing = 0,
        zero = 0,
        nonZero = 0;
      for (const r of subset) {
        const mv = r.publicMetrics[key];
        if (!mv || mv.presence === "MISSING") missing += 1;
        else {
          present += 1;
          if (mv.presence === "PRESENT_ZERO") zero += 1;
          else nonZero += 1;
        }
      }
      return {
        metricKey: key,
        family: "public" as MetricFamily,
        population: pop,
        eligible,
        present,
        missing,
        zero,
        nonZero,
        coveragePct: eligible === 0 ? null : (present / eligible) * 100,
      };
    });
  }

  function familyCov(pop: Population, family: MetricFamily): FamilyCoverage {
    const subset = all.filter((r) => matches(r, pop));
    const eligible = subset.length;
    let usable = 0;
    let earliest: string | null = null;
    let latest: string | null = null;
    for (const r of subset) {
      const ok =
        family === "public"
          ? r.metricAvailability.public
          : family === "organic"
            ? r.metricAvailability.organic
            : r.metricAvailability.nonPublic;
      if (ok) {
        usable += 1;
        if (r.publishedAt) {
          if (!earliest || r.publishedAt < earliest) earliest = r.publishedAt;
          if (!latest || r.publishedAt > latest) latest = r.publishedAt;
        }
      }
    }
    const status: FamilyCoverage["status"] =
      eligible === 0
        ? "NOT_AVAILABLE"
        : usable === 0
          ? "NOT_COLLECTED"
          : usable < eligible * 0.5
            ? "PARTIAL"
            : "AVAILABLE";
    return {
      family,
      population: pop,
      eligible,
      usable,
      coveragePct: eligible === 0 ? null : (usable / eligible) * 100,
      earliestUsable: earliest,
      latestUsable: latest,
      status,
    };
  }

  const publicMetricCoverage = [
    ...metricCov("CREATOR_PUBLISHING"),
    ...metricCov("ORIGINAL"),
    ...metricCov("QUOTE"),
    ...metricCov("REPLY"),
  ];
  const familyCoverage = [
    familyCov("CREATOR_PUBLISHING", "public"),
    familyCov("CREATOR_PUBLISHING", "organic"),
    familyCov("CREATOR_PUBLISHING", "non_public"),
    familyCov("REPLY", "public"),
  ];

  const distributions: DistributionStats[] = [];
  for (const pop of ["CREATOR_PUBLISHING", "ORIGINAL", "REPLY"] as Population[]) {
    for (const key of [
      "impression_count",
      "like_count",
      "reply_count",
      "retweet_count",
      "bookmark_count",
    ]) {
      const values: number[] = [];
      for (const r of all) {
        if (!matches(r, pop)) continue;
        const n = numericOrNull(r.publicMetrics[key]);
        if (n !== null) values.push(n);
      }
      if (values.length < 5) continue;
      values.sort((a, b) => a - b);
      const m = mean(values);
      const s = stdDev(values, m);
      distributions.push({
        metricKey: key,
        population: pop,
        count: values.length,
        min: values[0],
        p25: percentile(values, 25),
        median: percentile(values, 50),
        p75: percentile(values, 75),
        p90: percentile(values, 90),
        p95: percentile(values, 95),
        max: values[values.length - 1],
        mean: m,
        std: s,
        skewness: skewness(values, m, s),
      });
    }
  }

  const correlations: CorrelationPair[] = [];
  for (const [a, b] of [
    ["impression_count", "like_count"],
    ["impression_count", "reply_count"],
    ["impression_count", "retweet_count"],
    ["impression_count", "bookmark_count"],
    ["like_count", "reply_count"],
    ["bookmark_count", "reply_count"],
  ] as [string, string][]) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const r of all) {
      if (!matches(r, "CREATOR_PUBLISHING")) continue;
      const xa = numericOrNull(r.publicMetrics[a]);
      const yb = numericOrNull(r.publicMetrics[b]);
      if (xa === null || yb === null) continue;
      xs.push(xa);
      ys.push(yb);
    }
    if (xs.length < 10) continue;
    correlations.push({
      metricA: a,
      metricB: b,
      population: "CREATOR_PUBLISHING",
      sampleSize: xs.length,
      pearson: pearson(xs, ys),
      spearman: spearman(xs, ys),
    });
  }

  const counts = all.map((r) => r.snapshotCount);
  const sortedCounts = counts.slice().sort((a, b) => a - b);
  const byPostType: Record<string, number> = {};
  for (const r of all) {
    byPostType[r.postType] = (byPostType[r.postType] || 0) + r.snapshotCount;
  }
  const snapshotStats: SnapshotStats = {
    totalSnapshots: counts.reduce((a, b) => a + b, 0),
    postsWithAtLeastOne: counts.filter((c) => c >= 1).length,
    postsWithMultiple: counts.filter((c) => c >= 2).length,
    avgSnapshotsPerPost:
      all.length === 0 ? null : counts.reduce((a, b) => a + b, 0) / all.length,
    medianSnapshotsPerPost: percentile(sortedCounts, 50),
    maxSnapshotsPerPost: sortedCounts.length
      ? sortedCounts[sortedCounts.length - 1]
      : 0,
    byPostType,
  };

  const monthMap = new Map<string, MonthlyBucket>();
  for (const r of all) {
    if (!r.publishedAt) continue;
    const ym = r.publishedAt.slice(0, 7);
    if (!monthMap.has(ym)) {
      monthMap.set(ym, {
        yearMonth: ym,
        total: 0,
        original: 0,
        quote: 0,
        reply: 0,
        repost: 0,
        other: 0,
        withPublicMetrics: 0,
        withOrganicMetrics: 0,
        withNonPublicMetrics: 0,
      });
    }
    const b = monthMap.get(ym)!;
    b.total += 1;
    if (r.isOriginal) b.original += 1;
    else if (r.isQuote) b.quote += 1;
    else if (r.isReply) b.reply += 1;
    else if (r.isRepost) b.repost += 1;
    else b.other += 1;
    if (r.metricAvailability.public) b.withPublicMetrics += 1;
    if (r.metricAvailability.organic) b.withOrganicMetrics += 1;
    if (r.metricAvailability.nonPublic) b.withNonPublicMetrics += 1;
  }
  const monthly = Array.from(monthMap.values()).sort((a, b) =>
    a.yearMonth.localeCompare(b.yearMonth)
  );

  const pubCreator = familyCoverage.find(
    (f) => f.family === "public" && f.population === "CREATOR_PUBLISHING"
  );
  const likeCov = publicMetricCoverage.find(
    (c) => c.metricKey === "like_count" && c.population === "CREATOR_PUBLISHING"
  );
  const orgCreator = familyCoverage.find(
    (f) => f.family === "organic" && f.population === "CREATOR_PUBLISHING"
  );
  const nonCreator = familyCoverage.find(
    (f) => f.family === "non_public" && f.population === "CREATOR_PUBLISHING"
  );

  const verdicts: PerformanceVerdict[] = [];
  const rationale: string[] = [];
  const creatorN = activity.creatorPublishing;
  if (
    creatorN >= 50 &&
    pubCreator &&
    pubCreator.usable >= 50 &&
    (pubCreator.coveragePct ?? 0) >= 70 &&
    likeCov &&
    (likeCov.coveragePct ?? 0) >= 70
  ) {
    verdicts.push("A_SUFFICIENT_HISTORICAL_PUBLIC");
    rationale.push(
      `Creator Publishing n=${creatorN}, public usable=${pubCreator.usable}, like cov=${likeCov.coveragePct?.toFixed(1)}%`
    );
  } else if (creatorN >= 10 && pubCreator && pubCreator.usable >= 10) {
    verdicts.push("B_PARTIAL_HISTORICAL");
    rationale.push(
      `Partial: creator n=${creatorN}, usable public=${pubCreator.usable}`
    );
  } else {
    verdicts.push("C_INSUFFICIENT_HISTORICAL");
    rationale.push(
      `Insufficient creator public metrics (n=${creatorN}, usable=${pubCreator?.usable ?? 0})`
    );
  }
  if ((orgCreator?.usable ?? 0) + (nonCreator?.usable ?? 0) < 30) {
    verdicts.push("D_DEEP_METRICS_LIMITED");
    rationale.push(
      `Deep limited: organic=${orgCreator?.usable ?? 0}, non_public=${nonCreator?.usable ?? 0}`
    );
  }

  const published = all
    .map((e) => e.publishedAt)
    .filter((x): x is string => Boolean(x))
    .sort();

  return {
    generatedAt: new Date().toISOString(),
    accountId: options?.accountId ?? null,
    sourceUsed: [adapter.source],
    inventory: {
      totalNormalizedRecords: all.length,
      earliestPublishedAt: published[0] || null,
      latestPublishedAt: published[published.length - 1] || null,
    },
    activityCounts: activity,
    publicMetricCoverage,
    creatorPublishingCoverage: publicMetricCoverage.filter(
      (c) => c.population === "CREATOR_PUBLISHING"
    ),
    familyCoverage,
    snapshotStats,
    distributions,
    correlations,
    monthly,
    dataQuality: issues,
    verdicts,
    verdictRationale: rationale,
    recommendedNextSteps: [
      "Review Creator Publishing coverage before Performance DNA expansion",
      "Keep ORIGINAL+QUOTE separate from REPLY",
      "Do not validate Candidate Patterns until coverage supports it",
    ],
    architectureNote:
      "Analyzers use NormalizedEvidence only. XArchiveAdapter can plug in without changing analyzers.",
  };
}
