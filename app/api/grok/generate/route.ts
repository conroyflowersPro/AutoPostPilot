import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for the X account @Seung4680.
You WRITE and MANAGE the content. You are the editor and manager of this account's posts.

Account: Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH (Los Angeles) | Real-world drives, tips & honest takes | Dogecoin & gaming
Tone: Natural mix of 해요체 + casual. Honest, practical, light ㅋㅋ when appropriate. No pure 반말, no overly formal.

=== AUTHENTICITY HARD FILTER (절대 위반 금지) ===
- NEVER invent specific personal experiences or stories that did not happen.
- FORBIDDEN examples: "M3 Perf로 산길 달리다 보니", "어제 고속도로에서 FSD가...", "Cybertruck 타고 캠핑 갔는데..." 등 구체적인 허위 에피소드.
- DO NOT claim dramatic or specific drives, trips, or events unless they are generic and clearly framed as general observation or tip.
- Prefer: practical tips, honest opinions, questions to followers, light observations about ownership, FSD behavior in general, LAFC as a fan, daily life tone.
- If talking about driving/FSD: keep it general ("요즘 FSD 쓰다 보면...", "주차할 때 느끼는 점") — never invent a specific route, mountain, night drive story, etc.
- Authenticity score must be 9–10. If a post risks sounding fake, discard it.

High-Quality Criteria:
1. Conversation Potential (40%) — questions, invite replies
2. Early Velocity & Dwell (25%)
3. Profile & Follow Incentive (15%)
4. Authenticity & Brand Fit (15%) — HARD FILTER
5. Media & Format Advantage (5%)

Only output posts that would score >= 8.0 overall AND pass authenticity hard filter.
Mix: FSD/Cybertruck practical tips, LAFC fan takes, honest ownership observations. Not every post pure Tesla news.
Every post MUST include concrete suggestedMedia (what photo/video the user should shoot).
Korean only. Concise, natural for X.

Respond in JSON only, no markdown:
{
  "posts": [
    {
      "content": "full post text in Korean",
      "score": number,
      "suggestedMedia": "구체적인 사진/영상 설명 (사용자가 폰으로 찍을 수 있는 것)",
      "dayOffset": 0,
      "slot": 1
    }
  ],
  "keywordRequest": null or "brief request for keywords if needed"
}`;

export async function POST(req: NextRequest) {
  try {
    const { startDate, days = 3, countPerDay = 4, keywords } = await req.json();

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const total = Math.min(days * countPerDay, 12);

    const userPrompt = `Generate ${total} high-quality Korean posts for @Seung4680 for ~${days} days (start ${startDate || "today"}).
Distribute with dayOffset 0,1,2... and slot numbers.
${keywords ? `User themes/keywords (use only if authentic): ${keywords}` : ""}

CRITICAL: No fabricated personal stories. No fake mountain drives, no invented specific trips or "yesterday I..." false anecdotes.
Keep everything honest, general, practical, or question-based. Authenticity hard filter must pass.
Only posts >= 8.0. Concrete suggestedMedia for each (things the owner can actually photograph with a phone).`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.55,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI generate error:", errText);
      return NextResponse.json({ error: "Grok API failed" }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";

    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Grok response", raw },
        { status: 502 }
      );
    }

    if (!parsed.posts || !Array.isArray(parsed.posts)) {
      return NextResponse.json(
        { error: "Invalid posts format from Grok" },
        { status: 502 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const inserted = [];

    for (const p of parsed.posts) {
      const dayOffset = typeof p.dayOffset === "number" ? p.dayOffset : 0;

      const { data: row, error } = await supabase
        .from("SeungContent")
        .insert({
          content: p.content,
          status: "draft",
          pipeline_id: "42303",
          user_id: user.id,
        })
        .select()
        .single();

      if (!error && row) {
        inserted.push({
          ...row,
          score: p.score,
          suggestedMedia: p.suggestedMedia,
          dayOffset,
          slot: p.slot,
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: inserted.length,
      posts: inserted,
      keywordRequest: parsed.keywordRequest || null,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
