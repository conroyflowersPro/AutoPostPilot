import { NextRequest, NextResponse } from "next/server";
import {
  analyzePortfolio,
  creatorIntentPresent,
  enforcePortfolioDiversity,
} from "@/lib/planning/portfolio";
import {
  buildPlannerSharedContext,
  sharedContextPlanInstructions,
} from "@/lib/context/planner-attach";
import {
  buildCreatorDnaPlannerBlock,
} from "@/lib/intelligence/creator-dna-runtime";
import {
  buildPerformanceDnaPlannerBlock,
} from "@/lib/intelligence/performance-dna-runtime";

const MODEL = "grok-4.6";

const SYSTEM = `You are the weekly account-operating strategist for @Seung4680 — an AI account manager, not a post generator.

MISSION: long-term account growth + authentic creator voice. Impressions alone must never dominate.

AUTHENTICITY OVER ENGAGEMENT (HARD): never invent firsthand experiences; Level1/2 only.
Creator Intent must shape the week. Audience/Fedica keywords are signals — never copy as primaryTopic.
Posting time is owned by Fedica only.
WEEKLY POSTS = ORIGINAL only. Do not learn from drafts.
FORBIDDEN: 주가/등락/TSLA chart · invented experiences · Fedica keywords as primaryTopic.
Output JSON only: generationDays, audienceRead, days[], rationale.
Aim ~5 ORIGINAL slots/day max; keep postStrategy compact.`;

export async function handleWeeklyPlanPost(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = String(
      body.topic || body.creatorIntent || body.keywords || body.mergedKeywords || ""
    ).trim();
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);

    const audienceHint =
      body.audienceHint ||
      body.audienceDna ||
      [
        Array.isArray(body.interests) ? `interests: ${body.interests.slice(0, 12).join(", ")}` : "",
        Array.isArray(body.topicCategories)
          ? `categories: ${body.topicCategories.slice(0, 10).join(", ")}`
          : "",
        body.sentiment ? `sentiment: ${body.sentiment}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

    const publishedTopics: string[] = Array.isArray(body.publishedTopics)
      ? body.publishedTopics.map(String).filter(Boolean).slice(0, 12)
      : Array.isArray(body.recentTopics)
        ? body.recentTopics.map(String).filter(Boolean).slice(0, 12)
        : [];
    const scheduledTopics: string[] = Array.isArray(body.scheduledTopics)
      ? body.scheduledTopics.map(String).filter(Boolean).slice(0, 10)
      : [];

    const creatorSnap = buildCreatorDnaPlannerBlock();
    const perfSnap = buildPerformanceDnaPlannerBlock();
    const dna_sources = {
      creator: "runtime_snapshot" as const,
      performance: "baseline_candidates" as const,
    };

    const topicSignalBlock = [
      publishedTopics.length
        ? `PUBLISHED:\n${publishedTopics.map((t, i) => `${i + 1}. ${t.slice(0, 60)}`).join("\n")}`
        : "PUBLISHED: (none)",
      scheduledTopics.length
        ? `SCHEDULED (dup only):\n${scheduledTopics.map((t, i) => `${i + 1}. ${t.slice(0, 60)}`).join("\n")}`
        : "SCHEDULED: (none)",
    ].join("\n\n");

    const sharedContext = buildPlannerSharedContext(body, topic);
    const userPrompt = `Creator Intent: ${topic || "(없음)"}

Creator DNA:\n${creatorSnap.block}

Audience signals: ${
      typeof audienceHint === "string"
        ? audienceHint.slice(0, 800)
        : JSON.stringify(audienceHint).slice(0, 800)
    }

Performance DNA (CANDIDATE only):\n${perfSnap.block}

${topicSignalBlock}

${sharedContextPlanInstructions(sharedContext)}

JSON only. Each slot: primaryTopic, angle, contentType, postStrategy (compact), actionType=ORIGINAL.
Expand beyond FSD/Cybertruck monoculture when possible.`;

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "XAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);

    let rawText = "";
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.55,
          max_tokens: 3000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          {
            success: false,
            error: `xAI ${res.status}`,
            detail: errText.slice(0, 300),
            fallback: true,
            days: [],
            dna_sources,
          },
          { status: 502 }
        );
      }
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }

    let parsed: any = null;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    let days: any[] = Array.isArray(parsed?.days) ? parsed.days : [];
    if (days.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "주간 계획 결과가 비어 있습니다.",
          fallback: true,
          days: [],
          generationDays: 0,
          dna_sources,
        },
        { status: 503 }
      );
    }

    for (let i = 0; i < days.length; i++) {
      let posts = Array.isArray(days[i]?.posts) ? days[i].posts : [];
      if (posts.length > 6) posts = posts.slice(0, 6);

      posts = posts.map((p: any, pi: number) => {
        const ps = p.postStrategy && typeof p.postStrategy === "object" ? p.postStrategy : {};
        return {
          slotId: String(p.slotId || `D${i + 1}P${pi + 1}`),
          primaryTopic: String(p.primaryTopic || "관찰"),
          subtopic: p.subtopic ? String(p.subtopic).slice(0, 80) : undefined,
          angle: String(p.angle || ""),
          contentType: String(p.contentType || "observation"),
          allowedContext: Array.isArray(p.allowedContext)
            ? p.allowedContext.map(String).slice(0, 2)
            : [],
          forbiddenTopics: Array.isArray(p.forbiddenTopics)
            ? p.forbiddenTopics.map(String)
            : ["주가", "등락"],
          targetLength: ["short", "medium", "long"].includes(p.targetLength)
            ? p.targetLength
            : "medium",
          actionType: "ORIGINAL" as const,
          expansionValue: ["low", "medium", "high"].includes(String(p.expansionValue))
            ? String(p.expansionValue)
            : "medium",
          creatorIntentAligned: Boolean(p.creatorIntentAligned ?? true),
          postStrategy: {
            strategicAngle: String(ps.strategicAngle || p.angle || "observation-first").slice(0, 120),
            hookStyle: String(ps.hookStyle || "direct_observation").slice(0, 80),
            writingApproach: String(ps.writingApproach || "observation"),
            experienceUsage: String(ps.experienceUsage || "none"),
            opinionStrength: String(ps.opinionStrength || "low"),
            observationLevel: String(ps.observationLevel || "medium"),
            technicalDepth: String(ps.technicalDepth || "low"),
            emotionalLevel: String(ps.emotionalLevel || "low"),
            predictionLevel: String(ps.predictionLevel || "none"),
            questionUsage: Boolean(ps.questionUsage),
            ctaUsage: Boolean(ps.ctaUsage),
            targetGrowthObjective: String(ps.targetGrowthObjective || "balanced"),
            mediaUsefulness: ["optional", "helpful", "essential"].includes(String(ps.mediaUsefulness))
              ? String(ps.mediaUsefulness)
              : "optional",
            hypothesisNote: String(ps.hypothesisNote || "Hypothesis only — validate after publish.").slice(0, 160),
          },
        };
      });

      days[i] = {
        dayOffset: typeof days[i].dayOffset === "number" ? days[i].dayOffset : i,
        posts,
      };
    }

    days = days.filter((d) => Array.isArray(d.posts) && d.posts.length > 0);
    if (days.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "주간 계획 슬롯이 비어 있습니다.",
          fallback: true,
          days: [],
          dna_sources,
        },
        { status: 503 }
      );
    }

    const diversity = enforcePortfolioDiversity(days, topic || "");
    days = diversity.days;

    const allTopics = days.flatMap((d: any) =>
      (d.posts || []).map((p: any) => String(p.primaryTopic || ""))
    );
    const allAngles = days.flatMap((d: any) =>
      (d.posts || []).map((p: any) => String(p.angle || ""))
    );
    const portfolioStats = analyzePortfolio(allTopics);
    const intentOk = creatorIntentPresent(topic, allTopics, allAngles);
    const audienceRead = {
      ...(parsed?.audienceRead || {}),
      portfolio: {
        ...(parsed?.audienceRead?.portfolio || {}),
        diversityNotes: diversity.note || portfolioStats.noteKo,
        riskOfNarrowing:
          parsed?.audienceRead?.portfolio?.riskOfNarrowing || portfolioStats.narrowingRisk,
        creatorIntentReflection: topic
          ? intentOk
            ? "Creator Intent 반영"
            : "Creator Intent 약함"
          : "Creator Intent 없음",
      },
      portfolioStats,
      creatorIntentAligned: intentOk,
      diversityGuardApplied: diversity.changed,
    };

    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: daysCount,
      days,
      rationale: parsed?.rationale || null,
      audienceRead,
      totalPlanned: days.reduce((s: number, d: any) => s + d.posts.length, 0),
      sharedCurrentContext: sharedContext,
      dna_sources,
      fallback: false,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        success: false,
        error: "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
        fallback: true,
        generationDays: 0,
        days: [],
        detail:
          err?.name === "AbortError"
            ? "timeout"
            : String(err?.message || err).slice(0, 120),
      },
      { status: 503 }
    );
  }
}
