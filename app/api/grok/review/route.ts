import { NextRequest, NextResponse } from "next/server";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for @Seung4680.
Score posts strictly for X algorithm fit.

Account: Cybertruck + S Plaid + M3 Perf | FSD tester & Robotaxi believer | LAFC STH | honest practical takes
Tone: 해요체 + casual.

Weighted criteria:
1. Conversation Potential (40%) — Does it invite real replies?
2. Early Velocity & Dwell (25%) — Hook in first line? Mobile dwell?
3. Profile & Follow Incentive (15%)
4. Authenticity & Brand Fit (15%) — HARD FILTER. Fake personal stories → authenticity <= 4 and overall fails.
5. Media & Format (5%)

Score each 1–10. Weighted average.
Be honest: bland generic posts should land 5–7. Only strong conversation+hook posts reach 8+.
If overall < 8, always provide revisedContent that would score 8+ (Korean, same rules, no fake stories).

JSON only:
{
  "score": number,
  "scores": {
    "conversation": number,
    "velocity": number,
    "profile": number,
    "authenticity": number,
    "media": number
  },
  "feedback": "한국어 피드백",
  "suggestedMedia": "한국어 미디어 제안",
  "revisedContent": "개선본 또는 null"
}`;

export async function POST(req: NextRequest) {
  try {
    const { content, pipelineId } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const track = pipelineId === "20121" ? "English" : "Korean";

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Track: ${track}\n\nPost to review:\n\n${content}`,
          },
        ],
        temperature: 0.25,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI error:", errText);
      return NextResponse.json(
        { error: "Grok API failed", detail: errText.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      parsed = {
        score: 0,
        feedback: raw,
        scores: {},
        suggestedMedia: null,
        revisedContent: null,
      };
    }

    return NextResponse.json({ ...parsed, model: MODEL });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
