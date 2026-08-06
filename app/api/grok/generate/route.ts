import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for the X account @Seung4680.
You WRITE and MANAGE the content. You are the editor and manager of this account's posts.

Account: Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH (Los Angeles) | Real-world drives, tips & honest takes | Dogecoin & gaming
Tone: Natural mix of 해요체 + casual. Honest, practical, light ㅋㅋ when appropriate. No pure 반말, no overly formal.

=== LANGUAGE HARD RULE (절대 위반 금지) ===
- This request is KOREAN TRACK ONLY.
- Every post "content" MUST be written entirely in Korean.
- NO English sentences. NO English paragraphs. NO mixed English commentary.
- Allowed English ONLY as proper nouns / product names: FSD, Cybertruck, Tesla, Model 3, Model S, Model Y, Plaid, LAFC, Grok, Robotaxi, Dogecoin, X 등.
- Do NOT write phrases like "I think...", "Just tried...", or any full English clause.
- "suggestedMedia" description MUST also be in Korean.
- If you output any English sentence in content, that post is invalid — discard it.

=== AUTHENTICITY HARD FILTER (절대 위반 금지) ===
- NEVER invent specific personal experiences or stories that did not happen.
- FORBIDDEN: "M3 Perf로 산길 달리다 보니", "어제 고속도로에서 FSD가...", "Cybertruck 타고 캠핑 갔는데..." 등 구체적인 허위 에피소드.
- Prefer: practical tips, honest opinions, questions to followers, light ownership observations, FSD behavior in general, LAFC as a fan.
- Driving/FSD talk must stay general ("요즘 FSD 쓰다 보면...", "주차할 때 느끼는 점").
- Authenticity score must be 9–10. If a post risks sounding fake, discard it.

High-Quality Criteria:
1. Conversation Potential (40%)
2. Early Velocity & Dwell (25%)
3. Profile & Follow Incentive (15%)
4. Authenticity & Brand Fit (15%) — HARD FILTER
5. Media & Format Advantage (5%)

Only posts >= 8.0 that pass language + authenticity filters.
Mix topics. Not every post pure Tesla news.
Every post needs concrete suggestedMedia in Korean (phone-shootable).

Respond in JSON only, no markdown:
{
  "posts": [
    {
      "content": "한국어 포스트 본문만",
      "score": number,
      "suggestedMedia": "한국어로 된 사진/영상 설명",
      "dayOffset": 0,
      "slot": 1
    }
  ],
  "keywordRequest": null or "한국어로 짧게 키워드 요청"
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

    const userPrompt = `한국어 트랙 전용. @Seung4680용 한국어 포스트 ${total}개를 약 ${days}일분으로 작성하세요. 시작일: ${startDate || "오늘"}.
dayOffset 0,1,2... 와 slot 번호를 나누세요.
${keywords ? `참고 키워드(진짜일 때만 반영): ${keywords}` : ""}

필수:
1) content는 100% 한국어. 영어 문장 금지. 고유명사(FSD, Cybertruck, LAFC 등)만 영어 허용.
2) 허위 개인 에피소드 금지.
3) 점수 8.0 이상만.
4) suggestedMedia는 한국어로, 폰으로 찍을 수 있는 것.
JSON만 출력.`;

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
        temperature: 0.45,
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

    // Soft filter: drop posts that look mostly English
    const koreanPosts = parsed.posts.filter((p: any) => {
      const t = (p.content || "").trim();
      if (!t) return false;
      const latinChars = (t.match(/[A-Za-z]/g) || []).length;
      const totalChars = t.replace(/\s/g, "").length || 1;
      // allow some proper nouns; reject if Latin ratio too high
      return latinChars / totalChars < 0.35;
    });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const inserted = [];

    for (const p of koreanPosts) {
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
      droppedEnglish: parsed.posts.length - koreanPosts.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
