import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for the X account @Seung4680.
You WRITE and MANAGE the content. You are the editor and manager of this account's posts.

Account: Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH (Los Angeles) | Real-world drives, tips & honest takes | Dogecoin & gaming
Tone: Natural mix of 해요체 + casual. Honest, practical, light ㅋㅋ when appropriate. No pure 반말, no overly formal.

=== LANGUAGE HARD RULE ===
- KOREAN TRACK ONLY. content must be entirely Korean.
- NO English sentences. Allowed English only as proper nouns: FSD, Cybertruck, Tesla, Model 3, Model S, Model Y, Plaid, LAFC, Grok, Robotaxi, Dogecoin, X.
- suggestedMedia must be in Korean.

=== AUTHENTICITY HARD FILTER ===
- NEVER invent specific personal experiences that did not happen.
- No fake mountain drives, no "yesterday I..." false anecdotes.
- Prefer practical tips, honest opinions, questions, general ownership observations.
- Authenticity 9–10 required.

=== SCREENSHOT / KEYWORD RULE ===
- If images (screenshots) are provided: analyze them, extract themes/keywords/topics.
- Compare with @Seung4680 account character (Tesla owner, FSD tester, LAFC STH, honest practical tone).
- Merge user text keywords + screenshot-derived keywords.
- Only use themes that fit the account; discard off-brand or fake-feeling angles.
- Write posts from the merged keyword set in the account voice.

High-Quality Criteria: Conversation 40%, Velocity 25%, Profile 15%, Authenticity 15%, Media 5%.
Only posts >= 8.0. Mix topics. Concrete suggestedMedia (phone-shootable) in Korean.

Respond in JSON only, no markdown:
{
  "posts": [
    {
      "content": "한국어 포스트 본문만",
      "score": number,
      "suggestedMedia": "한국어 사진/영상 설명",
      "dayOffset": 0,
      "slot": 1
    }
  ],
  "extractedKeywords": ["스샷/키워드에서 뽑은 키워드"],
  "keywordRequest": null or "한국어로 짧은 추가 요청"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      startDate,
      days = 3,
      countPerDay = 4,
      keywords,
      images, // string[] of data URLs or https URLs
    } = body;

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const total = Math.min(days * countPerDay, 12);
    const imageList: string[] = Array.isArray(images)
      ? images.filter((u: string) => typeof u === "string" && u.length > 0).slice(0, 4)
      : [];

    const textPart = `한국어 트랙 전용. @Seung4680용 한국어 포스트 ${total}개를 약 ${days}일분으로 작성하세요. 시작일: ${startDate || "오늘"}.
dayOffset 0,1,2... 와 slot을 나누세요.
${keywords ? `사용자가 준 텍스트 키워드: ${keywords}` : "텍스트 키워드 없음."}
${imageList.length > 0 ? `스크린샷/이미지 ${imageList.length}장이 첨부되어 있습니다. 이미지를 분석해 키워드·주제를 추출하고, 계정 성격과 맞는 것만 텍스트 키워드와 합쳐 포스트를 작성하세요.` : "첨부 이미지 없음."}

필수: content 100% 한국어, 영어 문장 금지, 허위 에피소드 금지, 점수 8.0+, suggestedMedia 한국어.
JSON만 출력.`;

    // Build multimodal user message if images present
    const userContent: any[] = [{ type: "text", text: textPart }];
    for (const img of imageList) {
      userContent.push({
        type: "image_url",
        image_url: { url: img },
      });
    }

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
            content: imageList.length > 0 ? userContent : textPart,
          },
        ],
        temperature: 0.45,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI generate error:", errText);
      return NextResponse.json(
        { error: "Grok API failed", detail: errText.slice(0, 300) },
        { status: 502 }
      );
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

    const koreanPosts = parsed.posts.filter((p: any) => {
      const t = (p.content || "").trim();
      if (!t) return false;
      const latinChars = (t.match(/[A-Za-z]/g) || []).length;
      const totalChars = t.replace(/\s/g, "").length || 1;
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
      extractedKeywords: parsed.extractedKeywords || [],
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
