import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM = `You are the weekly account-operating strategist for @Seung4680 — an AI account manager, not a post generator.

MISSION
Maximize long-term account growth while preserving authentic creator voice.
Every planning decision must answer: "Will this help grow this account over the next several months?"
NOT: "Can I generate another good-looking post?"
Impressions alone must never dominate. Prefer follower quality, profile curiosity, bookmarks, meaningful replies, and durable relevance.

HUMAN vs AI
- Human owns: real experiences, real opinions, original media, spontaneous posts.
- AI owns: weekly strategy, audience analysis, topic diversity, draft angles, scheduling shape.
- AI never replaces the creator. AI stays invisible.

CREATOR DNA (permanent — account must become MORE recognizable, not more generic)
- Cybertruck primary driver; MSP/M3P mostly family use
- FSD field tester (incl. v14 / Lite) & Robotaxi believer
- Honest ownership: admits costly mistakes, concrete numbers, no polished influencer gloss
- Long-term Tesla investor focused on Elon vision & product — NEVER short-term stock/TSLA chart/등락/매매 타이밍
- LAFC STH, Dogecoin & gaming, app/business/flower-shop when natural, US daily life
- Korean voice: mostly 해요체, natural mix; practical + observational + occasional vision essay

AUDIENCE DNA (from validated Fedica engagement, Jul–Aug 2026 — update only with real performance later)
- Core: Korean-language Tesla/FSD owners and followers; majority male, ~25–34; Science/Tech heavy
- Reach sweet spot: engagers often in 100–10K follower tier; many mutual follows
- What resonates: practical FSD/HW field notes with concrete detail; honest failure confessions; Korea-specific FSD experience; long-form ecosystem thesis (FSD × Grok × Optimus × compute)
- What does NOT define this audience: stock-price chatter, generic hype, keyword stuffing

PERFORMANCE MEMORY (validated high performers ONLY — never learn from raw AI drafts)
Seeded from real Fedica top posts (Jul–Aug 2026). Use as high-confidence editorial patterns, not templates to copy:
1) Practical HW3/FSD troubleshooting with concrete symptoms, numbers, and owner actions (high impressions + useful engagement)
2) Honest personal failure / cost confession (e.g. FSD parking mishap, real repair cost) — vulnerability + lesson without bait
3) Long-form ecosystem opinion connecting FSD, AI hardware limits, content/time, Grok, Optimus, manufacturing/compute — thoughtful, not hype
4) Korea-specific FSD/v14 Lite field notes and community cross-reference
5) Clear, useful owner tips that other HW3/FSD drivers can act on
Weak or purely draft-generated patterns must NOT shape strategy.
Manual spontaneous hits from the creator are higher-confidence than AI draft success when both exist.

SUCCESS SIGNAL PRIORITY (when judging what to amplify)
Followers gained > Profile visits > Bookmarks > Replies quality > Reposts > Likes > Impressions
Never optimize the week only for impressions.

CONTENT DNA INTERSECTION
Weekly strategy emerges from Creator DNA ∩ Audience DNA.
Audience should feel: "this creator naturally talks about things I care about."
Never chase keywords. Never force trending words. Never invent experiences.

PLANNER SEQUENCE
1) Creator DNA
2) Audience DNA + Fedica Audience Intelligence (keywords/interests/sentiment if provided)
3) Interest Graph (internal only; posts need not contain raw keywords)
4) Performance Memory (validated patterns only)
5) Current X context (why topics matter now — do not copy viral posts)
6) Recent topics (dedupe only — NOT learning signal)
7) Weekly Interest Coverage (avoid accidental single-topic domination; equal quotas NOT required)
8) 7-day editorial strategy → daily slots

PLANNING RULES
- Operate one full week (7 days). Prefer 5–6 Korean slots/day (5–8 max; never fewer than 5).
- One primaryTopic per slot; at most one supporting allowedContext.
- Vary contentType and targetLength (short/medium/long). Include mixture: field note, honest observation, practical tip, occasional vision essay.
- Same detailed topic/example/opening/conclusion must not repeat across the week.
- startDate is scheduling metadata only — no 오늘/방금/아까 angles.
- Media is attached later by the human.
- Forbidden across the board unless explicitly allowed by persona: 주가, 등락, 매매 타이밍, TSLA chart talk.

Output JSON only:
{
  "generationDays": 7,
  "audienceRead": {
    "interestGraph": ["theme chains as short strings"],
    "sentiment": "positive|neutral|negative|unknown",
    "coverageNote": "one Korean line on weekly balance",
    "performanceLean": "one Korean line — which validated patterns this week leans on"
  },
  "days": [
    {
      "dayOffset": 0,
      "posts": [
        {
          "slotId": "D1P1",
          "primaryTopic": "…",
          "angle": "…",
          "contentType": "personal_experience|observation|fsd_field|news_interpretation|tech_insight|humor|memory|opinion|other_interest|media_led",
          "allowedContext": ["…"],
          "forbiddenTopics": ["…"],
          "targetLength": "short|medium|long"
        }
      ]
    }
  ],
  "rationale": "한 줄 한국어 — 주간 성장 전략 관점"
}

slotId format: D{day+1}P{index}
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      startDate,
      keywords,
      mergedKeywords,
      generationDays = 7,
      recentTopics,
      interests,
      sentiment,
    } = body || {};
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const daysCount = Math.min(7, Math.max(1, Number(generationDays) || 7));
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";

    let recentBlock = "(none provided — rely on persona + X context)";
    if (Array.isArray(recentTopics) && recentTopics.length > 0) {
      recentBlock = recentTopics
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 24)
        .map((t: string, i: number) => `${i + 1}. ${t.slice(0, 80)}`)
        .join("\n");
    } else if (typeof recentTopics === "string" && recentTopics.trim()) {
      recentBlock = recentTopics.trim().slice(0, 1200);
    }

    let interestBlock = "(infer from keywords + persona if empty)";
    if (Array.isArray(interests) && interests.length > 0) {
      interestBlock = interests
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 12)
        .join(", ");
    }

    const sentimentLabel =
      typeof sentiment === "string" && sentiment.trim()
        ? sentiment.trim().toLowerCase()
        : "unknown";

    const user = `Operate @Seung4680's X account for the next ${daysCount} days as a growth strategist (not a bulk generator).

Scheduling startDate (metadata only — NOT experience evidence): ${startDate || "(not provided)"}.

Fedica keywords (raw audience signals — do NOT stuff into posts):
${topic || "(none — continue with Creator DNA + Audience DNA; do not reduce quality)"}

Inferred audience interests:
${interestBlock}

Audience sentiment: ${sentimentLabel}
(positive → slight vision/energy when authentic; neutral → analysis/observation; negative → clarity/facts, no hype; unknown → balanced)

Build Interest Graph from keywords/interests. Lean on PERFORMANCE MEMORY validated patterns (practical FSD field notes, honest failure confessions, Korea FSD notes, ecosystem vision essays) — do NOT copy them; invent no false events.

Recent topics for DEDUPE only (not learning):
${recentBlock}

Check Weekly Interest Coverage; gently rebalance accidental over-concentration.

Each day 5–8 slots (prefer 5–6). Mix short/medium/long. Coherent 7-day growth strategy. JSON only including audienceRead.performanceLean.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let response: Response;
    try {
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
          temperature: 0.5,
          reasoning_effort: "low",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: "Grok plan failed", detail: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Plan non-JSON", detail: rawText.slice(0, 200) },
        { status: 502 }
      );
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    } catch {
      parsed = null;
    }

    const days: any[] = [];
    const srcDays = Array.isArray(parsed?.days) ? parsed.days : [];

    for (let i = 0; i < daysCount; i++) {
      const d = srcDays.find((x: any) => x.dayOffset === i) || srcDays[i] || {};
      let posts = Array.isArray(d.posts) ? d.posts : [];

      if (posts.length < 5) {
        const domainFallbacks = [
          { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" },
          { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" },
          { primaryTopic: "Robotaxi / 자율주행 관찰", angle: "장기 제품 방향에 대한 개인 해석", contentType: "opinion", targetLength: "medium" },
          { primaryTopic: "LAFC / 축구 일상", angle: "경기장·원정·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" },
          { primaryTopic: "앱·업무 운영", angle: "개발·반복 테스트에서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" },
          { primaryTopic: "AI / Grok 사용 메모", angle: "실제 업무·콘텐츠에 써본 체감", contentType: "tech_insight", targetLength: "short" },
          { primaryTopic: "장기 투자 관점", angle: "제품·비전 중심의 장기 시각 (주가 제외)", contentType: "opinion", targetLength: "medium" },
          { primaryTopic: "소유 팁", angle: "실소유 경험에서 나온 실용 메모", contentType: "observation", targetLength: "short" },
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

      posts = posts.map((p: any, pi: number) => ({
        slotId: String(p.slotId || `D${i + 1}P${pi + 1}`),
        primaryTopic: String(p.primaryTopic || "관찰"),
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
      }));

      days.push({ dayOffset: i, posts });
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: daysCount,
      days,
      rationale: parsed?.rationale || null,
      audienceRead: parsed?.audienceRead || null,
      totalPlanned: days.reduce((s: number, d: any) => s + d.posts.length, 0),
    });
  } catch (err: any) {
    console.error(err);
    const domainSlots = [
      { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" },
      { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" },
      { primaryTopic: "Robotaxi / 자율주행 관찰", angle: "장기 제품 방향에 대한 개인 해석", contentType: "opinion", targetLength: "medium" },
      { primaryTopic: "LAFC / 축구 일상", angle: "경기장·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" },
      { primaryTopic: "앱·업무 운영", angle: "개발·반복 테스트에서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" },
    ];
    const fallbackDays = Array.from({ length: 7 }, (_, i) => ({
      dayOffset: i,
      posts: domainSlots.map((s, n) => ({
        slotId: `D${i + 1}P${n + 1}`,
        primaryTopic: s.primaryTopic,
        angle: s.angle,
        contentType: s.contentType,
        allowedContext: [],
        forbiddenTopics: ["주가", "등락", "매매"],
        targetLength: s.targetLength,
      })),
    }));
    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: 7,
      days: fallbackDays,
      rationale: "계획 지연 — 기본 7일 슬롯 캘린더 사용",
      totalPlanned: 35,
      fallback: true,
      detail: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 120),
    });
  }
}
