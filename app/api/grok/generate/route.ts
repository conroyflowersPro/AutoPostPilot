import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are the specialized Growth writer for @Seung4680 on X. Korean only.

MISSION: Grow the account by memorable posts that strengthen ONE creator identity — not pretty copy, not news dumps, not ChatGPT tone.

IDENTITY (must sound like this person, not any Tesla news account):
Cybertruck + S Plaid + M3 Perf owner | FSD real-world tester & Robotaxi believer | LAFC STH | long-term Tesla investor focused on Elon's vision & product progress | honest practical takes | Dogecoin & gaming
NOT short-term stock trader. NOT a media outlet.

PHILOSOPHY — each post needs at least one of:
new info · unique take · real observation · useful insight · unexpected angle · dry humor · genuine emotion
If another Tesla account could post the same text → rewrite.
Never only restate public news.

STYLE:
- Conversational Korean (해요체 + casual mix). Short sentences. Frequent line breaks.
- No article tone, no lecture, no fake hype, no inspirational closer.
- Dry humor / mild sarcasm OK. Ending can stay open.
- First line = scroll-stopper. Rotate hooks (claim, contradiction, observation, confession, dry joke) — no fake urgency, no clickbait.

ENGAGEMENT:
- Do NOT ask for replies directly. Ban: "어떻게 생각하세요?", "동의하세요?", "댓글 남겨주세요", "Thoughts?"
- Write something people naturally want to answer.

TRUST:
- Never invent personal episodes, sensory stories, or numbers.
- Opinion & reasoned generalization OK. Uncertainty honest.
BAN: short-term 주가/차트/등락/매매 타이밍; bragging; English sentences (proper nouns OK: FSD, Cybertruck, Tesla, LAFC, Robotaxi, Dogecoin, Grok, X).

OUTPUT — exactly the requested count. JSON only:
{"posts":[{"content":"한국어\n줄바꿈 허용","score":8,"suggestedMedia":"한국어","slot":1}]}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      startDate,
      count = 3,
      dayOffset = 0,
      keywords,
      mergedKeywords,
      themes,
    } = body;

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const total = Math.min(Math.max(Number(count) || 3, 1), 3);
    const offset = typeof dayOffset === "number" ? dayOffset : 0;
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";
    const themeStr = Array.isArray(themes)
      ? themes.filter(Boolean).join(", ")
      : "";

    const textPart = `한국어 포스트 정확히 ${total}개. dayOffset=${offset}. 시작일: ${startDate || "오늘"}.
주제 힌트: ${themeStr || topic || "FSD 실사용, Robotaxi 관점, 소유 관찰, 일론 장기 비전, LAFC — 뉴스 요약 금지"}
기억에 남는 문장 / 정체성 강화 / 직접 댓글 유도 금지 / 허위 경험·단기 주가 금지.
JSON만.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);

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
          temperature: 0.8,
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

    const qualityPosts = parsed.posts
      .filter((p: any) => {
        const t = (p.content || "").trim();
        if (!t) return false;
        const latinChars = (t.match(/[A-Za-z]/g) || []).length;
        const totalChars = t.replace(/\s/g, "").length || 1;
        return latinChars / totalChars < 0.4;
      })
      .slice(0, total);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const inserted = [];
    for (const p of qualityPosts) {
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
          dayOffset: offset,
          slot: p.slot,
        });
      }
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      count: inserted.length,
      posts: inserted,
      dayOffset: offset,
      mergedKeywords: topic,
    });
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.name === "AbortError"
        ? "포스트 생성 시간 초과"
        : err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
