/**
 * Weekly Planner — Supabase Edge
 * Compact JSON to avoid max_tokens truncation.
 * Engines preserved; no silent fallback.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREATOR_DNA = `creator-dna-v1.3.1: Korean Tesla owner-creator; FSD/product observation; LAFC/gaming ok; no stock daytrade; no invented tests; authenticity high; 음슴체 ok for light opinion.`;
const PERF_DNA = `perf-dna candidates only VALIDATED=0: prefer followers/profile/bookmarks/replies over impressions; never learn from drafts.`;

const SYSTEM = `You plan 7 days of ORIGINAL X posts for @Seung4680.
Output ONLY compact JSON. No markdown. No trailing commentary.
Schema:
{"generationDays":7,"rationale":"short ko","days":[{"dayOffset":0,"posts":[{"slotId":"D1P1","primaryTopic":"...","angle":"...","contentType":"observation","targetLength":"medium","actionType":"ORIGINAL"}]}]}
Rules: dayOffset 0-6; exactly 3 posts per day; primaryTopic creator-framed never raw Fedica keywords; no stock chatter; no invented first-hand tests.`;

function extractJsonObject(raw: string): any | null {
  let t = String(raw || "").trim();
  if (!t) return null;
  t = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const start = t.indexOf("{");
  if (start < 0) return null;
  // Balance braces to find end even if truncated tail has noise
  let depth = 0;
  let end = -1;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  // Last resort: truncated JSON — try close open braces
  if (start >= 0 && depth > 0) {
    let frag = t.slice(start);
    // Remove trailing incomplete string
    frag = frag.replace(/,\s*"[^"]*$/, "");
    frag = frag.replace(/,\s*\{[^{}]*$/, "");
    frag = frag.replace(/,\s*$/, "");
    frag += "}".repeat(depth);
    try {
      return JSON.parse(frag);
    } catch {
      return null;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Missing Authorization", fallback: true, days: [] }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) {
      return json(
        { success: false, error: "XAI_API_KEY missing in secrets", fallback: true, days: [] },
        500
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, error: "Not authenticated", fallback: true, days: [] }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const topic = String(
      body.topic || body.creatorIntent || body.keywords || body.mergedKeywords || ""
    ).trim();
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);

    const interests = Array.isArray(body.interests)
      ? body.interests.map(String).slice(0, 10)
      : [];
    const categories = Array.isArray(body.topicCategories)
      ? body.topicCategories.map(String).slice(0, 8)
      : [];
    const published = Array.isArray(body.publishedTopics)
      ? body.publishedTopics.map(String).slice(0, 8)
      : Array.isArray(body.recentTopics)
        ? body.recentTopics.map(String).slice(0, 8)
        : [];
    const scheduled = Array.isArray(body.scheduledTopics)
      ? body.scheduledTopics.map(String).slice(0, 6)
      : [];

    const userPrompt = `Intent/keywords signal: ${topic || "(none)"}
Audience interests (signals only): ${interests.join(", ") || "(none)"}
Audience categories: ${categories.join(", ") || "(none)"}
Sentiment: ${body.sentiment || "(none)"}
${CREATOR_DNA}
${PERF_DNA}
Avoid repeating published themes: ${published.map((t) => t.slice(0, 40)).join(" | ") || "(none)"}
Avoid scheduled dup: ${scheduled.map((t) => t.slice(0, 40)).join(" | ") || "(none)"}

Return compact JSON only: ${daysCount} days, 3 posts each.`;

    const dna_sources = {
      creator: "runtime_snapshot",
      performance: "baseline_candidates",
      runtime: "supabase_edge_weekly_plan",
      audience_signals: interests.length + categories.length,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

    let rawText = "";
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.35,
          max_tokens: 6000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const errText = await res.text();
        return json(
          {
            success: false,
            error: `xAI ${res.status}`,
            detail: errText.slice(0, 300),
            fallback: true,
            days: [],
            dna_sources,
          },
          502
        );
      }
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      clearTimeout(timer);
      return json(
        {
          success: false,
          error: "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
          detail: e?.name === "AbortError" ? "timeout" : String(e?.message || e).slice(0, 160),
          fallback: true,
          days: [],
          dna_sources,
        },
        503
      );
    }

    const parsed = extractJsonObject(rawText);
    let days: any[] = Array.isArray(parsed?.days) ? parsed.days : [];

    if (days.length === 0) {
      return json(
        {
          success: false,
          error: "주간 계획 결과가 비어 있습니다.",
          detail: `parse_failed_or_empty; raw_preview=${String(rawText).slice(0, 320)}`,
          fallback: true,
          days: [],
          dna_sources,
        },
        503
      );
    }

    for (let i = 0; i < days.length; i++) {
      let posts = Array.isArray(days[i]?.posts) ? days[i].posts : [];
      posts = posts.slice(0, 3).map((p: any, pi: number) => ({
        slotId: String(p.slotId || `D${i + 1}P${pi + 1}`),
        primaryTopic: String(p.primaryTopic || "관찰").slice(0, 80),
        angle: String(p.angle || "").slice(0, 120),
        contentType: String(p.contentType || "observation"),
        allowedContext: [],
        forbiddenTopics: ["주가", "등락"],
        targetLength: ["short", "medium", "long"].includes(p.targetLength)
          ? p.targetLength
          : "medium",
        actionType: "ORIGINAL",
        postStrategy: {
          strategicAngle: String(p.angle || "observation").slice(0, 80),
          writingApproach: "observation",
          experienceUsage: "none",
          hypothesisNote: "Hypothesis only",
        },
      }));
      days[i] = {
        dayOffset: typeof days[i].dayOffset === "number" ? days[i].dayOffset : i,
        posts,
      };
    }

    days = days.filter((d) => d.posts?.length > 0);
    if (!days.length) {
      return json(
        { success: false, error: "주간 계획 슬롯이 비어 있습니다.", fallback: true, days: [], dna_sources },
        503
      );
    }

    return json({
      success: true,
      model: MODEL,
      generationDays: daysCount,
      days,
      rationale: parsed?.rationale || null,
      totalPlanned: days.reduce((s: number, d: any) => s + d.posts.length, 0),
      dna_sources,
      fallback: false,
      engine: "supabase_edge_weekly_plan",
    });
  } catch (err: any) {
    console.error(err);
    return json(
      {
        success: false,
        error: "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
        detail: String(err?.message || err).slice(0, 160),
        fallback: true,
        days: [],
      },
      500
    );
  }
});
