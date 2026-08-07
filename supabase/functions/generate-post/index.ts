import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are the content generation engine for AutoPostPilot.
Your only job is to write X posts that the creator would actually publish.

Do not sound like an AI. Write as this Korean Tesla owner would type on X.
Primary vehicle: Cybertruck. Follow each slot primaryTopic and angle strictly.
- primaryTopic is the single clear main topic (creator-framed; never Fedica keyword labels)
- Do not insert trending keywords or place names unless the slot itself is an authentic owner observation
Never invent experiences. No stock-price chatter. Natural 해요체 mix. JSON only.`;

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
      const legacyCount = Math.min(8, Math.max(1, Number(body.count) || 1));
      const themes = Array.isArray(body.themes) ? body.themes.map(String) : [];
      const legacyTopics = [
        "FSD 실사용 체감",
        "Cybertruck 일상 활용",
        "Robotaxi / 자율주행 관찰",
        "LAFC / 축구 일상",
        "앱·업무 운영 관찰",
        "기술·AI 사용 메모",
        "장기 투자 관점",
        "소유 팁",
      ];
      // Audience/Fedica keywords must NEVER become primaryTopic/angle
      for (let i = 0; i < legacyCount; i++) {
        const fallbackTopic = legacyTopics[i % legacyTopics.length];
        effectiveSlots.push({
          slotId: `D${offset + 1}P${i + 1}`,
          primaryTopic: themes[i] || fallbackTopic,
          angle: themes[i] || fallbackTopic,
          contentType: "observation",
          allowedContext: [],
          forbiddenTopics: ["주가", "등락", "매매"],
          targetLength: i % 3 === 0 ? "short" : i % 3 === 1 ? "medium" : "long",
        });
      }
    }

    if (effectiveSlots.length === 0) {
      return new Response(
        JSON.stringify({ error: "slots array required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workingSlots = effectiveSlots;
    const usedJson = JSON.stringify(usedRecord, null, 0);
    const scheduleMeta = startDate
      ? `startDate=${startDate} (scheduling metadata only — do NOT treat as evidence that events happened today)`
      : `startDate not provided (scheduling metadata only — do NOT invent "오늘/방금/아까")`;

    async function callGrok(slotsSubset: any[]): Promise<any> {
      const subsetJson = JSON.stringify(slotsSubset, null, 0);
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.
${scheduleMeta}

SLOTS (follow each strictly; primaryTopic is creator-framed — never invent Fedica keyword dumps):
${subsetJson}

USED RECORD (do not repeat these topics/angles/examples/places/openings/conclusions):
${usedJson}

Return JSON only with posts array of length ${slotsSubset.length}. Each object must have slotId, content, score.`;

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
            temperature: 0.75,
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

    // Batch all slots in one or two calls if many
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

    const inserted = [];
    for (let i = 0; i < qualityPosts.length; i++) {
      const p = qualityPosts[i];
      const slot = workingSlots[i] || workingSlots[0];
      const { data: row, error } = await supabase
        .from("SeungContent")
        .insert({
          content: p.content,
          status: "draft",
          pipeline_id: "42303",
          user_id: user.id,
        })
        .select()
        .single();

      if (!error && row) {
        inserted.push({
          ...row,
          score: p.score,
          slotId: p.slotId || slot?.slotId,
          dayOffset: offset,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        model: MODEL,
        count: inserted.length,
        posts: inserted,
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
