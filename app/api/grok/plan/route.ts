import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM = `You plan Korean X posts for @Seung4680 as a real multi-day content calendar.

Persona: Cybertruck primary driver (MSP & M3P mostly used by wife/son) | FSD v14 tester & Robotaxi believer | LAFC STH | long-term Tesla investor focused on Elon vision & product progress — NEVER short-term stock price/TSLA chart/등락/매매 타이밍 chatter | honest tips | Dogecoin & gaming.

HARD RULES for the plan:
- Each day must have 5–8 Korean post slots (prefer 5–6; use 7–8 only when keywords/material are rich).
- Never fewer than 5 per day.
- Each slot has exactly one clear primaryTopic.
- allowedContext max one supporting context that concretely helps the main topic.
- forbiddenTopics must list topics that must NOT appear in that post.
- Same detailed topic, same example, same place experience, same vehicle comparison, same opening pattern, or same conclusion must not repeat across the 3 days.
- Same big category (FSD, Cybertruck, Robotaxi…) may reappear only with clearly different angle and preferably with a day gap; never consecutive on the same day.
- Vary contentType and overall day atmosphere across Day 0 / 1 / 2. Do not repeat the same sequence every day (Cybertruck → FSD → Robotaxi → LAFC…).
- Keywords are only signals of follower interest. They are not personal experiences or facts. Do not invent driving stories, family reactions, numbers, or events from keywords alone.
- All final posts will be written in natural conversational Korean later. Plan in Korean for topics/angles.

Output JSON only, no other text:
{
  "generationDays": 3,
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
  "rationale": "한 줄 한국어"
}

slotId format: D{day+1}P{index} e.g. D1P1, D1P2, D2P1…
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { startDate, keywords, mergedKeywords, generationDays = 3 } = body || {};
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const daysCount = Math.min(7, Math.max(1, Number(generationDays) || 3));
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";

    const user = `Plan ${daysCount} days of Korean posts starting ${startDate || "today"}.
Keywords (follower interest signals only): ${topic || "(FSD, ownership, Elon vision, LAFC — no stock price)"}
Each day 5–8 slots (prefer 5–6). One clear primaryTopic per slot. No repeated detailed topics/examples across days. JSON only.`;

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

    // Normalize / fallback
    const days: any[] = [];
    const srcDays = Array.isArray(parsed?.days) ? parsed.days : [];

    for (let i = 0; i < daysCount; i++) {
      const d = srcDays.find((x: any) => x.dayOffset === i) || srcDays[i] || {};
      let posts = Array.isArray(d.posts) ? d.posts : [];

      // Clamp 5–8
      if (posts.length < 5) {
        // pad with safe defaults if model under-delivered
        while (posts.length < 5) {
          const idx = posts.length + 1;
          posts.push({
            slotId: `D${i + 1}P${idx}`,
            primaryTopic: "일상 관찰",
            angle: "자연스러운 하루 관찰",
            contentType: "observation",
            allowedContext: [],
            forbiddenTopics: ["주가", "등락", "매매"],
            targetLength: "medium",
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
      totalPlanned: days.reduce((s: number, d: any) => s + d.posts.length, 0),
    });
  } catch (err: any) {
    console.error(err);
    // Timeout/failure: return usable default plan so generation continues
    const topics = ["FSD 관찰", "Cybertruck 일상", "Robotaxi 시각", "LAFC", "소유 팁"];
    const angles = ["실사용 체감", "디테일 관찰", "장기 전망", "경기/분위기", "유용한 팁"];
    const fallbackDays = [0, 1, 2].map((i) => ({
      dayOffset: i,
      posts: topics.map((t, n) => ({
        slotId: `D${i + 1}P${n + 1}`,
        primaryTopic: t,
        angle: angles[n],
        contentType: "observation",
        allowedContext: [],
        forbiddenTopics: ["주가", "등락", "매매"],
        targetLength: "medium",
      })),
    }));
    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: 3,
      days: fallbackDays,
      rationale: "계획 지연 — 기본 슬롯 캘린더 사용",
      totalPlanned: 15,
      fallback: true,
      detail: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 120),
    });
  }
}
