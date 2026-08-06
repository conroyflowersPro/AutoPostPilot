import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const STYLE =
  "Photorealistic smartphone photo, natural lighting, candid owner feel, not CGI.";

const MODELS = ["grok-imagine-image", "grok-imagine-image-quality"] as const;

function extractUrls(data: any): string[] {
  const list = data?.data || data?.images || [];
  if (!Array.isArray(list)) {
    const single = data?.url || data?.data?.[0]?.url;
    return single ? [single] : [];
  }
  return list
    .map((item: any) => item?.url || null)
    .filter(
      (u: string | null) => !!u && typeof u === "string" && u.startsWith("http")
    );
}

async function generateBatch(
  xaiKey: string,
  prompt: string,
  n: number
): Promise<{ urls: string[]; error?: string; model?: string }> {
  let lastError = "";

  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n,
          aspect_ratio: "1:1",
          response_format: "url",
        }),
        signal: controller.signal,
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        lastError = `Invalid JSON (${res.status})`;
        continue;
      }

      if (!res.ok) {
        lastError =
          data.error?.message ||
          data.message ||
          data.error ||
          `HTTP ${res.status}`;
        continue;
      }

      const urls = extractUrls(data);
      if (urls.length > 0) return { urls, model };
      lastError = `No URLs from ${model}`;
    } catch (e: any) {
      lastError =
        e?.name === "AbortError" ? "이미지 생성 시간 초과" : e.message || String(e);
    } finally {
      clearTimeout(timer);
    }
  }

  return { urls: [], error: lastError };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, postContent } = await req.json();

    if (!prompt && !postContent) {
      return NextResponse.json(
        { error: "prompt or postContent required" },
        { status: 400 }
      );
    }

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const base = (prompt || postContent || "").toString().slice(0, 500);
    const fullPrompt = `${base}\n\nStyle: ${STYLE}`;

    // Only 2 samples to stay under Netlify timeout
    const { urls, error, model } = await generateBatch(xaiKey, fullPrompt, 2);

    if (urls.length > 0) {
      return NextResponse.json({
        success: true,
        candidates: urls,
        imageUrl: urls[0],
        prompt: fullPrompt,
        model,
      });
    }

    return NextResponse.json({
      success: false,
      candidates: [],
      imageUrl: null,
      prompt: fullPrompt,
      error: error || "unknown",
      message: `이미지 생성 실패/시간초과. 폰 사진첩에서 직접 올려주세요. (${error || ""})`,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
