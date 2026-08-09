/**
 * POST /api/reply/polish
 * Explicit Creator action. Preserve meaning. No invented experience. No auto-publish.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REPLY_SOCIAL_DNA_V1 } from "@/lib/reply/dna";
import { buildSharedCurrentContext } from "@/lib/context";
import {
  requireExplicitApiConsent,
  buildAudit,
  ApiConsentError,
} from "@/lib/api-consent";

export const maxDuration = 26;
const MODEL = "grok-4.5";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    let consent;
    try {
      consent = requireExplicitApiConsent(body, {
        feature: "reply_manual",
        action: "polish_reply",
        service: "XAI_GROK",
      });
    } catch (err) {
      if (err instanceof ApiConsentError) {
        return NextResponse.json(
          { error: err.message, code: "API_CONSENT_REQUIRED", paid_api_called: false },
          { status: 402 }
        );
      }
      throw err;
    }

    const myReply = String(body.my_reply || body.text || "").trim();
    const targetText = String(body.target_text || "").trim();
    if (!myReply) {
      return NextResponse.json({ error: "my_reply required" }, { status: 400 });
    }

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 });
    }

    const shared = buildSharedCurrentContext({
      events: Array.isArray(body.events) ? body.events : [],
      xTopics: Array.isArray(body.xTopics) ? body.xTopics : [],
    });

    const system = `You polish an X reply for @Seung4680. Output JSON: {"text":"...","notes":"..."}
Preserve meaning, opinion, intensity. Fix awkwardness only.
Do not add new claims, promo, or invented experience.
Keep short conversational register.
${REPLY_SOCIAL_DNA_V1.prompt_block}`;

    const userMsg = `Incoming comment (context):
${targetText || "(none)"}

Creator reply to polish:
---
${myReply}
---
${shared.prompt_block}
Return JSON only.`;

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
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
          temperature: 0.35,
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

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: { text?: string; notes?: string };
    try {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : content);
    } catch {
      parsed = { text: content.trim() };
    }

    const out = (parsed.text || "").trim() || myReply;

    return NextResponse.json({
      success: true,
      paid_api_called: true,
      audit: buildAudit(consent),
      text: out,
      notes: parsed.notes || null,
      creator_raw_reply: myReply,
      ai_transformation: "POLISH",
      learning_note: "Polished text is still AI-assisted until Creator publishes their own words.",
      auto_publish: false,
      model: MODEL,
    });
  } catch (e: unknown) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "시간 초과"
        : e instanceof Error
          ? e.message
          : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
