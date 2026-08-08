/**
 * Phase 1A — Maximum X API data collection (own account)
 * Collect only. Do NOT run Creator/Performance DNA learning here.
 * Persists via lib/x/evidence (canonical posts + metric snapshots).
 */

import { createClient } from "@/lib/supabase/server";
import {
  createXClient,
  getXConnectionMeta,
  XClientNotConfiguredError,
  type CollectionEndReason,
  type XTimelinePost,
  type XMentionPost,
  type MetricBag,
} from "@/lib/x/client";
import {
  persistXPostEvidence,
  persistMentionEvidence,
  coverageFromStoredEvidence,
} from "@/lib/x/evidence";

export type LimitationClass =
  | "AVAILABLE"
  | "API_LIMITATION"
  | "AUTH_PERMISSION_LIMITATION"
  | "PRODUCT_TIER_LIMITATION"
  | "HISTORICAL_WINDOW_LIMITATION"
  | "RATE_COST_LIMITATION"
  | "IMPLEMENTATION_GAP"
  | "DATA_DOES_NOT_EXIST"
  | "UNKNOWN";

export type MetricCoverage = {
  name: string;
  available: boolean;
  postsWithMetric: number;
  earliest: string | null;
  latest: string | null;
  limitation: LimitationClass;
  note: string;
};

export type Phase1ACoverageReport = {
  account: {
    xUserId: string | null;
    handle: string | null;
    authStatus: string;
    scopes: string | null;
    followersCount: number | null;
    followingCount: number | null;
    tweetCountReported: number | null;
  };
  posts: {
    totalCollected: number;
    earliest: string | null;
    latest: string | null;
    original: number;
    reply: number;
    quote: number;
    repost: number;
    unknown: number;
    endReason: CollectionEndReason;
    pagesFetched: number;
  };
  metrics: MetricCoverage[];
  metricsBySource: {
    public: { fields: MetricCoverage[]; postsWithAny: number };
    nonPublic: {
      fields: MetricCoverage[];
      postsWithAny: number;
      requestStatus: string;
    };
    organic: {
      fields: MetricCoverage[];
      postsWithAny: number;
      requestStatus: string;
    };
  };
  authContext: {
    authenticationType: string;
    scopes: string | null;
    userContext: boolean;
    nonPublicMetricsAccepted: boolean | null;
    organicMetricsAccepted: boolean | null;
    metricFieldEvidence: Record<string, unknown> | null;
  };
  mentions: {
    totalCollected: number;
    earliest: string | null;
    latest: string | null;
    endReason: CollectionEndReason | "NOT_ATTEMPTED" | "FAILED";
    uniqueAuthors: number;
  };
  conversation: {
    withConversationId: number;
    withInReplyTo: number;
    withReferenced: number;
    uniqueInteractingAccounts: number;
    limitations: string[];
  };
  followersFollowing: {
    available: boolean;
    collectedCounts: boolean;
    followers: number | null;
    following: number | null;
    listMembersCollected: boolean;
    limitation: LimitationClass;
    note: string;
  };
  media: { textOnly: number; withMediaKeys: number; unknown: number };
  systemMatch: {
    matchedToSeungContent: number;
    outsideSystem: number;
    unknown: number;
  };
  collectionLimits: { area: string; class: LimitationClass; detail: string }[];
  enoughForBaselineLearning: "YES" | "PARTIAL" | "NO";
  enoughReason: string;
  phaseStatus: "STOP_FOR_REVIEW";
  learned: false;
};

function classifyAction(
  refs?: { type: string; id: string }[]
): "ORIGINAL" | "REPLY" | "QUOTE" | "REPOST" | "UNKNOWN" {
  if (!refs || !refs.length) return "ORIGINAL";
  const types = refs.map((r) => r.type);
  if (types.includes("retweeted")) return "REPOST";
  if (types.includes("quoted")) return "QUOTE";
  if (types.includes("replied_to")) return "REPLY";
  return "UNKNOWN";
}

function metricPresent(pm: MetricBag | null | undefined, key: string): boolean {
  return pm != null && pm[key] != null && typeof pm[key] === "number";
}

function coverageForBag(
  posts: XTimelinePost[],
  bag: "publicMetrics" | "nonPublicMetrics" | "organicMetrics",
  field: string
): MetricCoverage {
  const withM = posts.filter((p) => metricPresent(p[bag], field));
  const dates = withM.map((p) => p.createdAt).filter(Boolean).sort();
  const available = withM.length > 0;
  return {
    name: field,
    available,
    postsWithMetric: withM.length,
    earliest: dates[0] || null,
    latest: dates[dates.length - 1] || null,
    limitation: available ? "AVAILABLE" : "UNKNOWN",
    note: available
      ? `Returned on ${withM.length}/${posts.length} posts in ${bag}`
      : `Key "${field}" not present on any post's ${bag} in this collection`,
  };
}

function allKeysFromBag(
  posts: XTimelinePost[],
  bag: "publicMetrics" | "nonPublicMetrics" | "organicMetrics"
): string[] {
  const keys = new Set<string>();
  for (const p of posts) {
    const m = p[bag];
    if (m) Object.keys(m).forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

const SAFETY_MAX_PAGES = 50;
const MENTIONS_MAX_PAGES = 20;

export async function runPhase1AMaxCollection(opts?: {
  includeMentions?: boolean;
  maxPages?: number;
}): Promise<{
  ok: boolean;
  error?: string;
  report: Phase1ACoverageReport;
  itemsCreated: number;
  itemsUpdated: number;
  mentionsCreated: number;
}> {
  const includeMentions = opts?.includeMentions !== false;
  const maxPages = Math.min(opts?.maxPages || SAFETY_MAX_PAGES, SAFETY_MAX_PAGES);

  const meta = await getXConnectionMeta();

  const emptyReport = (
    partial: Partial<Phase1ACoverageReport>
  ): Phase1ACoverageReport => ({
    account: {
      xUserId: meta?.xUserId || null,
      handle: meta?.handle || null,
      authStatus: meta?.tokenPresent ? "token_present" : "not_connected",
      scopes:
        meta?.scopes ||
        "tweet.read users.read offline.access (configured default)",
      followersCount: null,
      followingCount: null,
      tweetCountReported: null,
    },
    posts: {
      totalCollected: 0,
      earliest: null,
      latest: null,
      original: 0,
      reply: 0,
      quote: 0,
      repost: 0,
      unknown: 0,
      endReason: "ERROR",
      pagesFetched: 0,
    },
    metrics: [],
    metricsBySource: {
      public: { fields: [], postsWithAny: 0 },
      nonPublic: { fields: [], postsWithAny: 0, requestStatus: "unknown" },
      organic: { fields: [], postsWithAny: 0, requestStatus: "unknown" },
    },
    authContext: {
      authenticationType: "oauth2_user_context",
      scopes: meta?.scopes || null,
      userContext: true,
      nonPublicMetricsAccepted: null,
      organicMetricsAccepted: null,
      metricFieldEvidence: null,
    },
    mentions: {
      totalCollected: 0,
      earliest: null,
      latest: null,
      endReason: "NOT_ATTEMPTED",
      uniqueAuthors: 0,
    },
    conversation: {
      withConversationId: 0,
      withInReplyTo: 0,
      withReferenced: 0,
      uniqueInteractingAccounts: 0,
      limitations: [],
    },
    followersFollowing: {
      available: false,
      collectedCounts: false,
      followers: null,
      following: null,
      listMembersCollected: false,
      limitation: "AUTH_PERMISSION_LIMITATION",
      note: "Not connected",
    },
    media: { textOnly: 0, withMediaKeys: 0, unknown: 0 },
    systemMatch: { matchedToSeungContent: 0, outsideSystem: 0, unknown: 0 },
    collectionLimits: [],
    enoughForBaselineLearning: "NO",
    enoughReason: "X OAuth not connected — no API evidence collected.",
    phaseStatus: "STOP_FOR_REVIEW",
    learned: false,
    ...partial,
  });

  if (!meta?.tokenPresent) {
    return {
      ok: false,
      error: "X OAuth not connected",
      report: emptyReport({
        collectionLimits: [
          {
            area: "Authentication",
            class: "AUTH_PERMISSION_LIMITATION",
            detail:
              "No access_token in account_connections. Connect X OAuth first.",
          },
        ],
      }),
      itemsCreated: 0,
      itemsUpdated: 0,
      mentionsCreated: 0,
    };
  }

  const supabase = await createClient();
  let client;
  try {
    client = await createXClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "client_error";
    return {
      ok: false,
      error: msg,
      report: emptyReport({
        collectionLimits: [
          {
            area: "Client",
            class:
              e instanceof XClientNotConfiguredError
                ? "AUTH_PERMISSION_LIMITATION"
                : "UNKNOWN",
            detail: msg,
          },
        ],
      }),
      itemsCreated: 0,
      itemsUpdated: 0,
      mentionsCreated: 0,
    };
  }

  const me = await client.getMe();

  const { data: conn } = await supabase
    .from("account_connections")
    .select("id")
    .eq("x_user_id", me.id)
    .eq("platform", "x")
    .maybeSingle();

  const accountId = conn?.id || meta.connectionId;
  if (!accountId) {
    return {
      ok: false,
      error: "No account_connections row",
      report: emptyReport({
        account: {
          xUserId: me.id,
          handle: me.username,
          authStatus: "authenticated_but_no_connection_row",
          scopes: meta.scopes || null,
          followersCount: me.followersCount ?? null,
          followingCount: me.followingCount ?? null,
          tweetCountReported: me.tweetCount ?? null,
        },
      }),
      itemsCreated: 0,
      itemsUpdated: 0,
      mentionsCreated: 0,
    };
  }

  const { data: run } = await supabase
    .from("x_sync_runs")
    .insert({
      account_id: accountId,
      status: "running",
      source: "phase1a_max_collect",
    })
    .select("id")
    .maybeSingle();
  const runId = run?.id;

  let paginationToken: string | undefined;
  let pages = 0;
  let endReason: CollectionEndReason = "END_OF_AVAILABLE_HISTORY";
  const allPosts: XTimelinePost[] = [];
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let metricSnapshotsWritten = 0;
  let metricFieldEvidence: Record<string, unknown> | null = null;
  let fieldsMode: string | null = null;
  let nonPublicAccepted: boolean | null = null;
  let organicAccepted: boolean | null = null;

  while (pages < maxPages) {
    const page = await client.getUserTimeline({
      userId: me.id,
      maxResults: 100,
      paginationToken,
      preferPrivateMetrics: true,
    });

    if (page.metricFieldEvidence && !metricFieldEvidence) {
      metricFieldEvidence = page.metricFieldEvidence as unknown as Record<
        string,
        unknown
      >;
      fieldsMode = page.fieldsMode || null;
      if (page.fieldsMode === "full_metrics") {
        nonPublicAccepted = true;
        organicAccepted = true;
      } else if (page.metricFieldEvidence?.rejected) {
        nonPublicAccepted = false;
        organicAccepted = false;
      }
    }

    if (page.rateLimited) {
      endReason = "RATE_LIMIT";
      break;
    }
    if (page.status === 401 || page.status === 403) {
      endReason = "PERMISSION_LIMIT";
      break;
    }
    if (page.error && !page.posts.length) {
      endReason = "ERROR";
      break;
    }
    if (!page.posts.length) {
      endReason = pages === 0 ? "EMPTY_PAGE" : "END_OF_AVAILABLE_HISTORY";
      break;
    }

    pages += 1;

    for (const p of page.posts) {
      allPosts.push(p);
      const action = classifyAction(p.referencedTweets);
      try {
        const result = await persistXPostEvidence(supabase, {
          accountId,
          xUserId: me.id,
          handle: me.username,
          post: p,
          origin: "X_ACTUAL",
          actionType: action,
          status: "PUBLISHED",
          collectionSource: "phase1a",
          collectionRunId: runId || null,
          systemOriginClass: "UNKNOWN",
          requestMeta: {
            fieldsMode,
            metricFieldEvidence,
          },
        });
        if (result.postStatus === "NEW") itemsCreated += 1;
        else if (result.postStatus === "UPDATED") itemsUpdated += 1;
        if (result.snapshotWritten) metricSnapshotsWritten += 1;
      } catch (persistErr) {
        console.error("persist post", p.id, persistErr);
      }
    }

    if (!page.nextToken) {
      endReason = "END_OF_AVAILABLE_HISTORY";
      break;
    }
    paginationToken = page.nextToken;
  }

  if (pages >= maxPages && endReason === "END_OF_AVAILABLE_HISTORY") {
    endReason = "MAX_PAGES_SAFETY";
  }

  let original = 0,
    reply = 0,
    quote = 0,
    repost = 0,
    unknown = 0;
  for (const p of allPosts) {
    const a = classifyAction(p.referencedTweets);
    if (a === "ORIGINAL") original += 1;
    else if (a === "REPLY") reply += 1;
    else if (a === "QUOTE") quote += 1;
    else if (a === "REPOST") repost += 1;
    else unknown += 1;
  }

  const dates = allPosts.map((p) => p.createdAt).filter(Boolean).sort();
  const earliest = dates[0] || null;
  const latest = dates[dates.length - 1] || null;

  const publicKeys = allKeysFromBag(allPosts, "publicMetrics");
  const nonPublicKeys = allKeysFromBag(allPosts, "nonPublicMetrics");
  const organicKeys = allKeysFromBag(allPosts, "organicMetrics");

  const publicReportFields = [
    ...new Set([
      ...publicKeys,
      "impression_count",
      "like_count",
      "reply_count",
      "retweet_count",
      "quote_count",
      "bookmark_count",
    ]),
  ];
  const publicFieldCoverage = publicReportFields.map((f) => {
    const c = coverageForBag(allPosts, "publicMetrics", f);
    if (!c.available && fieldsMode) {
      c.limitation = "UNKNOWN";
      c.note = `fieldsMode=${fieldsMode} but key "${f}" not on any public_metrics`;
    }
    return c;
  });

  const nonPublicFieldCoverage =
    nonPublicKeys.length > 0
      ? nonPublicKeys.map((f) =>
          coverageForBag(allPosts, "nonPublicMetrics", f)
        )
      : [
          {
            name: "(none returned)",
            available: false,
            postsWithMetric: 0,
            earliest: null,
            latest: null,
            limitation:
              nonPublicAccepted === false
                ? "AUTH_PERMISSION_LIMITATION"
                : nonPublicAccepted === true
                  ? "HISTORICAL_WINDOW_LIMITATION"
                  : "UNKNOWN",
            note:
              nonPublicAccepted === false
                ? `non_public_metrics rejected: ${JSON.stringify(metricFieldEvidence)}`
                : nonPublicAccepted === true
                  ? "non_public_metrics accepted but empty on collected posts"
                  : "non_public_metrics acceptance unknown",
          } as MetricCoverage,
        ];

  for (const f of ["url_link_clicks", "user_profile_clicks", "engagements"]) {
    if (!nonPublicKeys.includes(f) && nonPublicAccepted === true) {
      nonPublicFieldCoverage.push({
        name: f,
        available: false,
        postsWithMetric: 0,
        earliest: null,
        latest: null,
        limitation: "UNKNOWN",
        note: `Field "${f}" not present (user_profile_clicks ≠ account-level profile visits)`,
      });
    }
  }

  const organicFieldCoverage =
    organicKeys.length > 0
      ? organicKeys.map((f) => coverageForBag(allPosts, "organicMetrics", f))
      : [
          {
            name: "(none returned)",
            available: false,
            postsWithMetric: 0,
            earliest: null,
            latest: null,
            limitation:
              organicAccepted === false
                ? "AUTH_PERMISSION_LIMITATION"
                : organicAccepted === true
                  ? "HISTORICAL_WINDOW_LIMITATION"
                  : "UNKNOWN",
            note:
              organicAccepted === false
                ? `organic_metrics rejected: ${JSON.stringify(metricFieldEvidence)}`
                : organicAccepted === true
                  ? "organic_metrics accepted but empty"
                  : "organic_metrics acceptance unknown",
          } as MetricCoverage,
        ];

  const metricsClean: MetricCoverage[] = [
    ...publicFieldCoverage.map((c) => ({ ...c, note: `[public] ${c.note}` })),
    ...nonPublicFieldCoverage.map((c) => ({
      ...c,
      note: `[non_public] ${c.note}`,
    })),
    ...organicFieldCoverage.map((c) => ({
      ...c,
      note: `[organic] ${c.note}`,
    })),
  ];

  const postsWithPublic = allPosts.filter(
    (p) => p.publicMetrics && Object.keys(p.publicMetrics).length
  ).length;
  const postsWithNonPublic = allPosts.filter(
    (p) => p.nonPublicMetrics && Object.keys(p.nonPublicMetrics).length
  ).length;
  const postsWithOrganic = allPosts.filter(
    (p) => p.organicMetrics && Object.keys(p.organicMetrics).length
  ).length;

  let mentionEnd: CollectionEndReason | "NOT_ATTEMPTED" | "FAILED" =
    "NOT_ATTEMPTED";
  let mentions: XMentionPost[] = [];
  let mentionsCreated = 0;
  if (includeMentions) {
    let mToken: string | undefined;
    let mPages = 0;
    mentionEnd = "END_OF_AVAILABLE_HISTORY";
    while (mPages < MENTIONS_MAX_PAGES) {
      const page = await client.getMentions({
        userId: me.id,
        maxResults: 100,
        paginationToken: mToken,
      });
      if (page.rateLimited) {
        mentionEnd = "RATE_LIMIT";
        break;
      }
      if (page.error && !page.posts.length) {
        mentionEnd =
          page.status === 403 || page.status === 401
            ? "PERMISSION_LIMIT"
            : "ERROR";
        break;
      }
      if (!page.posts.length) {
        mentionEnd = mPages === 0 ? "EMPTY_PAGE" : "END_OF_AVAILABLE_HISTORY";
        break;
      }
      mPages += 1;
      for (const p of page.posts) {
        mentions.push(p);
        try {
          const result = await persistMentionEvidence(supabase, {
            accountId,
            creatorXUserId: me.id,
            mention: p,
            collectionSource: "phase1a_mentions",
            collectionRunId: runId || null,
            requestMeta: { fieldsMode: "public_only" },
          });
          if (result.postStatus === "NEW") mentionsCreated += 1;
          if (result.snapshotWritten) metricSnapshotsWritten += 1;
        } catch (e) {
          console.error("persist mention", p.id, e);
        }
      }
      if (!page.nextToken) {
        mentionEnd = "END_OF_AVAILABLE_HISTORY";
        break;
      }
      mToken = page.nextToken;
    }
    if (mPages >= MENTIONS_MAX_PAGES) mentionEnd = "MAX_PAGES_SAFETY";
  }

  const mDates = mentions.map((p) => p.createdAt).filter(Boolean).sort();
  const uniqueAuthors = new Set(
    mentions.map((m) => m.authorId).filter(Boolean)
  ).size;

  const withConv = allPosts.filter((p) => p.conversationId).length;
  const withReply = allPosts.filter((p) => p.inReplyToUserId).length;
  const withRef = allPosts.filter(
    (p) => p.referencedTweets && p.referencedTweets.length
  ).length;
  const interacting = new Set<string>();
  for (const p of allPosts) {
    if (p.inReplyToUserId) interacting.add(p.inReplyToUserId);
  }
  for (const m of mentions) {
    if (m.authorId) interacting.add(m.authorId);
  }

  let textOnly = 0,
    withMedia = 0;
  for (const p of allPosts) {
    if (p.attachments?.media_keys && p.attachments.media_keys.length)
      withMedia += 1;
    else textOnly += 1;
  }

  let matched = 0;
  let outside = allPosts.length;
  try {
    const ids = allPosts.map((p) => p.id);
    for (const col of ["x_post_id", "tweet_id", "external_id"]) {
      const { data } = await supabase
        .from("SeungContent")
        .select("id")
        .in(col, ids.slice(0, 200));
      if (data && data.length) {
        matched = data.length;
        outside = Math.max(0, allPosts.length - matched);
        break;
      }
    }
  } catch {
    matched = 0;
    outside = allPosts.length;
  }

  const nowIso = new Date().toISOString();
  await supabase.from("account_snapshots").upsert(
    {
      account_id: accountId,
      snapshot_date: nowIso.slice(0, 10),
      followers_count: me.followersCount ?? null,
      following_count: me.followingCount ?? null,
      posts_count: me.tweetCount ?? null,
      sync_run_id: runId || null,
      captured_at: nowIso,
    },
    { onConflict: "account_id,snapshot_date" }
  );

  await supabase
    .from("account_connections")
    .update({
      handle: me.username,
      display_name: me.name,
      x_user_id: me.id,
      followers_count: me.followersCount ?? null,
      following_count: me.followingCount ?? null,
      profile_image_url: me.profileImageUrl ?? null,
      last_successful_sync_at: nowIso,
      last_sync_status: "phase1a_ok",
      last_sync_error: null,
      updated_at: nowIso,
    })
    .eq("id", accountId);

  if (runId) {
    await supabase
      .from("x_sync_runs")
      .update({
        status: endReason === "ERROR" ? "error" : "ok",
        completed_at: nowIso,
        items_fetched: allPosts.length + mentions.length,
        items_created: itemsCreated + mentionsCreated,
        items_updated: itemsUpdated,
        pages_fetched: pages,
        posts_discovered: allPosts.length,
        posts_new: itemsCreated,
        posts_updated: itemsUpdated,
        mentions_discovered: mentions.length,
        metric_snapshots_written: metricSnapshotsWritten,
        earliest_post_at: earliest,
        latest_post_at: latest,
        end_reason: endReason,
        rate_limited: endReason === "RATE_LIMIT",
        metric_field_evidence: metricFieldEvidence,
      })
      .eq("id", runId);
  }

  let enough: "YES" | "PARTIAL" | "NO" = "NO";
  let enoughReason = "";
  if (allPosts.length >= 100) {
    enough = "PARTIAL";
    enoughReason = `Collected ${allPosts.length} posts. Public keys: [${publicKeys.join(", ") || "none"}]. Non-public: [${nonPublicKeys.join(", ") || "none"}]. Organic: [${organicKeys.join(", ") || "none"}].`;
  } else if (allPosts.length >= 20) {
    enough = "PARTIAL";
    enoughReason = `Only ${allPosts.length} posts. public=${postsWithPublic}, non_public=${postsWithNonPublic}, organic=${postsWithOrganic}.`;
  } else if (allPosts.length > 0) {
    enough = "PARTIAL";
    enoughReason = `Very small sample (${allPosts.length}).`;
  } else {
    enough = "NO";
    enoughReason = "Zero posts collected from API.";
  }

  const collectionLimits: Phase1ACoverageReport["collectionLimits"] = [
    {
      area: "Full lifetime post history (~32k)",
      class: "API_LIMITATION",
      detail:
        "User timeline returns a finite recent window; full archive needs X Archive backfill.",
    },
    {
      area: "Private metric fields (non_public_metrics / organic_metrics)",
      class:
        nonPublicAccepted === false
          ? "AUTH_PERMISSION_LIMITATION"
          : "UNKNOWN",
      detail:
        nonPublicAccepted === false
          ? `Request rejected: ${JSON.stringify(metricFieldEvidence)}`
          : nonPublicAccepted === true
            ? `Accepted. non_public posts=${postsWithNonPublic}, organic=${postsWithOrganic}.`
            : "Not verified until live authenticated collection.",
    },
    {
      area: "Follower/following member lists",
      class: "IMPLEMENTATION_GAP",
      detail: "Counts only from /users/me; full ID lists deferred.",
    },
  ];
  if (endReason === "RATE_LIMIT") {
    collectionLimits.push({
      area: "Timeline pagination",
      class: "RATE_COST_LIMITATION",
      detail: "Stopped on 429. Resume later.",
    });
  }
  if (endReason === "MAX_PAGES_SAFETY") {
    collectionLimits.push({
      area: "Timeline pagination",
      class: "RATE_COST_LIMITATION",
      detail: `Stopped at safety max_pages=${maxPages}.`,
    });
  }

  if (runId) {
    await supabase
      .from("x_sync_runs")
      .update({ limitation_notes: collectionLimits })
      .eq("id", runId);
  }

  try {
    await coverageFromStoredEvidence(supabase, accountId);
  } catch {
    /* store may lack migration yet */
  }

  const report: Phase1ACoverageReport = {
    account: {
      xUserId: me.id,
      handle: me.username,
      authStatus: "authenticated",
      scopes: meta.scopes || "tweet.read users.read offline.access",
      followersCount: me.followersCount ?? null,
      followingCount: me.followingCount ?? null,
      tweetCountReported: me.tweetCount ?? null,
    },
    posts: {
      totalCollected: allPosts.length,
      earliest,
      latest,
      original,
      reply,
      quote,
      repost,
      unknown,
      endReason,
      pagesFetched: pages,
    },
    metrics: metricsClean,
    metricsBySource: {
      public: { fields: publicFieldCoverage, postsWithAny: postsWithPublic },
      nonPublic: {
        fields: nonPublicFieldCoverage,
        postsWithAny: postsWithNonPublic,
        requestStatus:
          nonPublicAccepted === true
            ? "accepted"
            : nonPublicAccepted === false
              ? "rejected"
              : "unknown",
      },
      organic: {
        fields: organicFieldCoverage,
        postsWithAny: postsWithOrganic,
        requestStatus:
          organicAccepted === true
            ? "accepted"
            : organicAccepted === false
              ? "rejected"
              : "unknown",
      },
    },
    authContext: {
      authenticationType: "oauth2_user_context",
      scopes: meta.scopes || "tweet.read users.read offline.access",
      userContext: true,
      nonPublicMetricsAccepted: nonPublicAccepted,
      organicMetricsAccepted: organicAccepted,
      metricFieldEvidence,
    },
    mentions: {
      totalCollected: mentions.length,
      earliest: mDates[0] || null,
      latest: mDates[mDates.length - 1] || null,
      endReason: mentionEnd,
      uniqueAuthors,
    },
    conversation: {
      withConversationId: withConv,
      withInReplyTo: withReply,
      withReferenced: withRef,
      uniqueInteractingAccounts: interacting.size,
      limitations: [
        "Raw ID links only — no relationship strength in Phase 1A",
      ],
    },
    followersFollowing: {
      available: true,
      collectedCounts: true,
      followers: me.followersCount ?? null,
      following: me.followingCount ?? null,
      listMembersCollected: false,
      limitation: "IMPLEMENTATION_GAP",
      note: "Counts only from public_metrics on /users/me",
    },
    media: { textOnly, withMediaKeys: withMedia, unknown: 0 },
    systemMatch: {
      matchedToSeungContent: matched,
      outsideSystem: outside,
      unknown: matched === 0 ? allPosts.length : 0,
    },
    collectionLimits,
    enoughForBaselineLearning: enough,
    enoughReason,
    phaseStatus: "STOP_FOR_REVIEW",
    learned: false,
  };

  return {
    ok: true,
    report,
    itemsCreated,
    itemsUpdated,
    mentionsCreated,
  };
}
