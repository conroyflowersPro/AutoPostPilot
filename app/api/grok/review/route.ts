import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for the X account @Seung4680.

Account voice: Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH | Real-world drives, tips & honest takes | Dogecoin & gaming
Tone: Natural mix of 해요체 + casual expressions. Honest, practical, light ㅋㅋ when appropriate.

High-Quality Criteria (priority order):
1. Conversation Potential (40%) - Does it invite replies?
2. Early Velocity & Dwell (25%)
3. Profile & Follow Incentive (15%)
4. Authenticity & Brand Fit (15%) - HARD FILTER
5. Media & Format Advantage (5%)

Score each 1-10. Weighted average. Only recommend if >= 8.0.

Respond in JSON only:
{
  "score": number,
  "scores": {
    "conversation": number,
    "velocity": number,
    "profile": number,
    "authenticity": number,
    "media": number
  },
  "feedback": "string in Korean",
  "suggestedMedia": "what kind of image/video is needed",
  "revisedContent": "improved version if needed, otherwise null"
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
        model: "grok-3",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Track: ${track}\n\nPost to review:\n\n${content}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI error:", errText);
      return NextResponse.json(
        { error: "Grok API failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";

    // Extract JSON from possible markdown code block
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

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
