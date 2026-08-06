import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function callGrok(
  xaiKey: string,
  messages: any[],
  temperature: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Grok ${response.status}: ${text.slice(0, 300)}`);
    }
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Grok non-JSON: ${text.slice(0, 200)}`);
    }
    return data.choices?.[0]?.message?.content || "{}";
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
}

async function extractKeywordsFromImages(
  xaiKey: string,
  imageUrls: string[],
  textKeywords?: string
): Promise<string[]> {
  const limited = imageUrls.slice(0, 2);
  const userContent: any[] = [
    {
      type: "text",
      text: `Extract 5–12 short Korean topic keywords from these screenshots for @Seung4680 (Tesla/FSD/Cybertruck/LAFC/honest tips). Discard off-brand topics.
${textKeywords ? `Also merge text keywords: ${textKeywords}` : ""}
JSON only: { "keywords": ["..."] }`,
    },
  ];
  for (const url of limited) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const raw = await callGrok(
    xaiKey,
    [
      {
        role: "system",
        content:
          "Extract keywords only. JSON only. No posts. Korean short phrases.",
      },
      { role: "user", content: userContent },
    ],
    0.2
  );

  try {
    const parsed = parseJsonObject(raw);
    const kws = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    return kws.map((k: any) => String(k)).filter(Boolean).slice(0, 12);
  } catch {
    return textKeywords ? [textKeywords] : [];
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
          .slice(0, 2)
      : [];

    let mergedKeywords = typeof keywords === "string" ? keywords.trim() : "";
    let extractedFromImages: string[] = [];

    if (imageList.length > 0) {
      try {
        extractedFromImages = await extractKeywordsFromImages(
          xaiKey,
          imageList,
          mergedKeywords || undefined
        );
        if (extractedFromImages.length) {
          const set = new Set(
            [
              ...extractedFromImages,
              ...(mergedKeywords ? mergedKeywords.split(/[,，]/) : []),
            ]
              .map((s) => s.trim())
              .filter(Boolean)
          );
          mergedKeywords = Array.from(set).join(", ");
        }
      } catch (e) {
        console.error("keyword extract failed", e);
      }
    }

    const textPart = `대신 작성. X용 한국어 포스트 ${total}개. ~${days}일, 시작 ${startDate || "오늘"}.
키워드/주제: ${mergedKeywords || "(없음 — 계정 기본 주제 믹스)"}

추론·의견 OK. 허위 에피소드·잘난 척 금지. 형식 다양화.
점수 8.0+만. JSON만.`;

    const raw = await callGrok(
      xaiKey,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: textPart },
      ],
      0.7
    );

    let parsed: any;
    try {
      parsed = parseJsonObject(raw);
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
      extractedKeywords:
        extractedFromImages.length > 0
          ? extractedFromImages
          : parsed.extractedKeywords || [],
      mergedKeywords,
      keywordRequest: parsed.keywordRequest || null,
      droppedLowQuality: parsed.posts.length - qualityPosts.length,
      imageCount: imageList.length,
    });
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.name === "AbortError"
        ? "Grok 요청 시간 초과. 스샷 수를 줄이거나 잠시 후 다시 시도하세요."
        : err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
