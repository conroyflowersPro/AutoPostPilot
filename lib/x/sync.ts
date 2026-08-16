/**
 * X Account Daily Sync — official API only.
 * Writes X_ACTUAL rows into account_activities; updates account_connections + snapshots.
 */

import { createClient } from "@/lib/supabase/server";
import { createXClient, XClientNotConfiguredError } from "@/lib/x/client";
import { persistXPostEvidence } from "@/lib/x/evidence";
import { classifyXPostOrigin, type ApOriginHint } from "@/lib/calendar/planner-inscribe";

export type SyncResult = {
  ok: boolean;
  status: "ok" | "failed" | "not_connected";
  itemsFetched: number;
  itemsCreated: number;
  itemsUpdated: number;
  error?: string;
  handle?: string;
};

function classifyAction(
  referenced?: { type: string; id: string }[]
): "ORIGINAL" | "QUOTE" | "REPOST" | "REPLY" {
  if (!referenced?.length) return "ORIGINAL";
  const types = referenced.map((r) => r.type);
  if (types.includes("retweeted")) return "REPOST";
  if (types.includes("quoted")) return "QUOTE";
  if (types.includes("replied_to")) return "REPLY";
  return "ORIGINAL";
}

export async function runXAccountSync(opts?: {
  source?: "manual" | "scheduled";
}): Promise<SyncResult> {
  const source = opts?.source || "manual";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: "not_connected",
      itemsFetched: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      error: "Not authenticated",
    };
  }

  const { data: conn } = await supabase
    .from("account_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", "x")
    .maybeSingle();

  if (!conn?.access_token || !conn.x_user_id) {
    return {
      ok: false,
      status: "not_connected",
      itemsFetched: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      error: "X not connected",
    };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("account_connections")
    .update({ last_sync_attempt_at: nowIso, updated_at: nowIso })
    .eq("id", conn.id);

  const { data: runRow } = await supabase
    .from("x_sync_runs")
    .insert({
      account_id: conn.id,
      status: "running",
      source,
    })
    .select("id")
    .single();

  const runId = runRow?.id as string | undefined;

  async function loadApOriginHints(): Promise<ApOriginHint[]> {
    const { data } = await supabase
      .from("SeungContent")
      .select("id, content, final_text, pipeline_id, fedica_post_id, strategy_json, schedule_provider")
      .in("status", ["scheduled", "published", "reviewed", "scheduling"])
      .order("created_at", { ascending: false })
      .limit(200);
    return (data || []) as ApOriginHint[];
  }

  try {
    const client = await createXClient();
    const me = await client.getMe();
    const apHints = await loadApOriginHints();

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let newestId: string | null = conn.last_seen_x_post_id || null;
    let paginationToken: string | undefined;

    for (let page = 0; page < 3; page++) {
      const { posts, nextToken } = await client.getUserTimeline({
        userId: me.id,
        sinceId: conn.last_seen_x_post_id || undefined,
        maxResults: 50,
        paginationToken,
      });

      fetched += posts.length;

      for (const p of posts) {
        const action = classifyAction(p.referencedTweets);
        const persisted = await persistXPostEvidence(supabase, {
          accountId: conn.id,
          xUserId: me.id,
          handle: me.username,
          post: p,
          origin: "X_ACTUAL",
          actionType: action,
          status: "PUBLISHED",
          collectionSource: source === "scheduled" ? "x_sync_scheduled" : "x_sync_manual",
          collectionRunId: runId || null,
          systemOriginClass: classifyXPostOrigin(p.id, p.text || "", apHints),
        });
        if (persisted.postStatus === "NEW") created += 1;
        else updated += 1;

        if (!newestId || BigInt(p.id) > BigInt(newestId)) {
          newestId = p.id;
        }
      }

      if (!nextToken || posts.length === 0) break;
      paginationToken = nextToken;
    }

    const today = nowIso.slice(0, 10);
    await supabase.from("account_snapshots").upsert(
      {
        account_id: conn.id,
        snapshot_date: today,
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
        followers_count: me.followersCount ?? null,
        following_count: me.followingCount ?? null,
        profile_image_url: me.profileImageUrl ?? null,
        last_seen_x_post_id: newestId || conn.last_seen_x_post_id,
        last_successful_sync_at: nowIso,
        last_sync_status: "ok",
        last_sync_error: null,
        updated_at: nowIso,
      })
      .eq("id", conn.id);

    if (runId) {
      await supabase
        .from("x_sync_runs")
        .update({
          status: "ok",
          completed_at: nowIso,
          items_fetched: fetched,
          items_created: created,
          items_updated: updated,
        })
        .eq("id", runId);
    }

    return {
      ok: true,
      status: "ok",
      itemsFetched: fetched,
      itemsCreated: created,
      itemsUpdated: updated,
      handle: me.username,
    };
  } catch (e) {
    const msg =
      e instanceof XClientNotConfiguredError
        ? e.message
        : e instanceof Error
          ? e.message
          : "sync_failed";

    await supabase
      .from("account_connections")
      .update({
        last_sync_status: "failed",
        last_sync_error: msg,
        updated_at: nowIso,
      })
      .eq("id", conn.id);

    if (runId) {
      await supabase
        .from("x_sync_runs")
        .update({
          status: "failed",
          completed_at: nowIso,
          error_message: msg,
        })
        .eq("id", runId);
    }

    return {
      ok: false,
      status: e instanceof XClientNotConfiguredError ? "not_connected" : "failed",
      itemsFetched: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      error: msg,
    };
  }
}
