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
      });
    }

    const userContent: any[] = [
      {
        type: "text",
        text: `Extract 5–8 short Korean topic keywords for @Seung4680 (Tesla/FSD/Cybertruck/LAFC). Discard off-brand.
${textKw ? `Merge text: ${textKw}` : ""}
JSON only: { "keywords": ["..."] }`,
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
              content: "Extract keywords only. JSON only.",
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
      // Fail soft — return text keywords
      return NextResponse.json({
        keywords: textKw
          ? textKw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
          : [],
        mergedKeywords: textKw,
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

    return NextResponse.json({
      success: true,
      keywords: merged,
      mergedKeywords: merged.join(", "),
      imageCount: imageList.length,
    });
  } catch (err: any) {
    console.error(err);
    // Always fail soft so generate can continue
    const textKw =
      typeof (await req.clone().json().catch(() => ({}))).keywords === "string"
        ? (await req.clone().json().catch(() => ({}))).keywords
        : "";
    return NextResponse.json({
      keywords: [],
      mergedKeywords: "",
      warning: err?.name === "AbortError" ? "extract timeout" : err.message,
    });
  }
}
