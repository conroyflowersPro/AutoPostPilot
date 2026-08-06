import { NextRequest, NextResponse } from "next/server";

const STYLE =
  "Photorealistic smartphone photo, natural lighting, candid owner feel, not CGI, not illustration, not overly perfect.";

function variantPrompts(base: string): string[] {
  const angles = [
    "slightly wide shot, everyday context",
    "closer detail, natural handheld framing",
    "side angle, soft afternoon light",
    "simple background, honest real-life look",
  ];
  return angles.map((a) => `${base}\n\nStyle: ${STYLE}\nVariation: ${a}`);
}

async function tryGenerateOne(
  xaiKey: string,
  prompt: string
): Promise<string | null> {
  const models = ["grok-imagine", "grok-2-image"];
  for (const model of models) {
    try {
      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({ model, prompt, n: 1 }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const url =
        data.data?.[0]?.url ||
        data.url ||
        data.images?.[0]?.url ||
        null;
      if (url) return url as string;
    } catch {
      // try next model
    }
  }
  return null;
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
    const prompts = variantPrompts(base);

    // Generate up to 4 candidates in parallel
    const results = await Promise.all(
      prompts.map((p) => tryGenerateOne(xaiKey, p))
    );
    const candidates = results.filter((u): u is string => !!u);

    if (candidates.length > 0) {
      return NextResponse.json({
        success: true,
        candidates,
        imageUrl: candidates[0],
        prompt: prompts[0],
      });
    }

    return NextResponse.json({
      success: true,
      candidates: [],
      imageUrl: null,
      prompt: prompts[0],
      message:
        "이미지 API 직접 생성이 제한되어 있습니다. 아래 프롬프트로 생성하거나, 폰으로 직접 촬영해 업로드해주세요.",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
