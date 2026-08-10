import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const FAST_MODEL = "grok-4-fast-non-reasoning";

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSentiment(
  raw: unknown
): "positive" | "neutral" | "negative" | null {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("pos") || s.includes("긍정") || s.includes("호조"))
    return "positive";
  if (s.includes("neg") || s.includes("부정") || s.includes("비판"))
    return "negative";
  if (s.includes("neu") || s.includes("중립") || s.includes("보통"))
    return "neutral";
  return null;
}

/**
 * Fedica keywords = follower vocabulary signals (that day), NOT writing prompts.
 * Larger text in the cloud ≈ higher relative audience attention.
 * Pipeline: visual rank → topKeyword (1 mandatory plan slot upstream) + other signals for system choice.
 */
const EXTRACT_SYSTEM = `You read Fedica follower keyword clouds for @Seung4680.

These keywords are what followers are talking about / associated with — NOT hashtags to paste into posts, NOT post titles.

On Fedica keyword screenshots, LARGER text usually means MORE relative attention. You MUST rank by apparent visual size when an image is present.

Return JSON only:
{
  "keywords": ["all readable keywords, short strings"],
  "rankedKeywords": [
    { "keyword": "exact text as seen", "visualRank": 1, "relativeWeight": "high|medium|low" }
  ],
  "topKeyword": "the single largest / most prominent keyword string",
  "topKeywordInterest": "1 short theme for planning (NOT a raw paste if codename; e.g. Elon Musk → Elon/Tesla ecosystem public conversation)",
  "interests": ["3-8 broader audience themes — not raw keyword dumps"],
  "topicCategories": ["2-6 categories"],
  "sentiment": "positive|neutral|negative|null"
}

ratedKeywords rules:
- visualRank 1 = largest on screen; then 2, 3, ...
- Do NOT invent fake mention counts
- relativeWeight from visual size only: high / medium / low
- If no image, rankedKeywords may be empty; topKeyword may be null

Interest mapping examples:
- Elon Musk → public conversation around Elon / Tesla ecosystem (not stock tips)
- Terafab → AI factory / manufacturing scale
- Optimus → humanoid robotics
- TSLA → long-term Tesla vision (NOT price)
- FSD / HW3 → FSD field experience

Rules:
- keywords stay surface forms; interests are themes
- topicCategories prefer: Manufacturing, AI Infrastructure, Robotics, Mobility, Energy, FSD Field, Long-term Vision, Owner Experience, LAFC, Other, Public Figures
- JSON only`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { images, keywords } = body;
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const imageList: string[] = Array.isArray(images)
      ? images
          .filter((u: unknown) => typeof u === "string" && isHttpUrl(u as string))
          .slice(0, 1)
      : [];

    const textKw =
      typeof keywords === "string" && keywords.trim() ? keywords.trim() : "";

    if (imageList.length === 0 && !textKw) {
      return NextResponse.json({
        keywords: [],
        mergedKeywords: "",
        rankedKeywords: [],
        topKeyword: null,
        topKeywordInterest: null,
        interests: [],
        topicCategories: [],
        sentiment: null,
      });
    }

    const userContent: any[] = [];
    const textParts: string[] = [
      "Extract Fedica audience keyword intelligence.",
      "If an image is attached, rank keywords by visual size (largest = rank 1).",
      "Do NOT treat keywords as post titles to copy.",
    ];
    if (textKw) {
      textParts.push(`Text keywords:\n${textKw}`);
    }
    if (imageList.length > 0) {
      textParts.push(
        "Read the Fedica keyword cloud image. Identify the largest keyword as topKeyword."
      );
    }
    userContent.push({ type: "text", text: textParts.join("\n\n") });
    if (imageList.length > 0) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageList[0] },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);

    let response: Response;
    try {
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: FAST_MODEL,
          messages: [
            { role: "system", content: EXTRACT_SYSTEM },
            { role: "user", content: userContent },
          ],
          temperature: 0.15,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();
    const fallbackKws = textKw
      ? textKw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (!response.ok) {
      return NextResponse.json({
        keywords: fallbackKws,
        mergedKeywords: textKw,
        rankedKeywords: [],
        topKeyword: fallbackKws[0] || null,
        topKeywordInterest: null,
        interests: [],
        topicCategories: [],
        sentiment: null,
        warning: `extract failed: ${rawText.slice(0, 120)}`,
      });
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json({
        keywords: fallbackKws,
        mergedKeywords: textKw,
        rankedKeywords: [],
        topKeyword: fallbackKws[0] || null,
        topKeywordInterest: null,
        interests: [],
        topicCategories: [],
        sentiment: null,
        warning: "extract non-JSON",
      });
    }

    const content = data.choices?.[0]?.message?.content || "{}";
    const match = String(content).match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try {
      parsed = JSON.parse(match ? match[0] : content);
    } catch {
      parsed = {};
    }

    const fromModel = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : [];
    const merged = Array.from(new Set([...fromModel, ...fallbackKws])).slice(0, 16);

    const rankedKeywords = Array.isArray(parsed.rankedKeywords)
      ? parsed.rankedKeywords
          .map((r: any, idx: number) => ({
            keyword: String(r?.keyword || "").trim(),
            visualRank:
              typeof r?.visualRank === "number" && r.visualRank > 0
                ? r.visualRank
                : idx + 1,
            relativeWeight: ["high", "medium", "low"].includes(
              String(r?.relativeWeight || "").toLowerCase()
            )
              ? String(r.relativeWeight).toLowerCase()
              : idx === 0
                ? "high"
                : "medium",
          }))
          .filter((r: any) => r.keyword)
          .sort((a: any, b: any) => a.visualRank - b.visualRank)
          .slice(0, 12)
      : [];

    let topKeyword =
      typeof parsed.topKeyword === "string" && parsed.topKeyword.trim()
        ? parsed.topKeyword.trim()
        : rankedKeywords[0]?.keyword || merged[0] || null;

    let topKeywordInterest =
      typeof parsed.topKeywordInterest === "string" && parsed.topKeywordInterest.trim()
        ? parsed.topKeywordInterest.trim().slice(0, 120)
        : null;

    const interests = Array.isArray(parsed.interests)
      ? parsed.interests
          .map((k: any) => String(k).trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];

    const topicCategories = Array.isArray(parsed.topicCategories)
      ? parsed.topicCategories
          .map((k: any) => String(k).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return NextResponse.json({
      success: true,
      keywords: merged,
      mergedKeywords: merged.join(", "),
      rankedKeywords,
      topKeyword,
      topKeywordInterest,
      interests,
      topicCategories,
      sentiment: normalizeSentiment(parsed.sentiment),
      imageCount: imageList.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({
      keywords: [],
      mergedKeywords: "",
      rankedKeywords: [],
      topKeyword: null,
      topKeywordInterest: null,
      interests: [],
      topicCategories: [],
      sentiment: null,
      warning: err?.name === "AbortError" ? "extract timeout" : err.message,
    });
  }
}
