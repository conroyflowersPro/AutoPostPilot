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

const MODEL = "grok-4.5";

const SYSTEM = `You are the weekly account-operating strategist for @Seung4680 — an AI account manager, not a post generator.

MISSION
Maximize long-term account growth while preserving authentic creator voice.
Every planning decision must answer: "Will this help grow this account over the next several months?"
NOT: "Can I generate another good-looking post?"
Impressions alone must never dominate. Prefer follower quality, profile curiosity, bookmarks, meaningful replies, and durable relevance.

THREE-STAGE LOOP (always)
1) WHAT should this Creator talk about? → Topic selection (this planner)
2) HOW should this Creator post it strategically on X? → Post Strategy (per slot, HYPOTHESIS)
3) DID that strategy work? → only real published X metrics later (Performance DNA). Never treat AI strategy choice as validated knowledge.

AUTHENTICITY OVER ENGAGEMENT (HARD)
Planner prioritizes Creator Authenticity over viral hooks.
Never plan slots that require invented personal interventions, fake tests, or unsupported first-person drama.
Angles must be writable as observation or known opinion without Level-3 inference.
High impressions from embellished/inauthentic patterns must NOT become planning targets.
Do not learn creator behavior from AI-generated drafts — only from validated real performance of authentic posts.

CREATOR DNA ROLE (critical reframe)
Creator DNA is NOT a fence that says "only talk about these topics forever."
Creator DNA answers: "Once a topic is selected, how can THIS creator see it and what evidence can they use?"
Do NOT collapse every week into FSD + Cybertruck only because those have the richest evidence.
Identity preservation ≠ topic monoculture.

CREATOR INTENT SIGNAL (HARD)
Keywords or themes the Creator types for this planning cycle are CREATOR INTENT — not optional flavor text and not writing keywords to dump into posts.
Interpret Creator Intent together with Audience DNA, Performance DNA, X context, long-term strategy, and diversity.
Creator Intent must visibly shape the week (topics and/or angles and/or expansion moves). It must not silently disappear.
Never copy raw intent keywords into primaryTopic as spam; translate into creator-framed themes.

WEEKLY PLAN = EDITORIAL PORTFOLIO
Evaluate the full 7-day plan as one portfolio.
Ask: "If someone follows this account for the whole week, what identity emerges?"
Preserve core identity while deliberately expanding surface area.

WEEKLY POSTS ARE ORIGINAL POSTS ONLY
Weekly Planner outputs ORIGINAL posts only (actionType=ORIGINAL).
Quote/Repost/Skip belong to Wild Card action selection — not this planner.

POST STRATEGY (between topic and writing — required per slot)
For each slot, after choosing topic+angle, choose a Post Strategy HYPOTHESIS.
Do NOT force every post to have strong hook + question + CTA + personal story.

SUCCESS SIGNAL PRIORITY
Followers gained > Profile visits > Revenue > Bookmarks > Replies > Reposts > Quotes > Likes > Impressions

INTELLIGENCE SEPARATION
- Creator DNA = how topics are owned/written (identity). Independent of Performance DNA.
- Audience DNA = which themes score this week.
- Performance DNA = validated published patterns only.

FORBIDDEN
- 주가/등락/매매/TSLA chart
- Invented experiences
- Fedica keywords as primaryTopic
- Learning from drafts
- Treating Post Strategy as proven fact

Output JSON only with generationDays, audienceRead, days[], rationale.`;

export async function handleWeeklyPlanPost(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic || body.creatorIntent || "").trim();
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);
    const audienceHint = body.audienceHint || body.audienceDna || "";
    const performanceHint = body.performanceHint || body.performanceDna || "";
    const recentTopics = Array.isArray(body.recentTopics)
      ? body.recentTopics.map(String).slice(0, 40)
      : [];

    const sharedContext = buildPlannerSharedContext(body, topic);
    const userPrompt = `Creator Intent (must shape this week): ${topic || "(없음)"}
Audience DNA / signals: ${typeof audienceHint === "string" ? audienceHint.slice(0, 1200) : JSON.stringify(audienceHint).slice(0, 1200)}
Performance DNA (validated only): ${typeof performanceHint === "string" ? performanceHint.slice(0, 1200) : JSON.stringify(performanceHint).slice(0, 1200)}
Recent topics (dedupe, not learning): ${recentTopics.join(", ")}

${sharedContextPlanInstructions(sharedContext)}

JSON only. Every slot needs postStrategy + actionType=ORIGINAL.
If portfolio risks narrowing into FSD/Cybertruck only, expand before final output.`;

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "XAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 24000);

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
          max_tokens: 4500,
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
          { success: false, error: `xAI ${res.status}`, detail: errText.slice(0, 300) },
          { status: 502 }
        );
      }
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      clearTimeout(timeout);
      if (e?.name === "AbortError") throw e;
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
      days = Array.from({ length: daysCount }, (_, i) => ({ dayOffset: i, posts: [] }));
    }

    for (let i = 0; i < days.length; i++) {
      let posts = Array.isArray(days[i]?.posts) ? days[i].posts : [];
      if (posts.length < 5) {
        const domainFallbacks = [
          { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" },
          { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" },
          { primaryTopic: "LAFC / 축구 일상", angle: "경기장·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" },
          { primaryTopic: "소유 팁", angle: "실소유 경험에서 나온 실용 메모", contentType: "observation", targetLength: "short" },
          { primaryTopic: "앱·업무 운영", angle: "개발·반복 테스트에서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" },
        ];
        while (posts.length < 5) {
          const idx = posts.length + 1;
          const fb = domainFallbacks[(i * 3 + posts.length) % domainFallbacks.length];
          posts.push({
            slotId: `D${i + 1}P${idx}`,
            primaryTopic: fb.primaryTopic,
            angle: fb.angle,
            contentType: fb.contentType,
            allowedContext: [],
            forbiddenTopics: ["주가", "등락", "매매"],
            targetLength: fb.targetLength,
          });
        }
      }
      if (posts.length > 8) posts = posts.slice(0, 8);

      posts = posts.map((p: any, pi: number) => {
        const ps = p.postStrategy && typeof p.postStrategy === "object" ? p.postStrategy : {};
        return {
          slotId: String(p.slotId || `D${i + 1}P${pi + 1}`),
          primaryTopic: String(p.primaryTopic || "관찰"),
          subtopic: p.subtopic ? String(p.subtopic).slice(0, 80) : undefined,
          angle: String(p.angle || ""),
          contentType: String(p.contentType || "observation"),
          allowedContext: Array.isArray(p.allowedContext) ? p.allowedContext.map(String).slice(0, 2) : [],
          forbiddenTopics: Array.isArray(p.forbiddenTopics) ? p.forbiddenTopics.map(String) : ["주가", "등락"],
          targetLength: ["short", "medium", "long"].includes(p.targetLength) ? p.targetLength : "medium",
          actionType: "ORIGINAL" as const,
          expansionValue: ["low", "medium", "high"].includes(String(p.expansionValue)) ? String(p.expansionValue) : "medium",
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
            mediaUsefulness: ["optional", "helpful", "essential"].includes(String(ps.mediaUsefulness)) ? String(ps.mediaUsefulness) : "optional",
            hypothesisNote: String(ps.hypothesisNote || "Hypothesis only — validate after publish.").slice(0, 200),
          },
        };
      });

      days[i] = { dayOffset: typeof days[i].dayOffset === "number" ? days[i].dayOffset : i, posts };
    }

    const diversity = enforcePortfolioDiversity(days, topic || "");
    days = diversity.days;

    const allTopics = days.flatMap((d: any) => (d.posts || []).map((p: any) => String(p.primaryTopic || "")));
    const allAngles = days.flatMap((d: any) => (d.posts || []).map((p: any) => String(p.angle || "")));
    const portfolioStats = analyzePortfolio(allTopics);
    const intentOk = creatorIntentPresent(topic, allTopics, allAngles);
    const audienceRead = {
      ...(parsed?.audienceRead || {}),
      portfolio: {
        ...(parsed?.audienceRead?.portfolio || {}),
        identityStatement: parsed?.audienceRead?.portfolio?.identityStatement || "주간 포트폴리오 자동 점검",
        diversityNotes: diversity.note || portfolioStats.noteKo,
        riskOfNarrowing: parsed?.audienceRead?.portfolio?.riskOfNarrowing || portfolioStats.narrowingRisk,
        creatorIntentReflection:
          parsed?.audienceRead?.portfolio?.creatorIntentReflection ||
          (topic ? (intentOk ? "Creator Intent 신호가 주제/앵글에 반영됨" : "Creator Intent 입력됨 — 반영 약함") : "Creator Intent 입력 없음"),
        expansionMoves: [
          ...(parsed?.audienceRead?.portfolio?.expansionMoves || []),
          ...(diversity.changed ? ["서버 다양성 가드레일 적용"] : []),
        ],
      },
      creatorIntent: parsed?.audienceRead?.creatorIntent || (topic ? String(topic).slice(0, 200) : null),
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
    });
  } catch (err: any) {
    console.error(err);
    const domainSlots = [
      { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" as const },
      { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" as const },
      { primaryTopic: "LAFC / 축구 일상", angle: "경기장·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" as const },
      { primaryTopic: "소유 팁 / 실사용 메모", angle: "장기 소유하면서 반복적으로 느낀 실용 디테일", contentType: "observation", targetLength: "short" as const },
      { primaryTopic: "앱·업무 / Grok 관찰", angle: "실제 사용·테스트하면서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" as const },
    ];
    let fallbackDays = Array.from({ length: 7 }, (_, i) => ({
      dayOffset: i,
      posts: domainSlots.map((s, n) => ({
        slotId: `D${i + 1}P${n + 1}`,
        primaryTopic: s.primaryTopic,
        angle: s.angle,
        contentType: s.contentType,
        allowedContext: [],
        forbiddenTopics: ["주가", "등락", "매매"],
        targetLength: s.targetLength,
        actionType: "ORIGINAL" as const,
        expansionValue: n < 2 ? "medium" : "high",
        creatorIntentAligned: true,
        postStrategy: {
          strategicAngle: "observation-first",
          hookStyle: "direct_observation",
          writingApproach: "observation",
          experienceUsage: "low",
          opinionStrength: "low",
          observationLevel: "medium",
          technicalDepth: "low",
          emotionalLevel: "low",
          predictionLevel: "none",
          questionUsage: false,
          ctaUsage: false,
          targetGrowthObjective: n < 2 ? "balanced" : "expansion",
          mediaUsefulness: "optional",
          hypothesisNote: "fallback hypothesis — validate after publish",
        },
      })),
    }));

    const diversity = enforcePortfolioDiversity(fallbackDays, "");
    fallbackDays = diversity.days;

    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: 7,
      days: fallbackDays,
      rationale: "계획 지연 — 기본 7일 슬롯 캘린더 사용 (다양성 가드레일 적용)",
      audienceRead: {
        portfolio: {
          identityStatement: "기본 포트폴리오 (timeout fallback)",
          diversityNotes: diversity.note,
          riskOfNarrowing: "low",
          creatorIntentReflection: "Creator Intent 미입력 (fallback)",
          expansionMoves: diversity.changed ? ["fallback 다양성 가드레일 적용"] : [],
        },
        diversityGuardApplied: diversity.changed,
      },
      totalPlanned: 35,
      fallback: true,
      detail: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 120),
    });
  }
}
