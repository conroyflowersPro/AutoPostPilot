/**
 * Weekly Planner — Supabase Edge
 * Fedica keyword cloud = follower vocabulary that day (visual size ≈ attention).
 * Policy: ~1 audience-linked slot per day among 5–8; top keyword weight decays across the week
 * (day0 ~100%, day1 ~80%, day2 ~60% ...). Other slots = system strategic choice.
 * NO silent hard-coded fallback. NO primaryTopic = "creator-framed" placeholder.
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

const CREATOR_DNA = `creator-dna-v1.3.1: Korean Tesla owner-creator; FSD/product observation; LAFC/gaming/daily ok; no stock daytrade; no invented tests; authenticity high.`;
const PERF_DNA = `perf-dna candidates only VALIDATED=0: soft advisory; followers>profile>revenue>bookmarks>replies>likes>impressions; never learn from drafts.`;

/** Decay of top-keyword emphasis by dayOffset (0-based). */
function decayLabel(dayOffset: number): string {
  const pct = Math.max(20, Math.round(100 * Math.pow(0.8, dayOffset)));
  return `${pct}%`;
}

const SYSTEM = `You are weekly planner for @Seung4680.
Output ONLY compact valid JSON. No markdown. No commentary.

Schema (example structure — NEVER copy example strings as real topics):
{"rationale":"short ko","days":[{"dayOffset":0,"posts":[{"slotId":"D1P1","primaryTopic":"실제 주제","angle":"...","contentType":"observation","targetLength":"medium","actionType":"ORIGINAL","audienceLinked":false}]}]}

Slot count: about ${POSTS_PER_DAY_TARGET} posts/day (4–${POSTS_PER_DAY_MAX}).
actionType always ORIGINAL.
primaryTopic must be a real Korean/English topic phrase — NEVER the words creator-framed, primaryTopic, or placeholder text.

AUDIENCE KEYWORD POLICY (Fedica cloud = what followers talk about that day):
- Larger cloud text = higher relative attention (not a post-count quota beyond rules below).
- Each day: aim for EXACTLY ONE post with audienceLinked=true that engages the audience signal in the creator's own voice.
- Top keyword emphasis DECAYS across the week — do NOT repeat the same max-keyword focus at full strength every day:
  dayOffset 0 ≈ 100% emphasis on top signal, 1 ≈ 80%, 2 ≈ 60%, 3 ≈ 48%, 4 ≈ 38%, 5 ≈ 30%, 6 ≈ 24%.
- Early week: the one audienceLinked slot should clearly address the topKeywordInterest (theme), not paste the raw keyword as the whole post topic unless natural.
- Later week: the one audienceLinked slot may use secondary ranked keywords or a lighter angle on the same ecosystem — still only ~1 slot/day.
- Remaining 4–7 slots/day: strategic (Creator DNA, diversity, published history, LAFC/gaming/daily/FSD as fit) — audienceLinked=false.
- NEVER fill all 5–8 slots with Elon/Tesla/Musk just because the cloud is large.
- NEVER invent firsthand experiences. No stock-price chatter.`;

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

function normalizeDays(rawDays: any[]): any[] {
  if (!Array.isArray(rawDays)) return [];
  const out: any[] = [];
  for (let i = 0; i < rawDays.length; i++) {
    const d = rawDays[i];
    let posts = Array.isArray(d?.posts) ? d.posts : [];
    posts = posts.slice(0, POSTS_PER_DAY_MAX).map((p: any, pi: number) => {
      const dayOff = typeof d.dayOffset === "number" ? d.dayOffset : i;
      let topic = String(p.primaryTopic || "관찰").slice(0, 100);
      if (/^creator-framed$/i.test(topic.trim()) || /^primaryTopic$/i.test(topic.trim())) {
        topic = String(p.angle || "일상 관찰").slice(0, 100) || "일상 관찰";
      }
      return {
        slotId: String(p.slotId || `D${dayOff + 1}P${pi + 1}`),
        primaryTopic: topic,
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
        audienceLinked: Boolean(p.audienceLinked),
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
      };
    });
    if (!posts.length) continue;
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
  return { ok: true, text: data?.choices?.[0]?.message?.content || "" };
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

    const topKeyword =
      typeof body.topKeyword === "string" && body.topKeyword.trim()
        ? body.topKeyword.trim()
        : null;
    const topKeywordInterest =
      typeof body.topKeywordInterest === "string" && body.topKeywordInterest.trim()
        ? body.topKeywordInterest.trim()
        : null;
    const ranked = Array.isArray(body.rankedKeywords)
      ? body.rankedKeywords
          .map((r: any) => ({
            keyword: String(r?.keyword || "").trim(),
            visualRank: Number(r?.visualRank) || 99,
            relativeWeight: String(r?.relativeWeight || "medium"),
          }))
          .filter((r: any) => r.keyword)
          .slice(0, 10)
      : [];

    const decayLines = Array.from({ length: daysCount }, (_, i) =>
      `dayOffset ${i}: top-signal emphasis ${decayLabel(i)} → still only ~1 audienceLinked slot that day`
    ).join("\n");

    const audienceBlock = topKeyword
      ? `FEDICA TOP KEYWORD (largest on cloud): ${topKeyword}
TOP KEYWORD INTEREST (theme for planning): ${topKeywordInterest || topKeyword}
RANKED (by visual size): ${ranked.map((r) => `${r.visualRank}. ${r.keyword}(${r.relativeWeight})`).join(" | ") || topKeyword}
DECAY SCHEDULE:
${decayLines}
Policy reminder: ~1 audienceLinked slot/day; other slots strategic; do not monopolize the week with the top keyword.`
      : `No topKeyword from screenshot — use interests only as soft signals; no forced audienceLinked quota.`;

    const sharedContext = `Creator Intent / text: ${topic || "(none)"}
Audience interests: ${interests.join(", ") || "(none)"}
Categories: ${categories.join(", ") || "(none)"}
Sentiment: ${body.sentiment || "(none)"}
${audienceBlock}
${CREATOR_DNA}
${PERF_DNA}
Avoid published themes: ${published.map((t) => t.slice(0, 40)).join(" | ") || "(none)"}
Avoid scheduled dup: ${scheduled.map((t) => t.slice(0, 40)).join(" | ") || "(none)"}`;

    const dna_sources = {
      creator: "runtime_snapshot",
      performance: "baseline_candidates",
      runtime: "supabase_edge_weekly_plan_split",
      audience_signals: interests.length + categories.length,
      topKeyword: topKeyword || null,
      audience_slot_policy: topKeyword
        ? "one_per_day_with_weekly_decay"
        : "soft_signals_only",
      posts_per_day_target: POSTS_PER_DAY_TARGET,
    };

    const splitAt = Math.min(4, daysCount);
    const offsetsA = Array.from({ length: splitAt }, (_, i) => i);
    const offsetsB = Array.from({ length: Math.max(0, daysCount - splitAt) }, (_, i) => splitAt + i);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 140000);

    let days: any[] = [];
    let rationaleParts: string[] = [];

    try {
      const promptA = `${sharedContext}

PART A. dayOffsets: ${offsetsA.join(", ")}.
~${POSTS_PER_DAY_TARGET} posts/day. Mark audienceLinked true on at most one post per day.
Return JSON only.`;
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
      const daysA = normalizeDays(parsedA?.days || []);
      if (!daysA.length) {
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

      if (offsetsB.length > 0) {
        const usedTopics = daysA
          .flatMap((d) => d.posts.map((p: any) => p.primaryTopic))
          .slice(0, 24)
          .join(" | ");
        const promptB = `${sharedContext}

PART B. dayOffsets: ${offsetsB.join(", ")}.
~${POSTS_PER_DAY_TARGET} posts/day. At most one audienceLinked per day; weaker top-keyword emphasis (decay).
Do NOT repeat Part A topics: ${usedTopics || "(none)"}
Return JSON only.`;
        const resB = await callXaiPlan(xaiKey, promptB, controller.signal);
        if (!resB.ok) {
          clearTimeout(timer);
          return json(
            {
              success: false,
              error: "주간 계획 Part B 실패 (자동 채우지 않음)",
              detail: resB.error,
              fallback: true,
              days: [],
              dna_sources,
            },
            502
          );
        }
        const parsedB = extractJsonObject(resB.text);
        const daysB = normalizeDays(parsedB?.days || []);
        if (!daysB.length) {
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

    const byOffset = new Map<number, any>();
    for (const d of days) {
      if (!byOffset.has(d.dayOffset)) byOffset.set(d.dayOffset, d);
    }
    days = Array.from(byOffset.values()).sort((a, b) => a.dayOffset - b.dayOffset);

    if (!days.length) {
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
