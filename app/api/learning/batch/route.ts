import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runFourteenDayBatch } from "@/lib/learning/batch-14d";
import type { AudienceSnapshot } from "@/lib/learning/audience-snapshot";
import type { PerformancePattern } from "@/lib/learning/performance-patterns";

export const maxDuration = 26;

/** POST /api/learning/batch — explicit user action; no background paid AI */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    let priorAudienceSnapshots: AudienceSnapshot[] = Array.isArray(
      body.priorAudienceSnapshots
    )
      ? body.priorAudienceSnapshots
      : [];
    let priorPerformancePatterns: PerformancePattern[] = Array.isArray(
      body.priorPerformancePatterns
    )
      ? body.priorPerformancePatterns
      : [];

    try {
      const { data: snaps } = await supabase
        .from("audience_snapshots")
        .select("data")
        .order("imported_at", { ascending: true })
        .limit(24);
      if (snaps?.length && priorAudienceSnapshots.length === 0) {
        priorAudienceSnapshots = snaps.map((r: any) => r.data).filter(Boolean);
      }
    } catch {
      /* table may not exist yet */
    }
    try {
      const { data: pats } = await supabase
        .from("performance_patterns")
        .select("data")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (pats?.[0]?.data && priorPerformancePatterns.length === 0) {
        priorPerformancePatterns = Array.isArray(pats[0].data) ? pats[0].data : [];
      }
    } catch {
      /* optional */
    }

    const result = runFourteenDayBatch({
      batch_id: body.batch_id,
      period_start: body.period_start,
      period_end: body.period_end,
      publishedMetrics: body.publishedMetrics,
      audience: body.audience,
      priorAudienceSnapshots,
      priorPerformancePatterns,
      seedBaselineIfEmpty: body.seedBaselineIfEmpty !== false,
      file_hashes: body.file_hashes,
      usePaidAI: false,
    });

    if (body.persist !== false) {
      try {
        if (result.audience_snapshot) {
          await supabase.from("audience_snapshots").insert({
            snapshot_id: result.audience_snapshot.snapshot_id,
            batch_id: result.batch.batch_id,
            imported_at: result.audience_snapshot.imported_at,
            period_start: result.audience_snapshot.period_start,
            period_end: result.audience_snapshot.period_end,
            data: result.audience_snapshot,
          });
        }
      } catch {
        /* migration may be pending */
      }
      try {
        await supabase.from("performance_patterns").insert({
          batch_id: result.batch.batch_id,
          updated_at: new Date().toISOString(),
          data: result.performance_patterns,
          summary_ko: result.report.planner,
        });
      } catch {
        /* optional */
      }
      try {
        await supabase.from("learning_batches").insert({
          batch_id: result.batch.batch_id,
          period_start: result.batch.period_start,
          period_end: result.batch.period_end,
          imported_at: result.batch.imported_at,
          source: result.batch.source,
          file_hashes: result.batch.file_hashes,
          report: result.report,
          status: result.batch.status,
        });
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: result.batch.batch_id,
      report: result.report,
      audience_planner_block: result.audience_planner_block,
      performance_planner_block: result.performance_planner_block,
      audience_intelligence: result.audience_intelligence,
      performance_patterns_summary: {
        total: result.performance_patterns.length,
        by_status: result.report.performance,
      },
      paid_ai_used: false,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
