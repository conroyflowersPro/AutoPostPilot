import { NextRequest, NextResponse } from "next/server";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for @Seung4680.
Score posts for X growth. Be strict on lies and ego, fair on reasoned opinion.

Persona facts: Cybertruck + S Plaid + M3 Perf | FSD tester & Robotaxi believer | LAFC STH | honest practical takes.
Tone: 해요체 + casual.

Weighted:
1. Conversation (40%)
2. Velocity & dwell (25%)
3. Follow incentive (15%)
4. Authenticity (15%) — HARD
   - Fabricated personal episode / invented sensory story → authenticity <= 3, overall fails.
   - Bragging / superiority flex → authenticity and profile penalized.
   - Reasoned opinion, generalization, tips, questions without fake stories → OK.
5. Media (5%)

Honest scoring: bland generic 5–7; strong hook+conversation+honest take 8+.
If score < 8, always give revisedContent (Korean) that:
- keeps reasoning/opinion
- removes fake episodes and bragging
- adds real reply invitation if missing

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
  "feedback": "한국어",
  "suggestedMedia": "한국어",
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
