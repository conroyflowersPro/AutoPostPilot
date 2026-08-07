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

function normalizeSentiment(raw: unknown): "positive" | "neutral" | "negative" | null {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("pos") || s.includes("긍정") || s.includes("호조")) return "positive";
  if (s.includes("neg") || s.includes("부정") || s.includes("비판")) return "negative";
  if (s.includes("neu") || s.includes("중립") || s.includes("보통")) return "neutral";
  return null;
}

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

    if (imageList.length === 0) {
      const kws = textKw
        ? textKw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
        : [];
      return NextResponse.json({
        keywords: kws,
        mergedKeywords: textKw,
        interests: kws.slice(0, 8),
        sentiment: null,
      });
    }

    const userContent: any[] = [
      {
        type: "text",
        text: `You analyze a Fedica follower-keyword screenshot for @Seung4680 (Tesla owner / FSD / Cybertruck / LAFC).

Return JSON only:
{
  "keywords": ["5-8 short topic keywords from the image"],
  "interests": ["3-8 broader audience interest themes inferred from keywords — not raw keyword copies"],
  "sentiment": "positive|neutral|negative|null"
}

Rules:
- keywords = surface signals from the screenshot
- interests = what the audience seems to care about (e.g. Terafab → AI infrastructure / compute)
- sentiment = overall mood of the follower interest list if visible; otherwise null
- Discard off-brand noise
${textKw ? `Also merge text keywords: ${textKw}` : ""}`,
      },
      { type: "image_url", image_url: { url: imageList[0] } },
    ];

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
            {
              role: "system",
              content:
                "Audience intelligence extraction for X creator. JSON only. No prose.",
            },
            { role: "user", content: userContent },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({
        keywords: textKw
          ? textKw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
          : [],
        mergedKeywords: textKw,
        interests: [],
        sentiment: null,
        warning: `vision extract failed: ${text.slice(0, 120)}`,
      });
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        keywords: textKw ? [textKw] : [],
        mergedKeywords: textKw,
        interests: [],
        sentiment: null,
        warning: "vision non-JSON",
      });
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    const match = String(raw).match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try {
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      parsed = { keywords: [] };
    }

    const fromImages = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : [];
    const fromText = textKw
      ? textKw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
      : [];
    const merged = Array.from(new Set([...fromImages, ...fromText])).slice(0, 10);

    const interests = Array.isArray(parsed.interests)
      ? parsed.interests.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 10)
      : merged.slice(0, 6);

    return NextResponse.json({
      success: true,
      keywords: merged,
      mergedKeywords: merged.join(", "),
      interests,
      sentiment: normalizeSentiment(parsed.sentiment),
      imageCount: imageList.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({
      keywords: [],
      mergedKeywords: "",
      interests: [],
      sentiment: null,
      warning: err?.name === "AbortError" ? "extract timeout" : err.message,
    });
  }
}
