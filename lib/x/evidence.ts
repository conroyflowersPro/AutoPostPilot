/**
 * Durable X evidence store.
 * Observed API data only — never AI interpretation.
 * Missing metric ≠ 0.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricBag, XTimelinePost, XMentionPost } from "@/lib/x/client";
import { mergeStoredOriginClass } from "@/lib/origin-class";

export type SystemOriginClass = "USER_DIRECT" | "AP_PIPELINE" | "SYSTEM_ASSISTED" | "MANUAL" | "UNKNOWN";

export type PersistPostInput = {
  accountId: string;
  xUserId: string;
  handle: string;
  post: XTimelinePost;
  origin: "X_ACTUAL" | "X_MENTION";
  actionType: string;
  status: string;
  collectionSource: string;
  collectionRunId?: string | null;
  systemOriginClass?: SystemOriginClass;
  requestMeta?: Record<string, unknown>;
};

export type PersistResult = {
  activityId: string;
  xPostId: string;
  postStatus: "NEW" | "EXISTING" | "UPDATED";
  snapshotWritten: boolean;
  snapshotSkippedIdentical: boolean;
};

function fingerprintMetrics(
  publicM: MetricBag | null | undefined,
  nonPublic: MetricBag | null | undefined,
  organic: MetricBag | null | undefined
): string {
  const payload = JSON.stringify({
    p: publicM ?? null,
    n: nonPublic ?? null,
    o: organic ?? null,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export async function persistXPostEvidence(
  supabase: SupabaseClient,
  input: PersistPostInput
): Promise<PersistResult> {
  const p = input.post;
  const nowIso = new Date().toISOString();
  const activityDate = (p.createdAt || nowIso).slice(0, 10);

  const meta = {
    public_metrics: p.publicMetrics ?? null,
    non_public_metrics: p.nonPublicMetrics ?? null,
    organic_metrics: p.organicMetrics ?? null,
    referenced_tweets: p.referencedTweets || [],
    conversation_id: p.conversationId || null,
    in_reply_to_user_id: p.inReplyToUserId || null,
    lang: p.lang || null,
    attachments: p.attachments || null,
    entities: p.entities || null,
    context_annotations: p.contextAnnotations || null,
    raw: p.raw || null,
    collection: input.collectionSource,
    latest_metrics_at: nowIso,
  };

  const baseRow = {
    account_id: input.accountId,
    activity_date: activityDate,
    origin: input.origin,
    action_type: input.actionType,
    status: input.status,
    x_post_id: p.id,
    text_body: p.text,
    source_post_url:
      input.origin === "X_ACTUAL"
        ? `https://x.com/${input.handle}/status/${p.id}`
        : null,
    published_at: p.createdAt || null,
    x_author_id: p.authorId || input.xUserId,
    conversation_id: p.conversationId || null,
    in_reply_to_user_id: p.inReplyToUserId || null,
    post_type: input.actionType,
    collection_source: input.collectionSource,
    system_origin_class: input.systemOriginClass || "UNKNOWN",
    last_refreshed_at: nowIso,
    meta,
  };

  const { data: existing } = await supabase
    .from("account_activities")
    .select("id, first_collected_at, meta, system_origin_class")
    .eq("account_id", input.accountId)
    .eq("x_post_id", p.id)
    .maybeSingle();

  if (existing?.id) {
    baseRow.system_origin_class = mergeStoredOriginClass(
      existing.system_origin_class,
      input.systemOriginClass || "UNKNOWN",
    );
  }

  let activityId: string;
  let postStatus: "NEW" | "EXISTING" | "UPDATED";

  if (existing?.id) {
    activityId = existing.id;
    postStatus = "UPDATED";
    await supabase
      .from("account_activities")
      .update({
        ...baseRow,
        first_collected_at: existing.first_collected_at || nowIso,
      })
      .eq("id", existing.id);
  } else {
    postStatus = "NEW";
    const { data: inserted, error } = await supabase
      .from("account_activities")
      .insert({
        ...baseRow,
        first_collected_at: nowIso,
      })
      .select("id")
      .maybeSingle();
    if (error || !inserted?.id) {
      const { data: again } = await supabase
        .from("account_activities")
        .select("id")
        .eq("account_id", input.accountId)
        .eq("x_post_id", p.id)
        .maybeSingle();
      if (!again?.id) {
        throw new Error(error?.message || "persist activity failed");
      }
      activityId = again.id;
      postStatus = "EXISTING";
    } else {
      activityId = inserted.id;
    }
  }

  const fp = fingerprintMetrics(
    p.publicMetrics,
    p.nonPublicMetrics,
    p.organicMetrics
  );

  const { data: sameFp } = await supabase
    .from("x_metric_snapshots")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("x_post_id", p.id)
    .eq("metrics_fingerprint", fp)
    .maybeSingle();

  let snapshotWritten = false;
  let snapshotSkippedIdentical = false;

  if (sameFp?.id) {
    snapshotSkippedIdentical = true;
  } else {
    const { error: snapErr } = await supabase.from("x_metric_snapshots").insert({
      account_id: input.accountId,
      x_post_id: p.id,
      activity_id: activityId,
      snapshot_at: nowIso,
      data_source: "x_api",
      collection_run_id: input.collectionRunId || null,
      public_metrics: p.publicMetrics ?? null,
      non_public_metrics: p.nonPublicMetrics ?? null,
      organic_metrics: p.organicMetrics ?? null,
      request_meta: input.requestMeta || {},
      metrics_fingerprint: fp,
    });
    if (!snapErr) snapshotWritten = true;
  }

  return {
    activityId,
    xPostId: p.id,
    postStatus,
    snapshotWritten,
    snapshotSkippedIdentical,
  };
}

export async function persistMentionEvidence(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    creatorXUserId: string;
    mention: XMentionPost;
    collectionSource: string;
    collectionRunId?: string | null;
    requestMeta?: Record<string, unknown>;
  }
): Promise<PersistResult> {
  return persistXPostEvidence(supabase, {
    accountId: input.accountId,
    xUserId: input.mention.authorId || "unknown",
    handle: "unknown",
    post: input.mention,
    origin: "X_MENTION",
    actionType: "MENTION",
    status: "RECEIVED",
    collectionSource: input.collectionSource,
    collectionRunId: input.collectionRunId,
    systemOriginClass: "UNKNOWN",
    requestMeta: input.requestMeta,
  });
}

export async function coverageFromStoredEvidence(
  supabase: SupabaseClient,
  accountId: string
): Promise<{
  posts: { total: number; earliest: string | null; latest: string | null };
  mentions: { total: number; earliest: string | null; latest: string | null };
  snapshots: { total: number; earliest: string | null; latest: string | null };
}> {
  const { data: posts } = await supabase
    .from("account_activities")
    .select("published_at, origin")
    .eq("account_id", accountId)
    .eq("origin", "X_ACTUAL")
    .order("published_at", { ascending: true });

  const { data: mentions } = await supabase
    .from("account_activities")
    .select("published_at")
    .eq("account_id", accountId)
    .eq("origin", "X_MENTION")
    .order("published_at", { ascending: true });

  const { data: snaps } = await supabase
    .from("x_metric_snapshots")
    .select("snapshot_at")
    .eq("account_id", accountId)
    .order("snapshot_at", { ascending: true });

  const postDates = (posts || [])
    .map((r) => r.published_at as string)
    .filter(Boolean);
  const mentionDates = (mentions || [])
    .map((r) => r.published_at as string)
    .filter(Boolean);
  const snapDates = (snaps || [])
    .map((r) => r.snapshot_at as string)
    .filter(Boolean);

  return {
    posts: {
      total: posts?.length || 0,
      earliest: postDates[0] || null,
      latest: postDates[postDates.length - 1] || null,
    },
    mentions: {
      total: mentions?.length || 0,
      earliest: mentionDates[0] || null,
      latest: mentionDates[mentionDates.length - 1] || null,
    },
    snapshots: {
      total: snaps?.length || 0,
      earliest: snapDates[0] || null,
      latest: snapDates[snapDates.length - 1] || null,
    },
  };
}
