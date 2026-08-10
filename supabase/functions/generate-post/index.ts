import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";

/**
 * ORDER 3/3 — Creator DNA Final Voice (Publishing DNA only; REPLY excluded)
 * Snapshot aligned with creator-dna-runtime v1.3.1 / Historical learning.
 * Performance DNA must NOT drive voice choice.
 */
const CREATOR_DNA_VOICE = `CREATOR DNA (HOW to write — Publishing voice only):
WHO: Korean Tesla multi-vehicle owner (Cybertruck + S Plaid + M3 Perf), FSD tester, Robotaxi believer, LAFC STH. Real-world drives, tips, honest takes.
WHY WRITE: inform/explain · share experience · light opinion · observation — not stock daytrade.
REGISTER BY INTENT:
- INFORMATIVE / technical explain → 해요체·존칭 intentional (audience-facing polite)
- OPINION / light opinion → 요즘 들어서 음슴체 가능 (RECENTLY_EMERGING preference; not forced)
- CASUAL_OBSERVATION → short, concrete, 해요체+casual mix
- COMPARE → clear A/B axis in natural speech, not textbook contrast essay
- EXPERIENCE → only if evidence exists; first-person OK with known context only
VOCABULARY / RHYTHM:
- Prefer creator-natural phrases over bureaucratic/technical lecture tone
- Median length ~90–120 chars when SHORT/MEDIUM; do not pad to essay
- Media-friendly one-main-point posts; occasional ㅋㅋ only when observation is actually light/funny
- Ending: natural close, not announcement-style summary
NOT THIS: pure 반말; single global tone; REPOST text as voice; inventing tests; short-term stock chatter
Performance DNA is reference only — do NOT lock onto one past high-engagement style.`;

const SYSTEM_PROMPT = `You are the content generation engine for AutoPostPilot (@Seung4680).

ROLE SPLIT:
- Seed / primaryTopic / angle / postBrief = WHAT (facts, points, topic) — NOT final wording
- editorial_mode + length_mode = editorial intent / format from Planner
- Creator DNA below = HOW (vocabulary, rhythm, tone, sentence structure)

${CREATOR_DNA_VOICE}

SEED WORDING RULE:
- Do NOT copy seed's stiff/technical phrasing verbatim into the post
- Rewrite into Creator-natural Korean while preserving: proper nouns, tech names (FSD, Cybertruck, Robotaxi, BMO, LAFC), verified facts
- Never distort meaning of verified facts

GENERATOR GROUNDING (ORDER 3 — hard rules):
- Creator DNA = HOW only. Do NOT invent new factual WHAT.
- Forbidden to ADD if absent from seed/evidence: 오늘/어제/이번 주, 출퇴근, 구체 주행 시점, 방문 장소, 거리/시간/횟수, "직접 해봄/테스트함", 특정 실제 행동·사건·감정
- Only state as fact what the seed or evidence already carries
- If seed is neutral (e.g. "짧은 도심 구간"), keep neutral — do not upgrade to "오늘 퇴근길"
- Do not invent numbers, place names, or test anecdotes for color

EDITORIAL MODE (must differ by mode — not all posts sound like explainers):
- INFORMATIVE: clear subject + point; 해요체 explain; one main point; no closing sermon
- COMPARE: explicit comparison axis in natural speech
- OPINION: trade-off / stance space; not pure fact dump; avoid identical "정리하면" endings
- EXPERIENCE: only with evidence context; no invented first-person tests; never republish source post text
- If historical_framing_required or experience_class=HISTORICAL: MUST use past frame (예전에 / 그 버전을 쓰던 당시에는 / 지금과 비교하면 당시에는) — never state past UI/version/price as current fact; do not invent extra historical details beyond seed
- experience_provenance is tracking only; do not dump provenance labels into the post body
- CASUAL_OBSERVATION: short lived observation; no filler; no mini-essay
- Weekly HUMOR: never (Wild Card only)

CLARITY:
- First 1–2 sentences: who/what + the point
- Forbidden empty padding: 조금, 약간, 느낌이, ~인 것 같다, 나쁘지 않다, 괜찮은 편, 그런 느낌, 미묘하게, 뭔가, 전반적으로 alone
- length_mode SHORT: no pad. LONG: structure only with known context
- Avoid repeating the same sentence skeleton across consecutive posts

SAFETY:
- Never invent firsthand experiences or recent unverified announcements
- No stock-price chatter
- LAFC: name competition when relevant; BMO home = 직관 OK without inventing events

If slot.xai_api_tag or xai_external_enrichment is set, keep that tag association in metadata (do not invent the tag).

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
      const compact = slotsSubset.map((s: any) => ({
        slotId: s.slotId,
        primaryTopic: s.primaryTopic || s.concrete_subject,
        angle: s.angle,
        editorial_mode: s.editorial_mode || null,
        length_mode: s.length_mode || "MEDIUM",
        writing_mode: s.writing_mode || null,
        core_point: s.postBrief?.core_point || s.concrete_subject,
        why: s.postBrief?.why_this_topic || s.angle,
        do_not_invent: s.postBrief?.do_not_invent || [],
        xai_api_tag: s.xai_api_tag || (s.xai_external_enrichment ? "[xAI API 이용]" : undefined),
      }));
      const subsetJson = JSON.stringify(compact, null, 0);
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.
${scheduleMeta}

SLOTS (WHAT only — rewrite into Creator DNA voice; do not copy stiff seed wording):
${subsetJson}

Rules reminder:
- editorial_mode must shape the post (INFORMATIVE ≠ OPINION ≠ COMPARE ≠ CASUAL)
- Preserve tech names / proper nouns / verified facts
- Never invent first-person tests
- Performance DNA must not force a single past style

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
        const t = String(p.content || p.final_text || "").trim();
        if (t.length < 8) return false;
        const latinChars = (t.match(/[A-Za-z]/g) || []).length;
        const totalChars = t.replace(/\s/g, "").length || 1;
        return latinChars / totalChars < 0.75;
      })
      .map((p: any) => ({
        ...p,
        content: String(p.content || p.final_text || "").trim(),
        final_text: String(p.final_text || p.content || "").trim(),
      }))
      .slice(0, workingSlots.length);

    return new Response(
      JSON.stringify({
        success: true,
        model: MODEL,
        count: qualityPosts.length,
        posts: qualityPosts.map((p: any, i: number) => {
          const slot = workingSlots[i] || {};
          const xaiTag =
            slot.xai_api_tag ||
            (slot.xai_external_enrichment ? "[xAI API 이용]" : undefined);
          return {
            slotId: p.slotId || slot.slotId,
            content: p.content,
            final_text: p.content,
            text: p.content,
            score: p.score,
            dayOffset: offset,
            planning_source: slot.planning_source,
            primaryTopic: slot.primaryTopic,
            editorial_mode: slot.editorial_mode,
            length_mode: slot.length_mode,
            xai_api_tag: xaiTag,
            xai_external_enrichment: !!slot.xai_external_enrichment,
            voice_source: "creator_dna_publishing_v1.3.1",
          };
        }),
        usedRecord,
        dayOffset: offset,
        voice: "creator_dna_publishing_v1.3.1",
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
