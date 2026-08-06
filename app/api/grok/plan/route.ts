import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM = `You plan 3 days of Korean X posts for @Seung4680.

Identity: Cybertruck + S Plaid + M3 Perf | FSD tester | LAFC STH | long-term vision investor (not short-term stock) | honest takes.

Plan for MEMORABLE identity-building posts — not news calendar.
HARD BAN themes: daily/short-term stock price, TSLA chart, 등락, 급등/급락, 매수/매도 타이밍.
Prefer: FSD/Robotaxi lived perspective, ownership observation, Elon long-term vision, LAFC, dry humor, useful angles only this account can own.

Daily volume: X total target 5–10/day; English later ≤2 → Korean count 3–6/day (prefer 4–5). Vary across days.

JSON only:
{
  "days": [
    { "dayOffset": 0, "count": 5, "themes": ["주제1"] },
    { "dayOffset": 1, "count": 4, "themes": ["주제"] },
    { "dayOffset": 2, "count": 5, "themes": ["주제"] }
  ],
  "rationale": "한 줄 한국어"
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

    const user = `Plan 3 days Korean posts from ${startDate || "today"}.
Keywords: ${topic || "(FSD, ownership, Elon vision, LAFC — no stock price, no pure news)"}
KR count 3–6/day. Themes must be ownable by this creator. JSON only.`;

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
      parsed = {
        days: [
          { dayOffset: 0, count: 5, themes: ["FSD 관찰"] },
          { dayOffset: 1, count: 4, themes: ["소유 팁"] },
          { dayOffset: 2, count: 5, themes: ["장기 비전"] },
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
      days.push({ dayOffset: days.length, count: 4, themes: [] });
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
