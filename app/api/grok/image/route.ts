import { NextRequest, NextResponse } from "next/server";

/**
 * Optional AI image generation for a post.
 * Uses xAI image capability when available; returns a prompt + guidance
 * so the result stays natural (not overly AI-looking).
 */
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

    // Build a natural, photo-realistic style prompt (avoid obvious AI look)
    const styleGuide =
      "Photorealistic smartphone photo style, natural lighting, real Tesla/Cybertruck or daily life context, not CGI, not illustration, not overly perfect, candid owner photo feel.";

    const fullPrompt = `${prompt || postContent}

Style: ${styleGuide}`;

    // Try xAI images API if present; fall back to refined prompt for manual use
    try {
      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: "grok-imagine",
          prompt: fullPrompt,
          n: 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const url =
          data.data?.[0]?.url ||
          data.url ||
          data.images?.[0]?.url ||
          null;
        if (url) {
          return NextResponse.json({
            success: true,
            imageUrl: url,
            prompt: fullPrompt,
          });
        }
      }
    } catch (e) {
      console.warn("xAI image API not available or failed", e);
    }

    // Fallback: return refined prompt so user can generate elsewhere or we handle later
    return NextResponse.json({
      success: true,
      imageUrl: null,
      prompt: fullPrompt,
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
