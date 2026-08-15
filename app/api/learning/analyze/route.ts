import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  scoreAll,
  buildPlannerMemory,
  buildCreatorDnaHint,
  buildAudienceDnaHint,
  buildPerformanceDna,
  buildRevenueDna,
} from "@/lib/learning/score";
import { extractFeatures } from "@/lib/learning/features";
import type { NormalizedPostMetrics, MetricOrigin } from "@/lib/learning/types";

export const maxDuration = 26;

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
    const learningRunId =
      typeof body.learningRunId === "string" ? body.learningRunId : "";
    if (!learningRunId) {
      return NextResponse.json(
        { error: "learningRunId required" },
        { status: 400 }
      );
    }

    const { data: metrics, error: mErr } = await supabase
      .from("post_metrics")
      .select("*")
      .eq("learning_run_id", learningRunId);

    if (mErr) {
      return NextResponse.json(
        { error: "fetch metrics failed", detail: mErr.message },
        { status: 500 }
      );
    }
    if (!metrics?.length) {
      return NextResponse.json(
        { error: "No metrics for this run" },
        { status: 404 }
      );
    }

    const normalized: NormalizedPostMetrics[] = metrics.map((row: any) => {
      const snippet = String(row.content_snippet || "");
      const features =
        row.features && typeof row.features === "object"
          ? row.features
          : extractFeatures(snippet);
      return {
        postId: row.post_id ? String(row.post_id) : null,
        contentSnippet: snippet,
        publishedAt: row.published_at ? String(row.published_at) : null,
        followersGained: Number(row.followers_gained) || 0,
        profileVisits: Number(row.profile_visits) || 0,
        bookmarks: Number(row.bookmarks) || 0,
        replies: Number(row.replies) || 0,
        reposts: Number(row.reposts) || 0,
        likes: Number(row.likes) || 0,
        impressions: Number(row.impressions) || 0,
        quotes: Number(row.quotes) || 0,
        shares: Number(row.shares) || 0,
        detailExpands: Number(row.detail_expands) || 0,
        urlClicks: Number(row.url_clicks) || 0,
        hashtagClicks: Number(row.hashtag_clicks) || 0,
        permalinkClicks: Number(row.permalink_clicks) || 0,
        engagements: Number(row.engagements) || 0,
        revenue: Number(row.revenue) || 0,
        engagementRate:
          row.engagement_rate != null ? Number(row.engagement_rate) : null,
        origin: (row.origin || "unknown") as MetricOrigin,
        features,
      };
    });

    const scored = scoreAll(normalized);
    const bySnippet = new Map(
      scored.map((s) => [s.contentSnippet.slice(0, 200), s])
    );

    for (const row of metrics) {
      const key = String(row.content_snippet || "").slice(0, 200);
      const s = bySnippet.get(key);
      if (!s) continue;
      await supabase
        .from("post_metrics")
        .update({
          weighted_score: s.weightedScore,
          is_success: s.isSuccess,
          features: s.features ?? null,
        })
        .eq("id", row.id);
    }

    const memory = buildPlannerMemory(scored);
    const creatorDna = buildCreatorDnaHint(scored);
    const audienceDna = buildAudienceDnaHint(scored);
    const performanceDna = buildPerformanceDna(scored);
    const revenueDna = buildRevenueDna(scored);

    const { count: memCount } = await supabase
      .from("planner_memory")
      .select("id", { count: "exact", head: true });
    const nextVer = (memCount || 0) + 1;

    const { error: memErr } = await supabase.from("planner_memory").insert({
      version: nextVer,
      patterns: memory.patterns,
      summary_ko: memory.summaryKo,
      learning_run_id: learningRunId,
    });
    if (memErr) {
      return NextResponse.json(
        { error: "planner_memory insert failed", detail: memErr.message },
        { status: 500 }
      );
    }

    await supabase.from("creator_dna").insert({
      version: nextVer,
      data: creatorDna,
      summary_ko: creatorDna.summaryKo,
      learning_run_id: learningRunId,
    });

    await supabase.from("audience_dna").insert({
      version: nextVer,
      data: audienceDna,
      summary_ko: audienceDna.summaryKo,
      learning_run_id: learningRunId,
    });

    try {
      await supabase.from("performance_dna").insert({
        version: nextVer,
        data: performanceDna,
        summary_ko: performanceDna.summaryKo,
        learning_run_id: learningRunId,
      });
    } catch {
      /* optional */
    }
    try {
      await supabase.from("revenue_dna").insert({
        version: nextVer,
        data: revenueDna,
        summary_ko: revenueDna.summaryKo,
        learning_run_id: learningRunId,
      });
    } catch {
      /* optional */
    }

    await supabase
      .from("learning_runs")
      .update({
        status: "analyzed",
        notes: memory.summaryKo,
        raw_meta: {
          successCount: memory.successCount,
          analyzedCount: memory.analyzedCount,
          performanceSummary: performanceDna.summaryKo,
          revenueSummary: revenueDna.summaryKo,
        },
      })
      .eq("id", learningRunId);

    return NextResponse.json({
      success: true,
      learningRunId,
      version: nextVer,
      memory,
      creatorDna: { summaryKo: creatorDna.summaryKo },
      audienceDna: { summaryKo: audienceDna.summaryKo },
      performanceDna: {
        summaryKo: performanceDna.summaryKo,
        topicWins: performanceDna.topicWins,
        lengthWins: performanceDna.lengthWins,
        whyPatterns: performanceDna.whyPatterns.slice(0, 5),
      },
      revenueDna: { summaryKo: revenueDna.summaryKo },
      plannerMustRead: true,
      learningCycle:
        "Publish → Analytics Import → Feature Extraction → Performance/Revenue Analysis → Learning → DNA/Memory Update → next 3-day Planner reads → new Planning",
      status: "analyzed",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
