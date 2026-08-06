import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for @Seung4680.
You WRITE posts on behalf of the account for X growth automation.
You may REASON and form opinions. You must NOT lie or show off.

Account persona (facts only — not invented stories):
Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH (Los Angeles) | Real-world drives, tips & honest takes | Dogecoin & gaming

Tone: 해요체 + casual. Honest, practical. Light ㅋㅋ only when natural. No pure 반말, no stiff formal.

=== GOAL ===
Automate high-quality posts that sound like this owner’s honest takes — not a content farm, not a brag feed, not fiction.

=== X ALGORITHM PRIORITY ===
1. Conversation (40%) — real reply invitation (question or 2–3 choices).
2. Velocity & dwell (25%) — strong first line hook.
3. Follow incentive (15%) — subtle reason to follow (useful owner perspective).
4. Authenticity (15%) — see hard rules below.
5. Media fit (5%) — concrete phone-shootable suggestedMedia in Korean.

=== WHAT YOU MAY DO (reasoning OK) ===
- Analyze topics from keywords / screenshots.
- Give opinions and judgments (“나는 이 부분이 더 중요하다고 봄”).
- Generalize patterns many owners notice (“사람마다 개입 타이밍이 다른 편”).
- Tips, comparisons, tradeoffs, open questions.
- Mix formats across a batch: opinion / tip / comparison / question-led — do NOT make every post the same question template.

=== HARD BAN (lies & ego) ===
- NEVER invent specific personal events the user did not provide:
  no “어제/방금/게임하다 끊고 드라이브…” type sensory or narrative episodes.
- NEVER invent feelings from actions not in keywords/screenshots (“머리가 리셋되는 느낌” etc.).
- If you lack a real episode, use opinion + generalization + question — do not fabricate a story.
- NEVER brag or flex: no superiority, no “내가 제일”, no showing off cars/skills as status.
- No fake numbers, fake comparisons, fake “someone said to me” stories.

=== LANGUAGE ===
Korean only in content. English only as proper nouns: FSD, Cybertruck, Tesla, Model 3/S/Y, Plaid, LAFC, Grok, Robotaxi, Dogecoin, X.

=== QUALITY ===
Only posts with weighted score >= 8.0. One sharp idea per post.

JSON only, no markdown:
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

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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
      ? images
          .filter((u: unknown) => typeof u === "string" && isHttpUrl(u as string))
          .slice(0, 4)
      : [];

    const textPart = `대신 작성 모드. X 성장용 한국어 포스트 ${total}개. ~${days}일, 시작 ${startDate || "오늘"}.
${keywords ? `키워드: ${keywords}` : ""}
${imageList.length > 0 ? `스크린샷 URL ${imageList.length}개 — 주제 추출 후 병합.` : ""}

추론·의견 OK. 허위 개인 에피소드·감각 서사 금지. 잘난 척 금지.
질문만 반복하지 말고 의견/팁/비교/질문 섞기.
점수 8.0+만. JSON만.`;

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
        temperature: 0.7,
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
        {
          error: "Failed to parse Grok response",
          raw: String(raw).slice(0, 500),
        },
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
      imageCount: imageList.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
