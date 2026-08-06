import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for the X account @Seung4680.
You WRITE and MANAGE the content. You are the editor and manager of this account's posts.

Account voice: Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH | Real-world drives, tips & honest takes | Dogecoin & gaming
Tone: Natural mix of 해요체 + casual expressions. Honest, practical, light ㅋㅋ when appropriate. No pure 반말, no overly formal speech.

High-Quality Criteria (priority order):
1. Conversation Potential (40%) - invite replies, questions, experience share
2. Early Velocity & Dwell (25%)
3. Profile & Follow Incentive (15%)
4. Authenticity & Brand Fit (15%) - HARD FILTER, must pass
5. Media & Format Advantage (5%)

Rules:
- Only output posts that would score >= 8.0 overall.
- Mix topics: FSD/Cybertruck real-world tips, LAFC, honest daily observations. Do NOT make every post pure Tesla news.
- Every post MUST suggest a concrete media type (photo/video description).
- Korean only for this request.
- Keep each post concise and natural for X.

Respond in JSON only, no markdown:
{
  "posts": [
    {
      "content": "the full post text in Korean",
      "score": number,
      "suggestedMedia": "구체적인 사진/영상 설명",
      "dayOffset": 0,
      "slot": 1
    }
  ],
  "keywordRequest": null or "Fedica나 해시에 쓸 키워드를 알려주세요: ..."
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

    const total = Math.min(days * countPerDay, 15); // safety cap

    const userPrompt = `Generate ${total} high-quality Korean posts for @Seung4680 covering approximately ${days} days (start around ${startDate || "today"}).
Distribute them with dayOffset 0,1,2... and slot 1,2,3... within each day.
${keywords ? `User-provided keywords/themes to consider: ${keywords}` : ""}
Only posts scoring >= 8.0. Include concrete suggestedMedia for each.
Occasionally set keywordRequest if you need hashtags or Fedica-related keywords from the user.`;

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
        temperature: 0.7,
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

    // Save as drafts in Supabase
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const baseDate = startDate ? new Date(startDate) : new Date();
    const inserted = [];

    for (const p of parsed.posts) {
      const dayOffset = typeof p.dayOffset === "number" ? p.dayOffset : 0;
      const d = new Date(baseDate);
      d.setDate(d.getDate() + dayOffset);
      // rough time slots later; for now store date only in content meta via scheduled_at null

      const { data: row, error } = await supabase
        .from("SeungContent")
        .insert({
          content: p.content,
          status: "draft",
          pipeline_id: "42303",
          user_id: user.id,
          // store suggestion temporarily? we can put in content note or later column
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
