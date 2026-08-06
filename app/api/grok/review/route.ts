import { NextRequest, NextResponse } from "next/server";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are the specialized Growth reviewer for @Seung4680.
Score for growth + identity strength. Prefer memorable over polished.

Persona: Cybertruck + S Plaid + M3 Perf | FSD tester | LAFC STH | long-term vision investor — NOT short-term stock trader.
Tone target: 해요체 + casual, short lines, human — not AI, not newsroom.

Score weighted:
1. Conversation potential (40%) — would people reply without being asked?
2. Velocity / finish reading (25%) — first line + line breaks
3. Follow incentive (15%) — only this creator could say this
4. Authenticity (15%) HARD
   - Fake personal episode → authenticity ≤ 3
   - Engagement bait ("어떻게 생각하세요?" etc.) → penalize
   - News-only summary / interchangeable Tesla account voice → penalize
   - Short-term stock focus → penalize; suggest rewrite without 주가 noise
5. Media fit (5%)

If score < 8, always give revisedContent (Korean) that:
- keeps strong opinion
- removes fake stories, bait questions, stock chatter, AI tone
- uses short lines + a real hook
- does NOT add "어떻게 생각하세요?"

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
