import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseXAnalyticsExport, type DailyAccountPulse } from "@/lib/learning/parse-csv";
import { OPERATOR_REVENUE_START } from "@/lib/learning/operator-revenue-start";
import type { MetricOrigin, NormalizedPostMetrics } from "@/lib/learning/types";

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
    const texts: string[] = [];
    if (typeof body.csvText === "string" && body.csvText.trim()) texts.push(body.csvText);
    if (Array.isArray(body.csvTexts)) {
      for (const t of body.csvTexts) {
        if (typeof t === "string" && t.trim()) texts.push(t);
      }
    }
    if (texts.length === 0) {
      return NextResponse.json({ error: "csvText required" }, { status: 400 });
    }

    const origin = (["ai", "manual", "unknown"].includes(body.origin)
      ? body.origin
      : "unknown") as MetricOrigin;
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;
    const payoutUsdRaw = Number(body.payoutUsd);
    const payoutUsd =
      Number.isFinite(payoutUsdRaw) && payoutUsdRaw > 0
        ? payoutUsdRaw
        : OPERATOR_REVENUE_START.amountUsd;

    const rows: NormalizedPostMetrics[] = [];
    const kinds: string[] = [];
    let videoEstimatedRevenueSum = 0;
    const daily: DailyAccountPulse[] = [];
    try {
      for (const text of texts) {
        const parsed = parseXAnalyticsExport(text, origin);
        kinds.push(parsed.kind);
        rows.push(...parsed.posts);
        daily.push(...parsed.daily);
        videoEstimatedRevenueSum += parsed.videoEstimatedRevenueSum;
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: "CSV parse failed", detail: String(e?.message || e) },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No metric rows found in CSV" },
        { status: 400 }
      );
    }

    const { data: run, error: runErr } = await supabase
      .from("learning_runs")
      .insert({
        source: "x_analytics_csv",
        status: "imported",
        notes,
        raw_meta: {
          rowCount: rows.length,
          origin,
          adapter: "x_analytics_csv",
          primary: "x_analytics",
          kinds,
          payoutUsd,
          payoutPeriod: `${OPERATOR_REVENUE_START.periodFrom}..${OPERATOR_REVENUE_START.periodTo}`,
          nextPayout: OPERATOR_REVENUE_START.nextPayout,
          videoEstimatedRevenueSum,
          dailyDays: daily.length,
          dailyAccountPulse: daily.slice(0, 31),
          overviewNewFollows: daily.reduce((a, d) => a + d.newFollows, 0),
          contentNewFollows: rows.reduce((a, r) => a + r.followersGained, 0),
          revenueLayer: "account_payout_not_per_post",
        },
      })
      .select("id")
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        {
          error: "learning_runs insert failed — run migration?",
          detail: runErr?.message,
        },
        { status: 500 }
      );
    }

    const metricRows = rows.map((r) => ({
      learning_run_id: run.id,
      content_snippet: r.contentSnippet,
      published_at: r.publishedAt,
      followers_gained: r.followersGained,
      profile_visits: r.profileVisits,
      bookmarks: r.bookmarks,
      replies: r.replies,
      reposts: r.reposts,
      likes: r.likes,
      impressions: r.impressions,
      quotes: r.quotes,
      engagement_rate: r.engagementRate,
      origin: r.origin,
      raw: r.raw ?? null,
      is_success: false,
      post_id: r.postId,
      shares: r.shares,
      detail_expands: r.detailExpands,
      url_clicks: r.urlClicks,
      hashtag_clicks: r.hashtagClicks,
      permalink_clicks: r.permalinkClicks,
      engagements: r.engagements,
      revenue: r.revenue,
      features: r.features ?? null,
    }));

    let { error: mErr } = await supabase.from("post_metrics").insert(metricRows);

    if (mErr && /column|schema/i.test(mErr.message || "")) {
      const basic = metricRows.map((r) => ({
        learning_run_id: r.learning_run_id,
        content_snippet: r.content_snippet,
        published_at: r.published_at,
        followers_gained: r.followers_gained,
        profile_visits: r.profile_visits,
        bookmarks: r.bookmarks,
        replies: r.replies,
        reposts: r.reposts,
        likes: r.likes,
        impressions: r.impressions,
        quotes: r.quotes,
        engagement_rate: r.engagement_rate,
        origin: r.origin,
        raw: r.raw,
        is_success: false,
      }));
      const retry = await supabase.from("post_metrics").insert(basic);
      mErr = retry.error;
    }

    if (mErr) {
      return NextResponse.json(
        { error: "post_metrics insert failed", detail: mErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      learningRunId: run.id,
      imported: rows.length,
      kinds,
      payoutUsd,
      videoEstimatedRevenueSum,
      status: "imported",
      next: "POST /api/learning/analyze with learningRunId",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
