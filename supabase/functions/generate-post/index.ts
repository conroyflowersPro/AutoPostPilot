import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are the content generation engine for AutoPostPilot.
Write X posts @Seung4680 would actually publish.

Voice: Korean Tesla owner (Cybertruck primary), FSD tester, LAFC STH. Natural 해요체 + casual. Not pure 반말.

Follow each slot primaryTopic, angle, and postBrief if present. postBrief.core_point / concrete_subject = the ONE main point.
Never dump source_keywords or Fedica labels into the post as stuffing.
Never invent firsthand experiences. No stock-price chatter.

CLARITY (required):
- First 1–2 sentences must make clear: who/what subject + the point.
- Forbidden padding: 조금, 약간, 느낌이, ~인 것 같다, 나쁘지 않다, 괜찮은 편, 그런 느낌, 미묘하게, 뭔가, 전반적으로 alone without object.
- Prefer shorter concrete lines over long soft hedges.

LAFC slots: name competition when relevant (MLS/리그컵/플레이오프/CONCACAF). BMO home = 직관 voice OK without inventing match events. Away/비직관 = fan distance, not in-stadium.

JSON only. Each post: slotId, content, score.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) {
      return new Response(
        JSON.stringify({ error: "XAI_API_KEY not configured in Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      jobId,
      startDate,
      dayOffset = 0,
      slots = [],
      usedRecord = {
        usedTopics: [],
        usedAngles: [],
        usedExamples: [],
        usedPlaces: [],
        usedOpenings: [],
        usedConclusions: [],
      },
    } = body;

    const offset = typeof dayOffset === "number" ? dayOffset : 0;

    let effectiveSlots = Array.isArray(slots) ? slots : [];
    if (effectiveSlots.length === 0) {
      return new Response(
        JSON.stringify({ error: "slots array required and must not be empty — no silent theme fallback" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workingSlots = effectiveSlots;
    const usedJson = JSON.stringify(usedRecord, null, 0);
    const scheduleMeta = startDate
      ? `startDate=${startDate} (scheduling metadata only — do NOT invent 오늘/방금 events)`
      : `startDate not provided`;

    async function callGrok(slotsSubset: any[]): Promise<any> {
      const subsetJson = JSON.stringify(slotsSubset, null, 0);
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.
${scheduleMeta}

SLOTS (follow primaryTopic, angle, postBrief; one main point each; never keyword-stuff):
${subsetJson}

USED RECORD (avoid repeats):
${usedJson}

Return JSON only: {"posts":[{"slotId":"...","content":"...","score":1-10}]}.`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      let response: Response;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        };
        if (jobId) headers["x-grok-conv-id"] = String(jobId);
        response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            temperature: 0.7,
            reasoning_effort: "low",
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const rawText = await response.text();
      if (!response.ok) throw new Error(`Grok API failed: ${rawText.slice(0, 300)}`);
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("Grok non-JSON response");
      }
      return data;
    }

    const batchSize = 8;
    const allGenerated: any[] = [];
    for (let i = 0; i < workingSlots.length; i += batchSize) {
      const subset = workingSlots.slice(i, i + batchSize);
      const data = await callGrok(subset);
      const raw = data.choices?.[0]?.message?.content || "{}";
      let parsed: any;
      try {
        const m = String(raw).match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : raw);
      } catch {
        parsed = { posts: [] };
      }
      const posts = Array.isArray(parsed?.posts) ? parsed.posts : [];
      allGenerated.push(...posts);
    }

    const qualityPosts = allGenerated
      .filter((p: any) => {
        const t = (p.content || "").trim();
        if (!t) return false;
        const latinChars = (t.match(/[A-Za-z]/g) || []).length;
        const totalChars = t.replace(/\s/g, "").length || 1;
        return latinChars / totalChars < 0.45;
      })
      .slice(0, workingSlots.length);

    return new Response(
      JSON.stringify({
        success: true,
        model: MODEL,
        count: qualityPosts.length,
        posts: qualityPosts.map((p: any, i: number) => ({
          slotId: p.slotId || workingSlots[i]?.slotId,
          content: p.content,
          final_text: p.content,
          score: p.score,
          dayOffset: offset,
          planning_source: workingSlots[i]?.planning_source,
        })),
        usedRecord,
        dayOffset: offset,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.name === "AbortError"
        ? "포스트 생성 시간 초과"
        : err.message || "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
