/**
 * Weekly Planner — Supabase Edge
 * Engine contract preserved:
 * Creator Intent + Creator DNA + Audience signals + Performance DNA (candidates)
 * + published/scheduled topic split → days[] slots.
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
  "creator-dna-runtime-v1.3.1-snapshot (Archive/Historical learning)",
  "WHO: Korean Tesla multi-vehicle owner-creator; real-world FSD/product observation primary; plural interests (gaming, daily, LAFC) retained.",
  "WHY WRITE: inform/explain · share experience · light opinion · social reply",
  "PUBLISHING DNA: two-speed; media often; informational → polite intentional; light-opinion 음슴체 = RECENTLY_EMERGING preference.",
  "REPLY DNA (SEPARATE): short, communicative — NEVER average into Publishing voice.",
  "NOT THIS: stock daytrade primary · single global tone · REPOST text as writing voice",
  "REPOST: manual by Creator only; REPOST text excluded from Writing DNA",
  "CONTENT STANCE: long-term Tesla investor / product progress; not short-term stock price chatter",
  "SAFETY: never invent firsthand driving tests; Level1/2 only without evidence; authenticity ≥80",
].join("\n");

const PERFORMANCE_DNA_BLOCK = [
  "performance-dna-runtime-baseline-v1-candidates",
  "STATUS: INITIAL BASELINE v1 previously run — candidates only; VALIDATED = 0",
  "SUCCESS PRIORITY (advisory): followers > profile visits > revenue > bookmarks > replies > likes > impressions",
  "CANDIDATE only (NOT proven): practical investigation+video; community how-to; authentic FSD essay; milestone gratitude; honest incident",
  "FORBIDDEN: impressions-only · learn from drafts · promote candidate→validated here",
  "Soft preference only; never override Creator DNA or Creator Intent",
].join("\n");

const SYSTEM = `You are the weekly account-operating strategist for @Seung4680 — AI account manager, not a post generator.
MISSION: long-term growth + authentic creator voice. Impressions alone must never dominate.
AUTHENTICITY HARD: never invent firsthand experiences; Level1/2 only.
Creator Intent must shape the week. Audience/Fedica keywords are signals — NEVER copy as primaryTopic.
Posting time is owned by Fedica only. WEEKLY POSTS = ORIGINAL only. Do not learn from drafts.
FORBIDDEN: 주가/등락/TSLA chart · invented experiences · Fedica keywords as primaryTopic · FSD+Cybertruck monoculture every slot.
Output JSON only with: generationDays, rationale, days (array of { dayOffset, posts }).
Each post: slotId, primaryTopic, angle, contentType, targetLength (short|medium|long), actionType "ORIGINAL", postStrategy { strategicAngle, writingApproach, experienceUsage, hypothesisNote }.
Aim about 4-5 ORIGINAL posts per day. Compact JSON.`;

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
    if (!authHeader)
      return json(
        { success: false, error: "Missing Authorization", fallback: true, days: [] },
        401
      );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) {
      return json(
        {
          success: false,
          error: "XAI_API_KEY not configured in Supabase secrets",
          fallback: true,
          days: [],
        },
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
    if (userErr || !user)
      return json(
        { success: false, error: "Not authenticated", fallback: true, days: [] },
        401
      );

    const body = await req.json().catch(() => ({}));
    const topic = String(
      body.topic || body.creatorIntent || body.keywords || body.mergedKeywords || ""
    ).trim();
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);

    const audienceHint = [
      Array.isArray(body.interests)
        ? `interests: ${body.interests.slice(0, 12).join(", ")}`
        : "",
      Array.isArray(body.topicCategories)
        ? `categories: ${body.topicCategories.slice(0, 10).join(", ")}`
        : "",
      body.sentiment ? `sentiment: ${body.sentiment}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const publishedTopics: string[] = Array.isArray(body.publishedTopics)
      ? body.publishedTopics.map(String).filter(Boolean).slice(0, 12)
      : Array.isArray(body.recentTopics)
        ? body.recentTopics.map(String).filter(Boolean).slice(0, 12)
        : [];
    const scheduledTopics: string[] = Array.isArray(body.scheduledTopics)
      ? body.scheduledTopics.map(String).filter(Boolean).slice(0, 10)
      : [];

    const topicSignalBlock = [
      publishedTopics.length
        ? `PUBLISHED (history only — not drafts):\n${publishedTopics
            .map((t, i) => `${i + 1}. ${t.slice(0, 60)}`)
            .join("\n")}`
        : "PUBLISHED: (none)",
      scheduledTopics.length
        ? `SCHEDULED (duplication avoidance only):\n${scheduledTopics
            .map((t, i) => `${i + 1}. ${t.slice(0, 60)}`)
            .join("\n")}`
        : "SCHEDULED: (none)",
    ].join("\n\n");

    const userPrompt = `Creator Intent (must shape this week): ${topic || "(없음)"}

Creator DNA:
${CREATOR_DNA_BLOCK}

Audience DNA / signals (NOT writing titles):
${audienceHint.slice(0, 800) || "(none)"}

Performance DNA (CANDIDATE only — validated=0; soft advisory):
${PERFORMANCE_DNA_BLOCK}

${topicSignalBlock}

Return JSON only for ${daysCount} days (dayOffset 0..${daysCount - 1}).
Every slot actionType=ORIGINAL. Never copy audience keywords into primaryTopic.
Expand beyond FSD/Cybertruck monoculture when possible.`;

    const dna_sources = {
      creator: "runtime_snapshot",
      performance: "baseline_candidates",
      runtime: "supabase_edge_weekly_plan",
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
          temperature: 0.55,
          max_tokens: 3500,
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
      const isAbort = e?.name === "AbortError";
      return json(
        {
          success: false,
          error:
            "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
          detail: isAbort ? "timeout" : String(e?.message || e).slice(0, 120),
          fallback: true,
          days: [],
          dna_sources,
        },
        503
      );
    }

    let parsed: any = null;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    let days: any[] = Array.isArray(parsed?.days) ? parsed.days : [];
    if (days.length === 0) {
      return json(
        {
          success: false,
          error: "주간 계획 결과가 비어 있습니다.",
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
        const ps =
          p.postStrategy && typeof p.postStrategy === "object" ? p.postStrategy : {};
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
            strategicAngle: String(
              ps.strategicAngle || p.angle || "observation-first"
            ).slice(0, 120),
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
        error:
          "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
        detail: String(err?.message || err).slice(0, 120),
        fallback: true,
        days: [],
      },
      500
    );
  }
});
