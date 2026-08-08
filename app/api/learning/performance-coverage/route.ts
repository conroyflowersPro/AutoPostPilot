/**
 * GET /api/learning/performance-coverage
 * Read-only Performance Evidence Coverage diagnostic.
 * No INSERT/UPDATE/DELETE. No DNA updates. No learning writes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseEvidenceAdapter } from "@/lib/performance-evidence/adapters/supabase-adapter";
import { runPerformanceDiagnostic } from "@/lib/performance-evidence/analyzers/run-diagnostic";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: conn, error: connErr } = await supabase
      .from("account_connections")
      .select("id, handle, platform")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    if (connErr) {
      return NextResponse.json(
        { error: `account_connections: ${connErr.message}` },
        { status: 500 }
      );
    }
    if (!conn?.id) {
      return NextResponse.json(
        { error: "No X account_connection found (platform=x)" },
        { status: 404 }
      );
    }

    const accountId = conn.id;

    // --- DB inventory (no date filter; maximum available period) ---
    const { count: activitiesCount, error: cntErr } = await supabase
      .from("account_activities")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId);

    const { data: earliestRow } = await supabase
      .from("account_activities")
      .select("published_at")
      .eq("account_id", accountId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: latestRow } = await supabase
      .from("account_activities")
      .select("published_at")
      .eq("account_id", accountId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: xActualCount } = await supabase
      .from("account_activities")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("origin", "X_ACTUAL");

    const { count: xMentionCount } = await supabase
      .from("account_activities")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("origin", "X_MENTION");

    const { count: snapshotCount } = await supabase
      .from("x_metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId);

    const { data: snapEarliest } = await supabase
      .from("x_metric_snapshots")
      .select("snapshot_at")
      .eq("account_id", accountId)
      .order("snapshot_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: snapLatest } = await supabase
      .from("x_metric_snapshots")
      .select("snapshot_at")
      .eq("account_id", accountId)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: syncRuns } = await supabase
      .from("x_sync_runs")
      .select(
        "id, source, run_status, phase, pages_fetched, posts_discovered, posts_new, posts_updated, mentions_discovered, earliest_post_at, latest_post_at, end_reason, started_at, finished_at"
      )
      .eq("account_id", accountId)
      .order("started_at", { ascending: false })
      .limit(5);

    const dbInventory = {
      accountId,
      activitiesExactCount: activitiesCount ?? null,
      activitiesCountError: cntErr?.message ?? null,
      publishedAtMin: earliestRow?.published_at ?? null,
      publishedAtMax: latestRow?.published_at ?? null,
      originXActual: xActualCount ?? null,
      originXMention: xMentionCount ?? null,
      snapshotsExactCount: snapshotCount ?? null,
      snapshotAtMin: snapEarliest?.snapshot_at ?? null,
      snapshotAtMax: snapLatest?.snapshot_at ?? null,
      recentSyncRuns: syncRuns ?? [],
      note: "No date filter applied. Counts are maximum rows present for this account_id.",
    };

    const adapter = new SupabaseEvidenceAdapter(supabase, accountId);
    const report = await runPerformanceDiagnostic(adapter, {
      accountId,
      pageSize: 500,
    });

    return NextResponse.json({
      version: "performance-evidence-v1.1",
      handle: conn.handle,
      dbInventory,
      report,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
