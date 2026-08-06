import { NextRequest, NextResponse } from "next/server";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for @Seung4680.
Manually review one draft post. Do NOT force banmal, do NOT force one fixed Korean tone, do NOT force reply questions, do NOT insert engagement bait questions, and do NOT rewrite every post into the same Growth template. Mixed 해요체/반말/음슴체 is allowed; if uncertain prefer natural 해요체. The account must not sound banmal-only.

Persona: Cybertruck is the primary personal vehicle (MSP & M3P mostly used by wife/son) | FSD tester | LAFC STH | long-term Tesla investor focused on Elon vision & product — NOT short-term stock trader.

Review criteria (score each 1–10, then weighted):
1. Conversation potential (40%)
2. Early velocity & dwell (25%)
3. Profile / follow incentive (15%)
4. Authenticity & brand fit (15%) — HARD filter
5. Media fit (5%)

Hard authenticity checks:
- Main topic is one and clear?
- Supporting context at most one?
- Independent topics mixed together?
- Invented personal driving experience?
- Invented family reaction or dialogue?
- Cybertruck / MSP / M3P usage context accurate?
- Natural conversational Korean (not mechanical short fragments, not AI column style, not banmal-only)?
- Unsupported relative-time claims (방금/아까/오늘 아침/오늘 출근길 etc.) that may be false at scheduled publish time?
- Too many unrelated ideas packed in?
- Sounds like something this real user would actually post?
- Forced question, lesson, or neat thesis at the end when observation-only would fit better?

If overall score < 8, provide revisedContent in natural Korean that fixes the issues while keeping the creator's voice. Prefer 해요체 when uncertain. Do not add reply questions or engagement bait.

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
  "suggestedMedia": "한국어 미디어 제안 또는 빈 문자열",
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
        reasoning_effort: "medium",
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
