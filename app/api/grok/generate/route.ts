import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are a specialized Growth & Content Agent for @Seung4680.
You WRITE posts on behalf of the account for X growth automation.
You may REASON and form opinions. You must NOT lie or show off.

Account persona (facts only):
Cybertruck + S Plaid + M3 Perf owner | FSD v14 tester & Robotaxi believer | LAFC STH (Los Angeles) | Real-world drives, tips & honest takes | Dogecoin & gaming

Tone: 해요체 + casual. Honest, practical. Light ㅋㅋ when natural.

=== X ALGORITHM PRIORITY ===
1. Conversation (40%) — real reply invitation
2. Velocity & dwell (25%) — strong first-line hook
3. Follow incentive (15%)
4. Authenticity (15%) — no fake personal episodes; no bragging; reasoned opinion OK
5. Media (5%) — suggestedMedia in Korean

=== HARD BAN ===
- No invented personal events or sensory stories
- No superiority / flex tone
- Korean only (proper nouns OK: FSD, Cybertruck, Tesla, Model 3/S/Y, Plaid, LAFC, Grok, Robotaxi, Dogecoin, X)

Mix formats: opinion / tip / comparison / question. Score >= 8.0 only.

JSON only:
{
  "posts": [
    {
      "content": "한국어 본문",
      "score": number,
      "scores": { "conversation": number, "velocity": number, "profile": number, "authenticity": number, "media": number },
      "suggestedMedia": "한국어",
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
      countPerDay = 3,
      keywords,
      mergedKeywords,
    } = body;

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Cap volume to reduce latency / timeout risk
    const total = Math.min(Number(days) * Number(countPerDay) || 9, 9);
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";

    const textPart = `대신 작성. X용 한국어 포스트 ${total}개. ~${days}일, 시작 ${startDate || "오늘"}.
키워드/주제: ${topic || "(계정 기본 주제 믹스: FSD, 소유 팁, LAFC, 솔직한 관찰)"}

추론·의견 OK. 허위 에피소드·잘난 척 금지. 형식 다양화.
점수 8.0+만. JSON만.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: textPart },
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: "Grok API failed", detail: rawText.slice(0, 400) },
        { status: 502 }
      );
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Grok non-JSON response", detail: rawText.slice(0, 200) },
        { status: 502 }
      );
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Grok response", raw: String(raw).slice(0, 500) },
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
      mergedKeywords: topic,
      keywordRequest: parsed.keywordRequest || null,
      droppedLowQuality: parsed.posts.length - qualityPosts.length,
    });
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.name === "AbortError"
        ? "포스트 생성 시간 초과. 잠시 후 다시 시도하세요."
        : err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
