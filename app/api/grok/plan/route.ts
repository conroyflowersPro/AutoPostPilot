import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM = `You plan 3 days of Korean X posts for @Seung4680.
Persona: Cybertruck + S Plaid + M3 Perf | FSD tester | LAFC STH | honest tips | Dogecoin & gaming

Daily volume rules:
- Total posts/day on X for this account target: 5–10
- English track later uses max 2/day → plan Korean count in 3–6 per day (prefer 4–5)
- Vary counts across days for natural cadence (not identical every day)
- More posts on days with stronger conversation topics; fewer if thin themes

Themes: short Korean phrases from keywords or account niche. No fake personal events.

JSON only:
{
  "days": [
    { "dayOffset": 0, "count": 5, "themes": ["주제1", "주제2"] },
    { "dayOffset": 1, "count": 4, "themes": ["주제"] },
    { "dayOffset": 2, "count": 5, "themes": ["주제"] }
  ],
  "rationale": "한 줄 한국어 이유"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { startDate, keywords, mergedKeywords } = body || {};
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";

    const user = `Plan 3 days of Korean posts starting ${startDate || "today"}.
Keywords/themes: ${topic || "(none — use FSD, ownership tips, LAFC, honest observations mix)"}
Vary daily KR count 3–6. JSON only.`;

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
      // fallback balanced plan
      parsed = {
        days: [
          { dayOffset: 0, count: 5, themes: topic ? [topic] : ["FSD"] },
          { dayOffset: 1, count: 4, themes: ["소유 팁"] },
          { dayOffset: 2, count: 5, themes: ["LAFC"] },
        ],
        rationale: "기본 균형 플랜",
      };
    }

    const days = (Array.isArray(parsed.days) ? parsed.days : [])
      .slice(0, 3)
      .map((d: any, i: number) => ({
        dayOffset: typeof d.dayOffset === "number" ? d.dayOffset : i,
        count: Math.min(6, Math.max(3, Number(d.count) || 4)),
        themes: Array.isArray(d.themes)
          ? d.themes.map((t: any) => String(t)).slice(0, 5)
          : [],
      }));

    while (days.length < 3) {
      days.push({
        dayOffset: days.length,
        count: 4,
        themes: [],
      });
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      days,
      rationale: parsed.rationale || null,
      totalPlanned: days.reduce((s: number, d: any) => s + d.count, 0),
    });
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.name === "AbortError"
        ? "계획 시간 초과"
        : err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
