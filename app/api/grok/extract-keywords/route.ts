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
  if (s.includes("pos") || s.includes("귵정") || s.includes("호조"))
    return "positive";
  if (s.includes("neg") || s.includes("부정") || s.includes("비판"))
    return "negative";
  if (s.includes("neu") || s.includes("중립") || s.includes("보통"))
    return "neutral";
  return null;
}

/**
 * Fedica keywords are audience signals, NOT writing prompts.
 * Pipeline: Keywords → Keyword Intelligence → Interests → Topic Categories
 */
const EXTRACT_SYSTEM = `You convert Fedica follower keywords into Audience Intelligence for @Seung4680 (Tesla / FSD / Cybertruck / LAFC creator).

Fedica keywords are NOT hashtags, NOT post topics to copy, NOT sentences to write.
They only explain what the audience currently cares about.

Return JSON only:
{
  "keywords": ["surface signals as given — short strings"],
  "interests": ["3-8 broader themes the audience cares about — NEVER raw keyword copies"],
  "topicCategories": ["2-6 reusable planning categories"],
  "sentiment": "positive|neutral|negative|null"
}

Interpretation examples (do this kind of transform):
- "Grimes County Texas" → interest: manufacturing expansion / AI infrastructure; category: Manufacturing
- "Terafab" → interest: AI factory scale / vertical integration; category: AI Infrastructure
- "Optimus" → interest: humanoid robotics / future of labor; category: Robotics
- "TSLA" → interest: long-term Tesla vision (NOT stock price chatter); category: Long-term Vision
- "Megapack" → category: Energy
- "Robotaxi" / "Cybercab" → category: Mobility
- "FSD" / "HW3" / "v14" → category: FSD Field

Rules:
- interests must be themes, not place names or product codenames pasted as-is
- topicCategories prefer: Manufacturing, AI Infrastructure, Robotics, Mobility, Energy, FSD Field, Long-term Vision, Owner Experience, LAFC, Other
- Discard pure stock-trading noise when possible; if TSLA appears, map to long-term product/vision not price
- sentiment = mood of the keyword set if inferable; else null
- JSON only, no prose`;

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
        interests: [],
        topicCategories: [],
        sentiment: null,
      });
    }

    const userContent: any[] = [];
    const textParts: string[] = [
      "Convert the following Fedica audience signals into Audience Intelligence.",
      "Do NOT treat keywords as post titles or phrases to insert.",
    ];
    if (textKw) {
      textParts.push(`Text keywords:\n${textKw}`);
    }
    if (imageList.length > 0) {
      textParts.push(
        "Also read keywords from the attached Fedica screenshot if present."
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
          temperature: 0.2,
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
    const merged = Array.from(new Set([...fromModel, ...fallbackKws])).slice(
      0,
      12
    );

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
      interests: [],
      topicCategories: [],
      sentiment: null,
      warning: err?.name === "AbortError" ? "extract timeout" : err.message,
    });
  }
}
