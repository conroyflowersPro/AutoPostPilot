/**
 * POST /api/grok/transform
 * modes: POLISH | AI_WRITE
 * Creator-initiated text is the source. No topic/prompt box.
 * Never invent firsthand experience.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticityGate } from "@/lib/performance-evidence/authenticity-gate";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const POLISH_SYSTEM = `You are an editor for a Korean X creator (@Seung4680 voice).
Your job is POLISH only — improve readability for X without changing substance.

PRESERVE:
- claims, opinions, experience, jokes, emotion, intensity, uncertainty, intent
- natural 해요체/casual mix; do not make formal or corporate
- meaning of slang/emotion (e.g. "거시기다" must not become bland praise)

DO NOT:
- invent driving experiences, numbers, places, incidents, purchases, visits, others' reactions
- add new facts not in the input
- rewrite into a different opinion
- add engagement bait questions

Output JSON only: {"text":"...","notes":"optional short note"}`;

const AI_WRITE_SYSTEM = `You write a complete X post for a Korean Tesla owner creator.
The creator already provided raw thoughts/context in the user message.
This is CREATOR-INITIATED: they chose the topic. You only compose the post.

Rules:
- Use only: their input + verified general knowledge + non-invented context
- NEVER invent firsthand experience (miles driven, specific trips, accidents, family actions)
- If detail is missing, omit it or stay general — do not fabricate
- Natural conversational Korean; product names may stay English
- Match their emotional intensity; do not sanitize "거시기" into corporate tone
- No generic engagement bait endings
- Current Creator Intent > historical average length (respect length_control)

Output JSON only: {"text":"...","notes":"optional"}`;

function lengthHint(control: string): string {
  switch (control) {
    case "SHORT":
      return "Keep it short (1–3 short sentences).";
    case "MEDIUM":
      return "Medium length (roughly a short paragraph or two).";
    case "LONG":
      return "Allow a longer post if substance supports it.";
    case "VERY_LONG":
      return "Creator wants depth — longer form OK, still coherent.";
    case "KEEP":
      return "Stay close to the input length.";
    default:
      return "Choose a natural length for the content; do not force short.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const mode = String(body.mode || "").toUpperCase();
    const input = String(body.text || "").trim();
    const lengthControl = String(body.length_control || "AUTO").toUpperCase();
    const initiative = String(body.initiative_origin || "CREATOR_INITIATED");

    if (!input) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    if (mode !== "POLISH" && mode !== "AI_WRITE") {
      return NextResponse.json(
        { error: "mode must be POLISH or AI_WRITE" },
        { status: 400 }
      );
    }

    const gate = authenticityGate({
      intendedProvenance: "FIRSTHAND",
      evidenceBacked: true,
      draftText: input,
    });

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const system = mode === "POLISH" ? POLISH_SYSTEM : AI_WRITE_SYSTEM;
    const userMsg = `Creator raw input (do not invent extra firsthand facts):
---
${input}
---
length_control: ${lengthControl}
${lengthHint(lengthControl)}
initiative_origin: ${initiative}
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
          temperature: mode === "POLISH" ? 0.35 : 0.7,
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

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Grok non-JSON envelope", detail: rawText.slice(0, 200) },
        { status: 502 }
      );
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: { text?: string; notes?: string };
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    } catch {
      parsed = { text: raw.trim() };
    }

    const out = (parsed.text || "").trim();
    if (!out) {
      return NextResponse.json(
        { error: "Empty transform result" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      mode,
      text: out,
      notes: parsed.notes || null,
      initiative_origin: initiative,
      ai_transformation: mode === "POLISH" ? "POLISH" : "GENERATIVE_REWRITE",
      creator_raw_input: input,
      authenticity: gate,
      model: MODEL,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "변환 시간 초과"
        : err instanceof Error
          ? err.message
          : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
