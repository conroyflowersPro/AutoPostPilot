/**
 * Weekly Planner — Supabase Edge (P0 stability)
 * - Split xAI into Part A (days 0-3) + Part B (days 4-6) to avoid JSON truncation
 * - Target ~5 ORIGINAL slots/day (policy 5–8; code max 8) — NOT hard-capped at 3
 * - Engines: Creator DNA + Performance candidates + Audience signals + published/scheduled
 * - NO silent hard-coded FSD/CT fallback
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";
const POSTS_PER_DAY_TARGET = 5;
const POSTS_PER_DAY_MAX = 8;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREATOR_DNA = `creator-dna-v1.3.1: Korean Tesla owner-creator; FSD/product observation primary; LAFC/gaming/daily ok; no stock daytrade; no invented firsthand tests; authenticity high; light-opinion 음슴체 RECENTLY_EMERGING; REPOST text excluded from writing voice.`;
const PERF_DNA = `perf-dna baseline candidates only VALIDATED=0: soft advisory; prefer followers > profile visits > revenue > bookmarks > replies > likes > impressions; never learn from drafts; never impressions-only success.`;

const SYSTEM = `You are weekly planner for @Seung4680.
Output ONLY compact valid JSON. No markdown fences. No commentary.
Schema:
{"rationale":"short ko","days":[{"dayOffset":0,"posts":[{"slotId":"D1P1","primaryTopic":"creator-framed","angle":"...","contentType":"observation","targetLength":"medium","actionType":"ORIGINAL"}]}]}
Rules:
- Exactly the requested dayOffsets
- About ${POSTS_PER_DAY_TARGET} posts per day (min 4, max ${POSTS_PER_DAY_MAX})
- primaryTopic is creator-framed — NEVER paste Fedica/audience keywords as titles
- No stock price chatter; no invented firsthand tests
- Avoid FSD+Cybertruck monoculture every slot; allow LAFC/gaming/daily/AI infra when fit
- actionType always ORIGINAL`;

function extractJsonObject(raw: string): any | null {
  let t = String(raw || "").trim();
  if (!t) return null;
  t = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* continue */
  }
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") {
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
      /* continue */
    }
  }
  if (start >= 0 && depth > 0) {
    let frag = t.slice(start);
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

function normalizeDays(rawDays: any[], partLabel: string): any[] {
  if (!Array.isArray(rawDays)) return [];
  const out: any[] = [];
  for (let i = 0; i < rawDays.length; i++) {
    const d = rawDays[i];
    let posts = Array.isArray(d?.posts) ? d.posts : [];
    posts = posts.slice(0, POSTS_PER_DAY_MAX).map((p: any, pi: number) => {
      const dayOff = typeof d.dayOffset === "number" ? d.dayOffset : i;
      return {
        slotId: String(p.slotId || `D${dayOff + 1}P${pi + 1}`),
        primaryTopic: String(p.primaryTopic || "관찰").slice(0, 100),
        angle: String(p.angle || "").slice(0, 140),
        contentType: String(p.contentType || "observation"),
        allowedContext: Array.isArray(p.allowedContext)
          ? p.allowedContext.map(String).slice(0, 3)
          : [],
        forbiddenTopics: Array.isArray(p.forbiddenTopics)
          ? p.forbiddenTopics.map(String)
          : ["주가", "등락"],
        targetLength: ["short", "medium", "long"].includes(p.targetLength)
          ? p.targetLength
          : "medium",
        actionType: "ORIGINAL",
        postStrategy: {
          strategicAngle: String(
            (p.postStrategy && p.postStrategy.strategicAngle) || p.angle || "observation"
          ).slice(0, 120),
          writingApproach: String(
            (p.postStrategy && p.postStrategy.writingApproach) || "observation"
          ),
          experienceUsage: String(
            (p.postStrategy && p.postStrategy.experienceUsage) || "none"
          ),
          hypothesisNote: String(
            (p.postStrategy && p.postStrategy.hypothesisNote) ||
              "Hypothesis only — validate after publish."
          ).slice(0, 160),
        },
        _part: partLabel,
      };
    });
    if (posts.length === 0) continue;
    out.push({
      dayOffset: typeof d.dayOffset === "number" ? d.dayOffset : i,
      posts,
    });
  }
  return out;
}

async function callXaiPlan(
  xaiKey: string,
  userPrompt: string,
  signal: AbortSignal
): Promise<{ ok: true; text: string } | { ok: false; error: string; status?: number }> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${xaiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 4500,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
    }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText.slice(0, 400), status: res.status };
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return { ok: true, text };
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

    const sharedContext = `Intent/keywords signal: ${topic || "(none)"}
Audience interests (signals only, NOT titles): ${interests.join(", ") || "(none)"}
Audience categories: ${categories.join(", ") || "(none)"}
Sentiment: ${body.sentiment || "(none)"}
${CREATOR_DNA}
${PERF_DNA}
Avoid repeating published: ${published.map((t) => t.slice(0, 40)).join(" | ") || "(none)"}
Avoid scheduled dup: ${scheduled.map((t) => t.slice(0, 40)).join(" | ") || "(none)"}`;

    const dna_sources = {
      creator: "runtime_snapshot",
      performance: "baseline_candidates",
      runtime: "supabase_edge_weekly_plan_split",
      audience_signals: interests.length + categories.length,
      posts_per_day_target: POSTS_PER_DAY_TARGET,
      posts_per_day_max: POSTS_PER_DAY_MAX,
    };

    // Part A: first half of week; Part B: remainder — reduces truncation
    const splitAt = Math.min(4, daysCount);
    const offsetsA = Array.from({ length: splitAt }, (_, i) => i);
    const offsetsB = Array.from({ length: Math.max(0, daysCount - splitAt) }, (_, i) => splitAt + i);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 140000);

    let days: any[] = [];
    let rationaleParts: string[] = [];

    try {
      // Part A
      const promptA = `${sharedContext}

PART A only. dayOffset values: ${offsetsA.join(", ")}.
About ${POSTS_PER_DAY_TARGET} ORIGINAL posts per day (4–${POSTS_PER_DAY_MAX}).
Return JSON only with days covering those offsets.`;
      const resA = await callXaiPlan(xaiKey, promptA, controller.signal);
      if (!resA.ok) {
        clearTimeout(timer);
        return json(
          {
            success: false,
            error: `xAI Part A ${resA.status || ""}`.trim(),
            detail: resA.error,
            fallback: true,
            days: [],
            dna_sources,
          },
          502
        );
      }
      const parsedA = extractJsonObject(resA.text);
      const daysA = normalizeDays(parsedA?.days || [], "A");
      if (daysA.length === 0) {
        clearTimeout(timer);
        return json(
          {
            success: false,
            error: "주간 계획 Part A 결과가 비어 있습니다.",
            detail: `raw_preview=${String(resA.text).slice(0, 280)}`,
            fallback: true,
            days: [],
            dna_sources,
          },
          503
        );
      }
      days = days.concat(daysA);
      if (parsedA?.rationale) rationaleParts.push(String(parsedA.rationale));

      // Part B (if any days remain)
      if (offsetsB.length > 0) {
        const usedTopics = daysA
          .flatMap((d) => d.posts.map((p: any) => p.primaryTopic))
          .slice(0, 20)
          .join(" | ");
        const promptB = `${sharedContext}

PART B only. dayOffset values: ${offsetsB.join(", ")}.
About ${POSTS_PER_DAY_TARGET} ORIGINAL posts per day (4–${POSTS_PER_DAY_MAX}).
Do NOT repeat these Part A topics: ${usedTopics || "(none)"}
Return JSON only with days covering Part B offsets.`;
        const resB = await callXaiPlan(xaiKey, promptB, controller.signal);
        if (!resB.ok) {
          clearTimeout(timer);
          // Partial success policy: do NOT invent Part B; return failure (no silent fill)
          return json(
            {
              success: false,
              error: `주간 계획 Part B 실패 (Part A만 있음 — 자동 채우지 않음)`,
              detail: resB.error,
              fallback: true,
              days: [],
              dna_sources,
            },
            502
          );
        }
        const parsedB = extractJsonObject(resB.text);
        const daysB = normalizeDays(parsedB?.days || [], "B");
        if (daysB.length === 0) {
          clearTimeout(timer);
          return json(
            {
              success: false,
              error: "주간 계획 Part B 결과가 비어 있습니다.",
              detail: `raw_preview=${String(resB.text).slice(0, 280)}`,
              fallback: true,
              days: [],
              dna_sources,
            },
            503
          );
        }
        days = days.concat(daysB);
        if (parsedB?.rationale) rationaleParts.push(String(parsedB.rationale));
      }
      clearTimeout(timer);
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

    // Dedupe dayOffset — keep first
    const byOffset = new Map<number, any>();
    for (const d of days) {
      if (!byOffset.has(d.dayOffset)) byOffset.set(d.dayOffset, d);
    }
    days = Array.from(byOffset.values()).sort((a, b) => a.dayOffset - b.dayOffset);

    // Strip internal _part
    days = days.map((d) => ({
      dayOffset: d.dayOffset,
      posts: d.posts.map((p: any) => {
        const { _part, ...rest } = p;
        return rest;
      }),
    }));

    if (days.length === 0) {
      return json(
        {
          success: false,
          error: "주간 계획 결과가 비어 있습니다.",
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
      rationale: rationaleParts.filter(Boolean).join(" / ") || null,
      totalPlanned: days.reduce((s: number, d: any) => s + d.posts.length, 0),
      dna_sources,
      fallback: false,
      engine: "supabase_edge_weekly_plan_split",
      parts: offsetsB.length > 0 ? ["A", "B"] : ["A"],
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
