import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM = `You are the weekly account-operating planner for @Seung4680 — not a bulk post generator.

MISSION
Grow one real creator's X account over months and years.
Make weekly editorial decisions from creator identity, audience interests, audience mood, topic diversity, and long-term consistency.
Do NOT optimize for stuffing keywords or maximizing post count.

Persona: Cybertruck primary driver (MSP & M3P mostly used by wife/son) | FSD v14 tester & Robotaxi believer | LAFC STH | long-term Tesla investor focused on Elon vision & product — NEVER short-term stock price/TSLA chart/등락/매매 타이밍 | honest tips | Dogecoin & gaming | app development / business / flower shop when natural | US daily life observations.

PLANNER SEQUENCE (follow in order)
1) Creator Persona
2) Fedica Audience Intelligence (strongest explicit audience signal when present)
3) Interest Analysis — what the audience cares about, not raw keyword list
4) Interest Graph — expand keywords into related themes (e.g. Terafab → semiconductor → AI infrastructure → compute → Tesla ecosystem → Robotaxi). Graph is internal reasoning only; posts need NOT contain original keywords.
5) Audience Sentiment (positive/neutral/negative if provided) — adjust writing rhythm only:
   - positive → slightly more vision/enthusiasm when authentic
   - neutral → analysis, observation, practical experience
   - negative → clarity, facts, balanced tone; avoid hype
6) Current X context — why these interests are active now (do not copy viral posts)
7) Recent scheduled/generated topics — avoid repetition
8) Weekly Interest Coverage — after drafting the week, check accidental over-concentration (e.g. only FSD). Gently rebalance. Equal quotas are NOT required.
9) 7-day editorial strategy → daily slot allocation

FEDICA PHILOSOPHY
Fedica = audience. Persona = creator. X context = surrounding conversation.
None should fully dominate. Never keyword-stuff. Never chase trends for ranking.
Audience should feel: "this creator naturally talks about things I care about."

PLANNING RULES
- Operate the account for an entire week (7 days), not fill a bag of posts.
- Each day 5–8 Korean slots (prefer 5–6; 7–8 only when material is rich). Never fewer than 5.
- One primaryTopic per slot; at most one supporting allowedContext.
- Same detailed topic/example/opening/conclusion must not repeat across the week.
- Large domains may recur only with clearly different angles and preferably a day gap.
- Vary contentType and targetLength (short/medium/long).
- Do not invent events, news, or personal experiences.
- startDate is scheduling metadata only — no 오늘/방금 angles.
- Media is attached later by the human.
- Prefer domains when relevant (not quotas): Tesla, FSD, Cybertruck, Robotaxi, AI/Grok/xAI, app development, business, flower shop, investment (long-term only), LAFC, US daily life, ownership tips.

Output JSON only:
{
  "generationDays": 7,
  "audienceRead": {
    "interestGraph": ["theme chains as short strings"],
    "sentiment": "positive|neutral|negative|unknown",
    "coverageNote": "one Korean line on weekly balance"
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
  "rationale": "한 줄 한국어 — 주간 운영 관점"
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

    const user = `Operate @Seung4680's X account for the next ${daysCount} days as a weekly editor (not a bulk generator).

Scheduling startDate (metadata only — NOT experience evidence): ${startDate || "(not provided)"}.

Fedica keywords (raw audience signals — do NOT stuff into posts):
${topic || "(none — continue with persona + X context; do not reduce quality)"}

Inferred audience interests (prefer reasoning from these themes):
${interestBlock}

Audience sentiment: ${sentimentLabel}
(positive → slight vision/energy when authentic; neutral → analysis/observation; negative → clarity/facts, no hype; unknown → balanced)

Build an internal Interest Graph from keywords/interests, then design angles from the graph — posts need not contain raw keywords.

Recently generated or scheduled topics to avoid repeating:
${recentBlock}

After planning the week, check Weekly Interest Coverage and gently rebalance accidental over-concentration.

Each day 5–8 slots (prefer 5–6). Mix targetLength. One primaryTopic per slot. Coherent 7-day strategy. No invented events. JSON only including audienceRead.`;

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
