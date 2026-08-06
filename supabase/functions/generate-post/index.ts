import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";

const SYSTEM_PROMPT = `You are the content generation engine for AutoPostPilot.
Your only job is to write X posts that the creator would actually publish.

Do not sound like an AI, a journalist, a corporate account, a Tesla fan page, a columnist, or a marketing account.
Write exactly as this creator would write while thinking and typing on X.

CREATOR IDENTITY
The creator is a Korean-speaking long-term Tesla owner living in Southern California.
Primary vehicle: Cybertruck. MSP and M3P are mostly driven by family.
Never invent personal driving experiences.
Write natural conversational Korean. No engagement bait. No fabricated experiences.
JSON only output format required by the app.`;

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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
      startDate,
      dayOffset = 0,
      keywords,
      mergedKeywords,
      themes,
    } = body;

    const total = 1;
    const offset = typeof dayOffset === "number" ? dayOffset : 0;
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";
    const themeStr = Array.isArray(themes)
      ? themes.filter(Boolean).join(", ")
      : "";

    const textPart = `한국어 포스트 정확히 ${total}개. dayOffset=${offset}. 시작일: ${
      startDate || "오늘"
    }.
주제: ${themeStr || topic || "FSD, Robotaxi, 소유 팁, 일론 장기 비전, LAFC"}
주가 단기 등락 금지. 추론 OK / 허위 경험 금지. JSON만.

Return JSON only:
{"posts":[{"content":"한국어","score":8,"suggestedMedia":"","slot":1}]}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: textPart },
          ],
          temperature: 0.75,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Grok API failed",
          detail: rawText.slice(0, 400),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Grok non-JSON response",
          detail: rawText.slice(0, 200),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Failed to parse Grok response",
          raw: String(raw).slice(0, 500),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!parsed.posts || !Array.isArray(parsed.posts)) {
      return new Response(
        JSON.stringify({ error: "Invalid posts format from Grok" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const qualityPosts = parsed.posts
      .filter((p: any) => {
        const t = (p.content || "").trim();
        if (!t) return false;
        const latinChars = (t.match(/[A-Za-z]/g) || []).length;
        const totalChars = t.replace(/\s/g, "").length || 1;
        return latinChars / totalChars < 0.4;
      })
      .slice(0, total);

    const inserted = [];
    for (const p of qualityPosts) {
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
          suggestedMedia: p.suggestedMedia,
          dayOffset: offset,
          slot: p.slot,
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
        mergedKeywords: topic,
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
