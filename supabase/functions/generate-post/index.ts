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
import {
  buildReactionMechanismInstructions,
  hintReactionMechanism,
  REACTION_MECHANISM_LIBRARY,
} from "./reaction-mechanism.ts";
import {
  buildEverydayLanguageInstructions,
  softEverydayClarityHint,
} from "./everyday-language.ts";
import {
  buildContextualStyleInstructions,
  softContextualStyleHint,
} from "./contextual-style.ts";

const MODEL = "grok-4.5";
const GENERATOR_VERSION = "contextual_style_v10_order3";

function buildSystemPrompt(): string {
  const voice = getCreatorDnaVoice();
  const vocab = getVocabularyFidelityInstructions();
  const style = getCreatorStyle();
  const stages = buildThoughtStagesInstructions();
  const reaction = buildReactionMechanismInstructions();
  const everyday = buildEverydayLanguageInstructions();
  const contextual = buildContextualStyleInstructions();
  return `You are the content generation engine for AutoPostPilot.\n\nROLE SPLIT:\n- Seed / primaryTopic / angle / postBrief = WHAT (facts, points, topic) — NOT final wording\n- editorial_mode + length_mode = editorial intent / format from Planner\n- Creator DNA (from Data Layer) = HOW outer bound (vocabulary, authenticity, length habits)\n- Reaction Mechanism (v10) = WHERE the reader can project their own story — NOT a template\n- Everyday Language (v10 ORDER 2) = TOP-LEVEL wording barrier — reason meaning first, no term dictionary\n- Contextual Style (v10 ORDER 3) = situational register inside Creator DNA — reason per seed\n\n${stages}\n\n${reaction}\n\n${everyday}\n\n${contextual}\n\n${voice}\n\n${vocab}\n\nSTYLE CORPUS (Publishing ORIGINAL n=${style.sample_n}, median ${style.median_post_chars} chars):\n- Do not force preferred-word insertion. Match rhythm/length/register distance to corpus.\n- Semantic elevation banned.\n\nSEED WORDING RULE:\n- Do NOT copy seed stiff/technical phrasing verbatim\n- Rewrite into Creator-natural Korean; preserve proper nouns, tech names, verified facts\n- Never distort verified facts\n\nGENERATOR GROUNDING:\n- Creator DNA = HOW only. Do NOT invent new factual WHAT.\n- Forbidden if absent from anchors: 오늘/어제/이번 주, 출퇴근, 구체 주행 시점, 방문 장소, 거리/시간/횟수, 직접 해봄/테스트함\n- Only state as fact what seed/evidence carries\n- do_not_invent list items must not appear as new claims\n\nEDITORIAL MODE: INFORMATIVE | COMPARE | OPINION | EXPERIENCE | CASUAL_OBSERVATION (Weekly HUMOR never)\n\nCLARITY: First 1–2 sentences who/what + point. SHORT: no pad.\n\nSAFETY: Never invent firsthand experiences. No stock-price chatter.\n\nJSON only. Each post MUST include:\nslotId, core_thought, thinking_rail, audience_translation, reaction_mechanism, reaction_reason, content, score.\nOptional: everyday_language_clear, everyday_rewrite_note, style_register, style_reason, self_disclosure_used, natural_humor_present.\nslotId MUST match input.`;
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
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
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
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
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
        const mechHint = hintReactionMechanism({
          topic: s.primaryTopic || s.concrete_subject,
          editorial_mode: s.editorial_mode,
        });
        return {
          ...compactSlotForModel(s),
          thinking_rail_hint: hint.id,
          thinking_rail_structure: hint.structure,
          reaction_mechanism_hint: mechHint.id,
        };
      });
      const subsetJson = JSON.stringify(withHints, null, 0);
      const railCatalog = THINKING_RAIL_LIBRARY.map((r) => `${r.id}:${r.label}`).join(" | ");
      const mechCatalog = REACTION_MECHANISM_LIBRARY.map((m) => m.id).join(" | ");
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.\n${scheduleMeta}\n\nFLOW:\nSeed → reason reader projection → Reaction Mechanism → Core Thought → Thinking Rail → Audience Translation → Everyday Language → Contextual Style → Writing DNA → content\n\nRails: ${railCatalog}\nMechanisms: ${mechCatalog}\n\nSLOTS:\n${subsetJson}\n\nRules:\n- Pick reaction_mechanism by reasoning (not template)\n- ONE core_thought; rail fit; audience translate without distortion\n- Everyday language: no jargon dictionary\n- Contextual style per seed inside Creator DNA; no invented self-disclosure; humor only if natural\n- Never invent experiences; respect do_not_invent\n- VOCABULARY FIDELITY: Publishing corpus rhythm\n- Return slotId EXACTLY\n\nUSED:\n${usedJson}\n\nJSON: {"posts":[{"slotId":"...","core_thought":"...","thinking_rail":"...","audience_translation":"...|null","reaction_mechanism":"...","reaction_reason":"...","everyday_language_clear":true|false|null,"style_register":"...","style_reason":"...","self_disclosure_used":true|false,"natural_humor_present":true|false,"content":"...","score":1-10}]}`;

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
      const softEveryday = softEverydayClarityHint(t);
      const slotMeta = slotById.get(sid) || {};
      const softStyle = softContextualStyleHint({
        editorial_mode: slotMeta.editorial_mode,
        reaction_mechanism: String(p.reaction_mechanism || ""),
        topic: slotMeta.primaryTopic || slotMeta.concrete_subject,
      });
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
        reaction_mechanism: String(p.reaction_mechanism || "").trim() || null,
        reaction_reason: String(p.reaction_reason || "").trim() || null,
        everyday_language_clear:
          p.everyday_language_clear === true || p.everyday_language_clear === false
            ? p.everyday_language_clear
            : softEveryday.first_pass_clear,
        everyday_rewrite_note:
          p.everyday_rewrite_note != null
            ? String(p.everyday_rewrite_note).trim() || null
            : softEveryday.rewrite_note,
        style_register: String(p.style_register || "").trim() || softStyle.register_hint,
        style_reason: String(p.style_reason || "").trim() || softStyle.reason,
        self_disclosure_used:
          p.self_disclosure_used === true || p.self_disclosure_used === false
            ? p.self_disclosure_used
            : false,
        natural_humor_present:
          p.natural_humor_present === true || p.natural_humor_present === false
            ? p.natural_humor_present
            : false,
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
