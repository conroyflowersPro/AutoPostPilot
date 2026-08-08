/**
 * Phase 1A — resumable batched X collection (Netlify ~26s safe).
 * Fetch a little → persist → checkpoint → return → UI resumes.
 */
import { createClient } from "@/lib/supabase/server";
import {
  createXClient,
  getXConnectionMeta,
  XClientNotConfiguredError,
} from "@/lib/x/client";
import {
  persistXPostEvidence,
  persistMentionEvidence,
} from "@/lib/x/evidence";

export type RunStatus =
  | "READY"
  | "RUNNING"
  | "RATE_LIMITED"
  | "PAUSED"
  | "FAILED_RETRYABLE"
  | "FAILED_FATAL"
  | "COMPLETE"
  | "CANCELLED"
  | "MAX_PAGES_SAFETY";

export type CollectPhase = "POSTS" | "MENTIONS" | "COMPLETE";

export type BatchResult = {
  ok: boolean;
  runId: string | null;
  status: RunStatus;
  phase: CollectPhase;
  batchPagesFetched: number;
  totalPagesFetched: number;
  batchPostsProcessed: number;
  totalPostsCollected: number;
  totalMentionsCollected: number;
  metricSnapshotsWritten: number;
  nextTokenPresent: boolean;
  earliestDate: string | null;
  latestDate: string | null;
  endReason: string | null;
  shouldContinue: boolean;
  retryAfterSeconds: number | null;
  error: string | null;
  messageKo: string;
};

const DEFAULT_PAGES_PER_BATCH = 2;
const TIME_BUDGET_MS = 18_000;
const OVERALL_PAGE_SAFETY = 200;

/** Statuses that must stop auto-continue */
const STOP_STATUSES: readonly RunStatus[] = [
  "COMPLETE",
  "FAILED_FATAL",
  "CANCELLED",
  "PAUSED",
];

function classifyAction(
  refs?: { type: string; id: string }[]
): "ORIGINAL" | "REPLY" | "QUOTE" | "REPOST" | "UNKNOWN" {
  if (!refs?.length) return "ORIGINAL";
  const types = refs.map((r) => r.type);
  if (types.includes("retweeted")) return "REPOST";
  if (types.includes("quoted")) return "QUOTE";
  if (types.includes("replied_to")) return "REPLY";
  return "UNKNOWN";
}

export async function runPhase1ABatch(opts?: {
  maxPagesPerBatch?: number;
  includeMentions?: boolean;
}): Promise<BatchResult> {
  const start = Date.now();
  const maxPagesPerBatch = Math.min(
    Math.max(opts?.maxPagesPerBatch ?? DEFAULT_PAGES_PER_BATCH, 1),
    3
  );
  const includeMentions = opts?.includeMentions !== false;

  const empty = (partial: Partial<BatchResult>): BatchResult => ({
    ok: false,
    runId: null,
    status: "FAILED_FATAL",
    phase: "POSTS",
    batchPagesFetched: 0,
    totalPagesFetched: 0,
    batchPostsProcessed: 0,
    totalPostsCollected: 0,
    totalMentionsCollected: 0,
    metricSnapshotsWritten: 0,
    nextTokenPresent: false,
    earliestDate: null,
    latestDate: null,
    endReason: null,
    shouldContinue: false,
    retryAfterSeconds: null,
    error: null,
    messageKo: "",
    ...partial,
  });

  const meta = await getXConnectionMeta();
  if (!meta?.tokenPresent) {
    return empty({
      status: "PAUSED",
      error: "X OAuth not connected",
      messageKo: "X 연결 후 다시 시도하세요.",
    });
  }

  const supabase = await createClient();
  let client;
  try {
    client = await createXClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "client_error";
    return empty({
      status:
        e instanceof XClientNotConfiguredError ? "PAUSED" : "FAILED_RETRYABLE",
      error: msg,
      messageKo: msg,
    });
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
    return empty({
      status: "FAILED_FATAL",
      error: "No account_connections row",
      messageKo: "계정 연결 행이 없습니다.",
    });
  }

  const { data: activeRuns } = await supabase
    .from("x_sync_runs")
    .select("*")
    .eq("account_id", accountId)
    .eq("source", "phase1a_max_collect")
    .in("run_status", [
      "RUNNING",
      "RATE_LIMITED",
      "PAUSED",
      "FAILED_RETRYABLE",
      "MAX_PAGES_SAFETY",
      "READY",
    ])
    .order("started_at", { ascending: false })
    .limit(1);

  let run = activeRuns?.[0] as Record<string, unknown> | undefined;
  if (!run) {
    const { data: created } = await supabase
      .from("x_sync_runs")
      .insert({
        account_id: accountId,
        status: "running",
        source: "phase1a_max_collect",
        phase: "POSTS",
        run_status: "RUNNING",
        pages_fetched: 0,
        posts_discovered: 0,
        posts_new: 0,
        posts_updated: 0,
        mentions_discovered: 0,
        metric_snapshots_written: 0,
        next_token: null,
        checkpoint_meta: { x_user_id: me.id, handle: me.username },
      })
      .select("*")
      .maybeSingle();
    run = created as Record<string, unknown> | undefined;
  }

  if (!run?.id) {
    return empty({
      status: "FAILED_FATAL",
      error: "Could not create/load collection run",
      messageKo:
        "수집 세션 생성 실패 (checkpoint 컬럼 마이그레이션 필요할 수 있음)",
    });
  }

  const runId = String(run.id);
  let phase = (run.phase as CollectPhase) || "POSTS";
  if (phase === "COMPLETE" || run.run_status === "COMPLETE") {
    return {
      ok: true,
      runId,
      status: "COMPLETE",
      phase: "COMPLETE",
      batchPagesFetched: 0,
      totalPagesFetched: Number(run.pages_fetched) || 0,
      batchPostsProcessed: 0,
      totalPostsCollected: Number(run.posts_discovered) || 0,
      totalMentionsCollected: Number(run.mentions_discovered) || 0,
      metricSnapshotsWritten: Number(run.metric_snapshots_written) || 0,
      nextTokenPresent: false,
      earliestDate: (run.earliest_post_at as string) || null,
      latestDate: (run.latest_post_at as string) || null,
      endReason: "ALREADY_COMPLETE",
      shouldContinue: false,
      retryAfterSeconds: null,
      error: null,
      messageKo: "이미 완료된 수집 세션입니다.",
    };
  }

  await supabase
    .from("x_sync_runs")
    .update({ run_status: "RUNNING", status: "running" })
    .eq("id", runId);

  let batchPages = 0;
  let batchPosts = 0;
  let postsNew = 0;
  let postsUpdated = 0;
  let paginationToken =
    typeof run.next_token === "string" && run.next_token
      ? (run.next_token as string)
      : undefined;
  let totalPages = Number(run.pages_fetched) || 0;
  let totalPosts = Number(run.posts_discovered) || 0;
  let totalMentions = Number(run.mentions_discovered) || 0;
  let totalSnapshots = Number(run.metric_snapshots_written) || 0;
  let earliest = (run.earliest_post_at as string) || null;
  let latest = (run.latest_post_at as string) || null;
  let endReason: string | null = null;
  let status: RunStatus = "RUNNING";
  let shouldContinue = true;
  let retryAfter: number | null = null;
  let error: string | null = null;
  const justEnteredMentions = { value: false };

  if (phase === "POSTS") {
    while (batchPages < maxPagesPerBatch) {
      if (Date.now() - start > TIME_BUDGET_MS) {
        endReason = "TIME_BUDGET";
        shouldContinue = true;
        break;
      }
      if (totalPages >= OVERALL_PAGE_SAFETY) {
        endReason = "MAX_PAGES_SAFETY";
        status = "MAX_PAGES_SAFETY";
        shouldContinue = true;
        break;
      }

      const page = await client.getUserTimeline({
        userId: me.id,
        maxResults: 100,
        paginationToken,
        preferPrivateMetrics: true,
      });

      if (page.rateLimited) {
        endReason = "RATE_LIMIT";
        status = "RATE_LIMITED";
        shouldContinue = true;
        retryAfter = 60;
        error = page.error || "rate_limit";
        break;
      }
      if (page.status === 401 || page.status === 403) {
        endReason = "AUTH";
        status = "PAUSED";
        shouldContinue = false;
        error = page.error || "auth_failed";
        break;
      }
      if (page.error && !page.posts.length) {
        endReason = "ERROR";
        status = "FAILED_RETRYABLE";
        shouldContinue = true;
        error = page.error;
        break;
      }
      if (!page.posts.length) {
        endReason = "END_OF_AVAILABLE_HISTORY";
        paginationToken = undefined;
        phase = includeMentions ? "MENTIONS" : "COMPLETE";
        justEnteredMentions.value = includeMentions;
        break;
      }

      batchPages += 1;
      totalPages += 1;

      for (const p of page.posts) {
        batchPosts += 1;
        totalPosts += 1;
        if (p.createdAt) {
          if (!earliest || p.createdAt < earliest) earliest = p.createdAt;
          if (!latest || p.createdAt > latest) latest = p.createdAt;
        }
        try {
          const result = await persistXPostEvidence(supabase, {
            accountId,
            xUserId: me.id,
            handle: me.username,
            post: p,
            origin: "X_ACTUAL",
            actionType: classifyAction(p.referencedTweets),
            status: "PUBLISHED",
            collectionSource: "phase1a_batch",
            collectionRunId: runId,
            systemOriginClass: "UNKNOWN",
            requestMeta: {
              fieldsMode: page.fieldsMode,
              metricFieldEvidence: page.metricFieldEvidence,
            },
          });
          if (result.postStatus === "NEW") postsNew += 1;
          if (result.postStatus === "UPDATED") postsUpdated += 1;
          if (result.snapshotWritten) totalSnapshots += 1;
        } catch (pe) {
          console.error("persist post batch", p.id, pe);
        }
      }

      paginationToken = page.nextToken;
      await supabase
        .from("x_sync_runs")
        .update({
          pages_fetched: totalPages,
          posts_discovered: totalPosts,
          posts_new: (Number(run.posts_new) || 0) + postsNew,
          posts_updated: (Number(run.posts_updated) || 0) + postsUpdated,
          metric_snapshots_written: totalSnapshots,
          earliest_post_at: earliest,
          latest_post_at: latest,
          next_token: paginationToken || null,
          phase: "POSTS",
          run_status: "RUNNING",
          end_reason: null,
          metric_field_evidence: page.metricFieldEvidence || null,
        })
        .eq("id", runId);

      if (!page.nextToken) {
        endReason = "END_OF_AVAILABLE_HISTORY";
        phase = includeMentions ? "MENTIONS" : "COMPLETE";
        justEnteredMentions.value = includeMentions;
        paginationToken = undefined;
        break;
      }
    }

    if (!endReason && batchPages >= maxPagesPerBatch && paginationToken) {
      endReason = "BATCH_COMPLETE";
      shouldContinue = true;
    }
  }

  if (phase === "MENTIONS" && Date.now() - start < TIME_BUDGET_MS) {
    let mToken = justEnteredMentions.value
      ? undefined
      : typeof run.next_token === "string" && run.phase === "MENTIONS"
        ? (run.next_token as string)
        : paginationToken;

    let mBatchPages = 0;
    while (
      mBatchPages < maxPagesPerBatch &&
      Date.now() - start < TIME_BUDGET_MS
    ) {
      const page = await client.getMentions({
        userId: me.id,
        maxResults: 100,
        paginationToken: mToken,
      });

      if (page.rateLimited) {
        endReason = "RATE_LIMIT";
        status = "RATE_LIMITED";
        shouldContinue = true;
        retryAfter = 60;
        error = page.error || "rate_limit";
        paginationToken = mToken;
        break;
      }
      if (page.error && !page.posts.length) {
        if (page.status === 401 || page.status === 403) {
          status = "PAUSED";
          shouldContinue = false;
          endReason = "AUTH";
        } else {
          status = "FAILED_RETRYABLE";
          shouldContinue = true;
          endReason = "ERROR";
        }
        error = page.error || null;
        break;
      }
      if (!page.posts.length) {
        endReason = "END_OF_MENTIONS";
        phase = "COMPLETE";
        mToken = undefined;
        break;
      }

      mBatchPages += 1;
      batchPages += 1;
      totalPages += 1;

      for (const p of page.posts) {
        totalMentions += 1;
        batchPosts += 1;
        try {
          const result = await persistMentionEvidence(supabase, {
            accountId,
            creatorXUserId: me.id,
            mention: p,
            collectionSource: "phase1a_batch_mentions",
            collectionRunId: runId,
          });
          if (result.snapshotWritten) totalSnapshots += 1;
        } catch (e) {
          console.error("persist mention batch", p.id, e);
        }
      }

      mToken = page.nextToken;
      paginationToken = mToken;
      await supabase
        .from("x_sync_runs")
        .update({
          pages_fetched: totalPages,
          mentions_discovered: totalMentions,
          metric_snapshots_written: totalSnapshots,
          next_token: mToken || null,
          phase: "MENTIONS",
          run_status: "RUNNING",
        })
        .eq("id", runId);

      if (!page.nextToken) {
        endReason = "END_OF_MENTIONS";
        phase = "COMPLETE";
        break;
      }
    }

    if (phase === "MENTIONS" && paginationToken && !error) {
      endReason = endReason || "BATCH_COMPLETE";
      shouldContinue = true;
      status = "RUNNING";
    }
  }

  if (phase === "COMPLETE") {
    status = "COMPLETE";
    shouldContinue = false;
    endReason = endReason || "COMPLETE";
    paginationToken = undefined;
  }

  await supabase
    .from("x_sync_runs")
    .update({
      pages_fetched: totalPages,
      posts_discovered: totalPosts,
      mentions_discovered: totalMentions,
      metric_snapshots_written: totalSnapshots,
      earliest_post_at: earliest,
      latest_post_at: latest,
      next_token: paginationToken || null,
      phase,
      run_status: status,
      end_reason: endReason,
      status: status === "COMPLETE" ? "ok" : "running",
      completed_at: status === "COMPLETE" ? new Date().toISOString() : null,
      rate_limited: status === "RATE_LIMITED",
    })
    .eq("id", runId);

  await supabase.from("account_snapshots").upsert(
    {
      account_id: accountId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      followers_count: me.followersCount ?? null,
      following_count: me.followingCount ?? null,
      posts_count: me.tweetCount ?? null,
      sync_run_id: runId,
      captured_at: new Date().toISOString(),
    },
    { onConflict: "account_id,snapshot_date" }
  );

  await supabase
    .from("account_connections")
    .update({
      handle: me.username,
      x_user_id: me.id,
      followers_count: me.followersCount ?? null,
      following_count: me.followingCount ?? null,
      last_sync_status:
        status === "COMPLETE" ? "phase1a_complete" : "phase1a_batch",
      last_successful_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  const msg =
    status === "COMPLETE"
      ? `수집 완료. posts≈${totalPosts}, mentions≈${totalMentions}`
      : status === "RATE_LIMITED"
        ? "Rate limit — 잠시 후 자동 재개"
        : `배치 완료 (${batchPages}p) — 계속… phase=${phase}`;

  // Use includes() so TS does not narrow away valid RunStatus members
  const continueOk =
    shouldContinue && !STOP_STATUSES.includes(status as RunStatus);

  return {
    ok: !error || status === "RATE_LIMITED" || status === "FAILED_RETRYABLE",
    runId,
    status,
    phase,
    batchPagesFetched: batchPages,
    totalPagesFetched: totalPages,
    batchPostsProcessed: batchPosts,
    totalPostsCollected: totalPosts,
    totalMentionsCollected: totalMentions,
    metricSnapshotsWritten: totalSnapshots,
    nextTokenPresent: Boolean(paginationToken),
    earliestDate: earliest,
    latestDate: latest,
    endReason,
    shouldContinue: continueOk,
    retryAfterSeconds: retryAfter,
    error,
    messageKo: msg,
  };
}

export async function getPhase1ACollectStatus(): Promise<{
  active: boolean;
  run: Record<string, unknown> | null;
}> {
  const meta = await getXConnectionMeta();
  if (!meta?.connectionId && !meta?.xUserId) {
    return { active: false, run: null };
  }
  const supabase = await createClient();
  let accountId = meta.connectionId;
  if (!accountId && meta.xUserId) {
    const { data } = await supabase
      .from("account_connections")
      .select("id")
      .eq("x_user_id", meta.xUserId)
      .eq("platform", "x")
      .maybeSingle();
    accountId = data?.id;
  }
  if (!accountId) return { active: false, run: null };

  const { data: runs } = await supabase
    .from("x_sync_runs")
    .select(
      "id, run_status, phase, pages_fetched, posts_discovered, mentions_discovered, metric_snapshots_written, earliest_post_at, latest_post_at, next_token, end_reason, started_at, completed_at"
    )
    .eq("account_id", accountId)
    .eq("source", "phase1a_max_collect")
    .order("started_at", { ascending: false })
    .limit(1);

  const run = (runs?.[0] as Record<string, unknown>) || null;
  if (!run) return { active: false, run: null };
  const st = String(run.run_status || "");
  const active = !["COMPLETE", "CANCELLED", "FAILED_FATAL"].includes(st);
  return { active, run };
}
