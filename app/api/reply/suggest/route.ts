/**
 * POST /api/reply/suggest
 * Explicit Creator action — uses XAI (cost-bearing). No auto-publish.
 * AI suggestions are NOT Creator evidence.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REPLY_SOCIAL_DNA_V1, classifyIncomingReply } from "@/lib/reply/dna";
import { buildSharedCurrentContext } from "@/lib/context";
import {
  requireExplicitApiConsent,
  buildAudit,
  ApiConsentError,
} from "@/lib/api-consent";
import type { ReplySuggestion } from "@/lib/reply/types";

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
        action: "suggest_reply",
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

    const targetText = String(body.target_text || body.comment || "").trim();
    const parentText = String(body.parent_text || "").trim();
    const rootText = String(body.root_text || "").trim();
    const myDraft = String(body.my_draft || "").trim();

    if (!targetText && !myDraft) {
      return NextResponse.json(
        { error: "target_text or pasted comment required" },
        { status: 400 }
      );
    }

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 });
    }

    const shared = buildSharedCurrentContext({
      events: Array.isArray(body.events) ? body.events : [],
      xTopics: Array.isArray(body.xTopics) ? body.xTopics : [],
    });
    const signals = classifyIncomingReply(targetText);

    const system = `You help @Seung4680 write natural X replies. Output JSON only:
{"suggestions":[{"text":"...","style":"SHORT_NATURAL|EXPLAIN|HUMOR","notes":"..."}]}
Rules:
- 1 to 3 suggestions only if meaningfully different
- Korean natural 해요체 + casual; short preferred
- Never invent firsthand driving/match experiences
- Do not auto-add ㅋㅋ unless humor fits
- Not a publishing post — this is a reply
- Do not change Creator's known opinions if my_draft is provided
${REPLY_SOCIAL_DNA_V1.prompt_block}`;

    const userMsg = `Incoming comment:
---
${targetText || "(none)"}
---
Parent: ${parentText || "(none)"}
Root: ${rootText || "(none)"}
Creator draft (optional): ${myDraft || "(none)"}
Detected signals: ${JSON.stringify(signals)}
Shared context:
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
          temperature: 0.65,
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

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Grok non-JSON" }, { status: 502 });
    }

    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: { suggestions?: ReplySuggestion[] };
    try {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : content);
    } catch {
      parsed = { suggestions: [{ text: content.trim(), style: "OTHER" }] };
    }

    const suggestions = (parsed.suggestions || [])
      .filter((s) => s && String(s.text || "").trim())
      .slice(0, 3)
      .map((s) => ({
        text: String(s.text).trim(),
        style: s.style || "SHORT_NATURAL",
        notes: s.notes || null,
      }));

    return NextResponse.json({
      success: true,
      paid_api_called: true,
      audit: buildAudit(consent),
      suggestions,
      signals,
      learning_note: "AI suggestions are NOT Creator evidence. Only actual Creator replies may be learned later.",
      auto_publish: false,
      shared_indicators: shared.indicators,
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
