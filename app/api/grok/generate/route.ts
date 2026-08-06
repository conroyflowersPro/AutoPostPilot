import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You write X posts for @Seung4680 (Korean only).
Persona: Cybertruck + S Plaid + M3 Perf | FSD tester & Robotaxi believer | LAFC STH | honest tips | Dogecoin & gaming
Tone: 해요체 + casual.

Must: reply-inviting question, first-line hook.
OK: opinion, tips, comparisons.
BAN: fake personal episodes, bragging, English sentences (proper nouns OK).

Return exactly the requested number of posts. JSON only:
{"posts":[{"content":"한국어","score":8,"suggestedMedia":"한국어","slot":1}]}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      startDate,
      count = 3,
      dayOffset = 0,
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

    const total = Math.min(Math.max(Number(count) || 3, 1), 3);
    const offset = typeof dayOffset === "number" ? dayOffset : 0;
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";

    const textPart = `한국어 포스트 정확히 ${total}개. dayOffset=${offset}. 시작일: ${startDate || "오늘"}.
주제: ${topic || "FSD, 소유 팁, LAFC, 솔직한 관찰"}
추론 OK / 허위 경험 금지 / 답글 질문 필수. JSON만.`;

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
          temperature: 0.75,
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

    // Soft filter: keep Korean posts; don't drop for self-score
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
