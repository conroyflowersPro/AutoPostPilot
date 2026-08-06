import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for the X account @Seung4680.
You WRITE posts optimized for the X ranking algorithm. You are the editor and manager.

Account: Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH (Los Angeles) | Real-world drives, tips & honest takes | Dogecoin & gaming
Tone: 해요체 + casual. Honest, practical, light ㅋㅋ when it fits. No pure 반말, no stiff formal speech.

=== X ALGORITHM WRITING RULES (priority) ===
1. Conversation Potential (40%) — MUST invite replies.
   - End with a real question or 2–3 choice options people can answer in one line.
   - Ask about their setup, habit, preference, or disagree/agree — not rhetorical fluff.
2. Early Velocity & Dwell (25%) — First line must hook in under 1 second.
   - Strong opening observation or tension. Avoid soft openers like "오늘은요", "문득".
   - Keep readable on mobile; short paragraphs / line breaks OK.
3. Profile & Follow Incentive (15%) — Subtle signal why following this account is useful
   (owner tips, FSD reality, LAFC fan, honest takes) without hard sell.
4. Authenticity & Brand Fit (15%) — HARD FILTER
   - NEVER invent specific personal events (no fake mountain drives, no "어제 ~했다" false stories).
   - General patterns OK: "주차할 때 느끼는 점", "FSD 쓰다 보면".
5. Media (5%) — every post needs concrete phone-shootable suggestedMedia in Korean.

=== LANGUAGE ===
- Korean only in content. English only as proper nouns: FSD, Cybertruck, Tesla, Model 3/S/Y, Plaid, LAFC, Grok, Robotaxi, Dogecoin, X.

=== QUALITY BAR ===
- Only output posts you would score >= 8.0 weighted.
- Reject bland generic Tesla news. Mix FSD tips, ownership observations, LAFC, light daily honest takes.
- Prefer one sharp idea per post over laundry lists.

=== GOOD STRUCTURE EXAMPLE (pattern, not copy) ===
Hook line → 1–2 concrete observations → question that invites reply.

Respond JSON only, no markdown:
{
  "posts": [
    {
      "content": "한국어 본문",
      "score": number,
      "scores": {
        "conversation": number,
        "velocity": number,
        "profile": number,
        "authenticity": number,
        "media": number
      },
      "suggestedMedia": "한국어 사진/영상 설명",
      "dayOffset": 0,
      "slot": 1
    }
  ],
  "extractedKeywords": [],
  "keywordRequest": null
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      startDate,
      days = 3,
      countPerDay = 4,
      keywords,
      images,
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

    const textPart = `X 알고리즘 최적화 한국어 포스트 ${total}개 (@Seung4680). ~${days}일, 시작 ${startDate || "오늘"}.
dayOffset / slot 배분.
${keywords ? `키워드: ${keywords}` : ""}
${imageList.length > 0 ? `첨부 이미지 ${imageList.length}장 분석 후 계정에 맞는 키워드만 병합.` : ""}

필수:
- content 100% 한국어 + 답글 유도 질문
- 첫 줄 훅
- 허위 에피소드 금지
- 가중 점수 8.0 미만 글은 출력하지 말 것
- suggestedMedia 한국어
JSON만.`;

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
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: imageList.length > 0 ? userContent : textPart,
          },
        ],
        temperature: 0.65,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI generate error:", errText);
      return NextResponse.json(
        { error: "Grok API failed", detail: errText.slice(0, 400) },
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

    const qualityPosts = parsed.posts.filter((p: any) => {
      const t = (p.content || "").trim();
      if (!t) return false;
      const latinChars = (t.match(/[A-Za-z]/g) || []).length;
      const totalChars = t.replace(/\s/g, "").length || 1;
      if (latinChars / totalChars >= 0.35) return false;
      const score = typeof p.score === "number" ? p.score : 0;
      return score >= 8.0;
    });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const inserted = [];

    for (const p of qualityPosts) {
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
          scores: p.scores,
          suggestedMedia: p.suggestedMedia,
          dayOffset,
          slot: p.slot,
        });
      }
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      count: inserted.length,
      posts: inserted,
      extractedKeywords: parsed.extractedKeywords || [],
      keywordRequest: parsed.keywordRequest || null,
      droppedLowQuality: parsed.posts.length - qualityPosts.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
