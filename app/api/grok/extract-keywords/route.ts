import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const FAST_MODEL = "grok-4-fast-non-reasoning";
const FALLBACK_MODEL = "grok-4.5";

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function callExtract(xaiKey: string, model: string, userContent: any[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Extract short Korean topic keywords for X posts. JSON only: { \"keywords\": [\"...\"] }. No posts.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Grok ${response.status}: ${text.slice(0, 250)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
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
          .slice(0, 2)
      : [];

    const textKw =
      typeof keywords === "string" && keywords.trim() ? keywords.trim() : "";

    if (imageList.length === 0 && !textKw) {
      return NextResponse.json({ keywords: [], mergedKeywords: "" });
    }

    if (imageList.length === 0) {
      return NextResponse.json({
        keywords: textKw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean),
        mergedKeywords: textKw,
      });
    }

    const userContent: any[] = [
      {
        type: "text",
        text: `Extract 5–10 short Korean topic keywords from these screenshots for @Seung4680 (Tesla, FSD, Cybertruck, LAFC, honest tips). Discard off-brand.
${textKw ? `Also include text keywords: ${textKw}` : ""}
JSON only: { "keywords": ["..."] }`,
      },
    ];
    for (const url of imageList) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    let data: any;
    try {
      data = await callExtract(xaiKey, FAST_MODEL, userContent);
    } catch {
      data = await callExtract(xaiKey, FALLBACK_MODEL, userContent);
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
    const merged = Array.from(new Set([...fromImages, ...fromText])).slice(0, 12);

    return NextResponse.json({
      success: true,
      keywords: merged,
      mergedKeywords: merged.join(", "),
      imageCount: imageList.length,
    });
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.name === "AbortError"
        ? "키워드 추출 시간 초과. 스샷 1장만 넣어 보세요."
        : err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
