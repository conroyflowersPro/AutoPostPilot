import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  getCreatorDnaVoice,
  getVocabularyFidelityInstructions,
  getCreatorStyle,
  getStyleBaseline,
} from "./creator-style-data.ts";
import {
  scoreVocabularyFidelity,
  detectUnsupportedAdditions,
} from "./vocabulary-fidelity.ts";
import {
  buildGroundedPostsOut,
  compactSlotForModel,
} from "./grounding-out.ts";
import {
  buildThoughtStagesInstructions,
  selectThinkingRailHint,
  THINKING_RAIL_LIBRARY,
} from "./thought-stages.ts";

const MODEL = "grok-4.5";
const GENERATOR_VERSION = "core_thought_rail_audience_v1_order1";

function buildSystemPrompt(): string {
  const voice = getCreatorDnaVoice();
  const vocab = getVocabularyFidelityInstructions();
  const style = getCreatorStyle();
  const stages = buildThoughtStagesInstructions();
  return `You are the content generation engine for AutoPostPilot.

ROLE SPLIT:
- Seed / primaryTopic / angle / postBrief = WHAT (facts, points, topic) — NOT final wording
- editorial_mode + length_mode = editorial intent / format from Planner
- Creator DNA (from Data Layer) = HOW (vocabulary, rhythm, tone, sentence structure) — FINAL EXPRESSION ONLY

${stages}

${voice}

${vocab}

STYLE CORPUS (Publishing ORIGINAL n=${style.sample_n}, median ${style.median_post_chars} chars):
- Do not force preferred-word insertion. Match rhythm/length/register distance to corpus.
- Semantic elevation banned: do not upgrade casual speech into professional/academic/report/consulting tone.

SEED WORDING RULE:
- Do NOT copy seed's stiff/technical phrasing verbatim into the post
- Rewrite into Creator-natural Korean while preserving: proper nouns, tech names, verified facts from seed/evidence
- Never distort meaning of verified facts
- If seed already sounds lived/concrete, preserve that surface — do not polish into abstract analysis

GENERATOR GROUNDING (hard rules — metadata per slot):
- Creator DNA = HOW only. Do NOT invent new factual WHAT.
- Each slot may include: claim_types, grounding_status, source_type, source_id, allowed_facts, do_not_invent, historical_framing
- Forbidden to ADD if absent from seed/evidence anchors: 오늘/어제/이번 주, 출퇴근, 구체 주행 시점, 방문 장소, 거리/시간/횟수, "직접 해봄/테스트함", 특정 실제 행동·사건
- Only state as fact what the seed or evidence already carries
- If historical_framing is set: MUST use past frame — never state past UI/version/price as current fact
- do_not_invent list items must not appear as new claims

EDITORIAL MODE (must differ by mode):
- INFORMATIVE: clear subject + point; polite explain; one main point; no closing sermon
- COMPARE: explicit comparison axis in natural speech
- OPINION: trade-off / stance space; not pure fact dump
- EXPERIENCE: only with evidence; no invented first-person tests; never republish source post text
- CASUAL_OBSERVATION: short lived observation; no mini-essay
- Weekly HUMOR: never (Wild Card only)

CLARITY:
- First 1–2 sentences: who/what + the point
- Forbidden empty padding alone: 조금, 약간, ~인 것 같다, 나쁘지 않다, 괜찮은 편, 그런 느낌, 미묘하게, 뭔가, 전반적으로 (as sole content)
- length_mode SHORT: no pad. LONG: structure only with known context

SAFETY:
- Never invent firsthand experiences or recent unverified announcements
- No stock-price chatter

JSON only. Each post MUST include:
slotId, core_thought, thinking_rail, audience_translation, content, score.
slotId MUST match input slotId exactly.
core_thought = one short thought (not full post). thinking_rail = rail id or label. audience_translation = short note or null.`;
}

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
        JSON.stringify({
          error: "XAI_API_KEY not configured in Supabase secrets",
          CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
          xai_usage: {
            seed_expansion: false,
            external_supplement: false,
            creator_generation: false,
          },
        }),
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
      dry_run_no_generation = false,
    } = body;

    const offset = typeof dayOffset === "number" ? dayOffset : 0;
    let effectiveSlots = Array.isArray(slots) ? slots : [];
    if (effectiveSlots.length === 0) {
      return new Response(
        JSON.stringify({ error: "slots array required and must not be empty — no silent theme fallback" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dry_run_no_generation === true) {
      const style = getCreatorStyle();
      const baseline = getStyleBaseline();
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
          xai_api_used: false,
          xai_usage: {
            seed_expansion: false,
            external_supplement: false,
            creator_generation: false,
          },
          generator_version: GENERATOR_VERSION,
          style_data: {
            version: style.version,
            sample_n: style.sample_n,
            median_post_chars: style.median_post_chars,
            mean_post_chars: style.mean_post_chars,
            baseline,
          },
          slots_received: effectiveSlots.map((s: any) => ({
            slotId: s.slotId,
            grounding_status: s.grounding_status,
            claim_types: s.claim_types,
            source_type: s.source_type || s.primary_source,
            source_id: s.source_id,
          })),
          note: "No generation: external model required for Creator Engine drafts",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workingSlots = effectiveSlots;
    const usedJson = JSON.stringify(usedRecord, null, 0);
    const scheduleMeta = startDate
      ? `startDate=${startDate} (scheduling metadata only — do NOT invent 오늘/방금 events)`
      : `startDate not provided`;
    const SYSTEM_PROMPT = buildSystemPrompt();

    async function callGrok(slotsSubset: any[]): Promise<any> {
      const withHints = slotsSubset.map((s: any) => {
        const hint = selectThinkingRailHint({
          topic: s.primaryTopic || s.concrete_subject,
          editorial_mode: s.editorial_mode,
        });
        return {
          ...compactSlotForModel(s),
          thinking_rail_hint: hint.id,
          thinking_rail_structure: hint.structure,
        };
      });
      const subsetJson = JSON.stringify(withHints, null, 0);
      const railCatalog = THINKING_RAIL_LIBRARY.map((r) => `${r.id}:${r.label}`).join(" | ");
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.
${scheduleMeta}

FLOW (required order per post):
Seed → Core Thought (one) → Thinking Rail → Audience Translation → Writing DNA → final content

Available thinking rails (structure only): ${railCatalog}

SLOTS (WHAT + grounding + optional rail hint — do not treat hint as mandatory):
${subsetJson}

Rules reminder:
- Decide ONE core_thought first (short claim/observation/interpretation — not full post)
- Choose thinking_rail that fits topic + mode + core thought + evidence
- Audience-translate where helpful (일상/사람/돈/시간/직장/생활) without distorting facts
- Only then apply Creator Writing DNA for final wording
- editorial_mode must shape the post (INFORMATIVE ≠ OPINION ≠ COMPARE ≠ CASUAL)
- Preserve tech names / proper nouns / verified facts from allowed_facts only
- Never invent first-person tests or locations/times not in anchors
- Respect do_not_invent and claim_types / grounding_status per slot
- VOCABULARY FIDELITY: match Publishing corpus rhythm — not polished report Korean
- Return slotId EXACTLY as given for each post

USED RECORD (avoid repeats):
${usedJson}

Return JSON only: {"posts":[{"slotId":"...","core_thought":"...","thinking_rail":"...","audience_translation":"...|null","content":"...","score":1-10}]}.`;

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

    const slotById = new Map<string, any>();
    for (const s of workingSlots) {
      const id = String(s.slotId || "");
      if (id) slotById.set(id, s);
    }
    const seenIds = new Set<string>();
    const mapping_errors: string[] = [];
    const qualityPosts: any[] = [];

    for (const p of allGenerated) {
      const t = String(p.content || p.final_text || "").trim();
      if (t.length < 8) continue;
      const latinChars = (t.match(/[A-Za-z]/g) || []).length;
      const totalChars = t.replace(/\s/g, "").length || 1;
      if (latinChars / totalChars >= 0.75) continue;

      const sid = String(p.slotId || "").trim();
      if (!sid) {
        mapping_errors.push("MISSING_SLOT_ID");
        continue;
      }
      if (seenIds.has(sid)) {
        mapping_errors.push(`DUPLICATE_SLOT_ID:${sid}`);
        continue;
      }
      if (!slotById.has(sid)) {
        mapping_errors.push(`UNKNOWN_SLOT_ID:${sid}`);
        continue;
      }
      seenIds.add(sid);
      qualityPosts.push({
        ...p,
        slotId: sid,
        content: t,
        final_text: t,
        core_thought: String(p.core_thought || "").trim() || null,
        thinking_rail: String(p.thinking_rail || "").trim() || null,
        audience_translation:
          p.audience_translation === null || p.audience_translation === undefined
            ? null
            : String(p.audience_translation).trim() || null,
      });
    }

    for (const s of workingSlots) {
      const id = String(s.slotId || "");
      if (id && !seenIds.has(id)) mapping_errors.push(`NO_OUTPUT_FOR_SLOT:${id}`);
    }

    const style = getCreatorStyle();
    const postsOut = buildGroundedPostsOut(
      qualityPosts,
      slotById,
      offset,
      GENERATOR_VERSION
    );

    return new Response(
      JSON.stringify({
        success: true,
        model: MODEL,
        count: postsOut.length,
        posts: postsOut,
        usedRecord,
        dayOffset: offset,
        voice: GENERATOR_VERSION,
        generator_version: GENERATOR_VERSION,
        CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
        xai_api_used: true,
        xai_usage: {
          seed_expansion: false,
          external_supplement: false,
          creator_generation: true,
        },
        mapping_errors,
        style_data: {
          version: style.version,
          sample_n: style.sample_n,
          median_post_chars: style.median_post_chars,
        },
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
    return new Response(
      JSON.stringify({
        error: msg,
        CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
        xai_usage: {
          seed_expansion: false,
          external_supplement: false,
          creator_generation: false,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
