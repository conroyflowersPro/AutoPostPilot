/**
 * Weekly Planner — Supabase Edge
 * Engines: Creator Intent + Creator DNA + Audience signals + Performance DNA (candidates)
 * NO silent hard-coded FSD/CT fallback.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREATOR_DNA_BLOCK = [
  "creator-dna-runtime-v1.3.1-snapshot",
  "WHO: Korean Tesla multi-vehicle owner-creator; FSD/product observation primary; LAFC/gaming/daily retained.",
  "PUBLISHING: inform/explain · experience · light opinion; polite intentional; 음슴체 RECENTLY_EMERGING for light opinion.",
  "NEVER: stock daytrade · invent firsthand tests · REPOST text as writing voice · single global tone",
  "STANCE: long-term Tesla investor / product progress; authenticity ≥80",
].join("\n");

const PERFORMANCE_DNA_BLOCK = [
  "performance-dna-runtime-baseline-v1-candidates",
  "VALIDATED=0; candidates only; soft advisory",
  "Priority: followers > profile visits > revenue > bookmarks > replies > likes > impressions",
  "Never learn from drafts; never impressions-only",
].join("\n");

const SYSTEM = `You are the weekly planner for @Seung4680.
Return ONLY valid JSON (no markdown fences, no commentary).
Shape:
{
  "generationDays": 7,
  "rationale": "short Korean string",
  "days": [
    {
      "dayOffset": 0,
      "posts": [
        {
          "slotId": "D1P1",
          "primaryTopic": "creator-framed topic",
          "angle": "angle",
          "contentType": "observation",
          "targetLength": "medium",
          "actionType": "ORIGINAL",
          "postStrategy": {
            "strategicAngle": "...",
            "writingApproach": "observation",
            "experienceUsage": "none",
            "hypothesisNote": "Hypothesis only"
          }
        }
      ]
    }
  ]
}
Rules:
- Exactly generationDays day objects, dayOffset 0..N-1
- About 4 posts per day, actionType always ORIGINAL
- primaryTopic is creator-framed — NEVER paste Fedica/audience keywords as title
- Do not invent firsthand driving tests
- Avoid FSD+Cybertruck monoculture every slot
- No stock price chatter`;

function parsePlanJson(rawText: string): any | null {
  if (!rawText || !String(rawText).trim()) return null;
  let text = String(rawText).trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* continue */
    }
  }
  // Try to find a days array even if wrapper is messy
  const daysMatch = text.match(/"days"\s*:\s*(\[[\s\S]*\])/);
  if (daysMatch) {
    try {
      const days = JSON.parse(daysMatch[1]);
      if (Array.isArray(days)) return { days, generationDays: days.length };
    } catch {
      /* ignore */
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
        { success: false, error: "XAI_API_KEY not configured in Supabase secrets", fallback: true, days: [] },
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

    const audienceHint = [
      Array.isArray(body.interests) ? `interests: ${body.interests.slice(0, 12).join(", ")}` : "",
      Array.isArray(body.topicCategories)
        ? `categories: ${body.topicCategories.slice(0, 10).join(", ")}`
        : "",
      body.sentiment ? `sentiment: ${body.sentiment}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const publishedTopics: string[] = Array.isArray(body.publishedTopics)
      ? body.publishedTopics.map(String).filter(Boolean).slice(0, 10)
      : Array.isArray(body.recentTopics)
        ? body.recentTopics.map(String).filter(Boolean).slice(0, 10)
        : [];
    const scheduledTopics: string[] = Array.isArray(body.scheduledTopics)
      ? body.scheduledTopics.map(String).filter(Boolean).slice(0, 8)
      : [];

    const userPrompt = `Creator Intent: ${topic || "(없음)"}

Creator DNA:
${CREATOR_DNA_BLOCK}

Audience signals (NOT titles): ${audienceHint.slice(0, 600) || "(none)"}

Performance DNA (candidate only):
${PERFORMANCE_DNA_BLOCK}

PUBLISHED (history): ${publishedTopics.map((t) => t.slice(0, 50)).join(" | ") || "(none)"}
SCHEDULED (dup only): ${scheduledTopics.map((t) => t.slice(0, 50)).join(" | ") || "(none)"}

Generate JSON for ${daysCount} days (dayOffset 0..${daysCount - 1}), ~4 ORIGINAL posts per day.
JSON only. No markdown.`;

    const dna_sources = {
      creator: "runtime_snapshot",
      performance: "baseline_candidates",
      runtime: "supabase_edge_weekly_plan",
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

    let rawText = "";
    let xaiStatus = 0;
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      xaiStatus = res.status;
      if (!res.ok) {
        const errText = await res.text();
        return json(
          {
            success: false,
            error: `xAI ${res.status}`,
            detail: errText.slice(0, 400),
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
      const isAbort = e?.name === "AbortError";
      return json(
        {
          success: false,
          error: "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
          detail: isAbort ? "timeout" : String(e?.message || e).slice(0, 160),
          fallback: true,
          days: [],
          dna_sources,
        },
        503
      );
    }

    if (!rawText.trim()) {
      return json(
        {
          success: false,
          error: "xAI가 빈 응답을 반환했습니다.",
          detail: `status=${xaiStatus}`,
          fallback: true,
          days: [],
          dna_sources,
        },
        503
      );
    }

    const parsed = parsePlanJson(rawText);
    let days: any[] = Array.isArray(parsed?.days) ? parsed.days : [];

    if (days.length === 0) {
      return json(
        {
          success: false,
          error: "주간 계획 결과가 비어 있습니다.",
          detail: `parse_failed_or_empty; raw_preview=${rawText.slice(0, 280)}`,
          fallback: true,
          days: [],
          generationDays: 0,
          dna_sources,
        },
        503
      );
    }

    for (let i = 0; i < days.length; i++) {
      let posts = Array.isArray(days[i]?.posts) ? days[i].posts : [];
      if (posts.length > 6) posts = posts.slice(0, 6);
      posts = posts.map((p: any, pi: number) => {
        const ps = p.postStrategy && typeof p.postStrategy === "object" ? p.postStrategy : {};
        return {
          slotId: String(p.slotId || `D${i + 1}P${pi + 1}`),
          primaryTopic: String(p.primaryTopic || "관찰"),
          angle: String(p.angle || ""),
          contentType: String(p.contentType || "observation"),
          allowedContext: Array.isArray(p.allowedContext)
            ? p.allowedContext.map(String).slice(0, 2)
            : [],
          forbiddenTopics: Array.isArray(p.forbiddenTopics)
            ? p.forbiddenTopics.map(String)
            : ["주가", "등락"],
          targetLength: ["short", "medium", "long"].includes(p.targetLength)
            ? p.targetLength
            : "medium",
          actionType: "ORIGINAL",
          postStrategy: {
            strategicAngle: String(ps.strategicAngle || p.angle || "observation-first").slice(0, 120),
            writingApproach: String(ps.writingApproach || "observation"),
            experienceUsage: String(ps.experienceUsage || "none"),
            hypothesisNote: String(
              ps.hypothesisNote || "Hypothesis only — validate after publish."
            ).slice(0, 160),
          },
        };
      });
      days[i] = {
        dayOffset: typeof days[i].dayOffset === "number" ? days[i].dayOffset : i,
        posts,
      };
    }

    days = days.filter((d) => Array.isArray(d.posts) && d.posts.length > 0);
    if (days.length === 0) {
      return json(
        {
          success: false,
          error: "주간 계획 슬롯이 비어 있습니다.",
          fallback: true,
          days: [],
          dna_sources,
        },
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
