/**
 * v10 generate-core — ORDER1-4 wired handler
 * Imported by index.ts Deno.serve entry
 */
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
import {
  buildReaderStoryJudgeInstructions,
  softReaderStoryJudge,
} from "./reader-story-judge.ts";

const MODEL = "grok-4.5";
const GENERATOR_VERSION = "reader_story_v10_order4";

function buildSystemPrompt(): string {
  const voice = getCreatorDnaVoice();
  const vocab = getVocabularyFidelityInstructions();
  const style = getCreatorStyle();
  const stages = buildThoughtStagesInstructions();
  const reaction = buildReactionMechanismInstructions();
  const everyday = buildEverydayLanguageInstructions();
  const contextual = buildContextualStyleInstructions();
  const readerJudge = buildReaderStoryJudgeInstructions();
  return `You are the content generation engine for AutoPostPilot.\n\nROLE SPLIT:\n- Seed = WHAT; Creator DNA = HOW outer bound\n- Reaction Mechanism (v10) = reader projection door\n- Everyday Language (ORDER 2) = no jargon dictionary\n- Contextual Style (ORDER 3) = situational register\n- Reader Story Invitation (ORDER 4) = does reader want to open their own story? (NOT CTA)\n\n${stages}\n\n${reaction}\n\n${everyday}\n\n${contextual}\n\n${readerJudge}\n\n${voice}\n\n${vocab}\n\nSTYLE CORPUS n=${style.sample_n}, median ${style.median_post_chars} chars. No semantic elevation.\nSEED: rewrite stiff tech phrasing; preserve proper nouns and verified facts.\nGROUNDING: no invented experiences; respect do_not_invent.\nEDITORIAL: INFORMATIVE|COMPARE|OPINION|EXPERIENCE|CASUAL_OBSERVATION (no Weekly HUMOR).\nJSON posts: slotId, core_thought, thinking_rail, audience_translation, reaction_mechanism, reaction_reason, content, score.\nOptional: everyday_language_clear, style_register, reader_story_score, reader_story_pass, participation_barrier.\nDo NOT require questions or CTA.`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export async function handleGeneratePost(req: Request): Promise<Response> {
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
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
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
        usedTopics: [], usedAngles: [], usedExamples: [], usedPlaces: [], usedOpenings: [], usedConclusions: [],
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
          style_data: { version: style.version, sample_n: style.sample_n, median_post_chars: style.median_post_chars, mean_post_chars: style.mean_post_chars, baseline },
          slots_received: effectiveSlots.map((s: any) => ({
            slotId: s.slotId, grounding_status: s.grounding_status, claim_types: s.claim_types,
            source_type: s.source_type || s.primary_source, source_id: s.source_id,
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
        const hint = selectThinkingRailHint({ topic: s.primaryTopic || s.concrete_subject, editorial_mode: s.editorial_mode });
        const mechHint = hintReactionMechanism({ topic: s.primaryTopic || s.concrete_subject, editorial_mode: s.editorial_mode });
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
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.\n${scheduleMeta}\n\nFLOW: Seed → Reaction Mechanism → Core Thought → Thinking Rail → Audience Translation → Everyday Language → Contextual Style → Writing DNA → content\n\nRails: ${railCatalog}\nMechanisms: ${mechCatalog}\n\nSLOTS:\n${subsetJson}\n\nRules:\n- reaction_mechanism by reasoning (not template)\n- ONE core_thought; everyday language; contextual style; no invented self-disclosure\n- humor only if natural; never invent experiences\n- Do NOT require CTA or questions\n- Return slotId EXACTLY\n\nUSED:\n${usedJson}\n\nJSON: {\"posts\":[{\"slotId\":\"...\",\"core_thought\":\"...\",\"thinking_rail\":\"...\",\"audience_translation\":\"...|null\",\"reaction_mechanism\":\"...\",\"reaction_reason\":\"...\",\"style_register\":\"...\",\"reader_story_score\":1-10,\"reader_story_pass\":true|false,\"content\":\"...\",\"score\":1-10}]}`;

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
      return JSON.parse(rawText);
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
      allGenerated.push(...(Array.isArray(parsed?.posts) ? parsed.posts : []));
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
      if (!sid) { mapping_errors.push("MISSING_SLOT_ID"); continue; }
      if (seenIds.has(sid)) { mapping_errors.push(`DUPLICATE_SLOT_ID:${sid}`); continue; }
      if (!slotById.has(sid)) { mapping_errors.push(`UNKNOWN_SLOT_ID:${sid}`); continue; }
      seenIds.add(sid);
      const softEveryday = softEverydayClarityHint(t);
      const slotMeta = slotById.get(sid) || {};
      const softStyle = softContextualStyleHint({
        editorial_mode: slotMeta.editorial_mode,
        reaction_mechanism: String(p.reaction_mechanism || ""),
        topic: slotMeta.primaryTopic || slotMeta.concrete_subject,
      });
      const styleRegister = String(p.style_register || "").trim() || softStyle.register_hint;
      const reactionMech = String(p.reaction_mechanism || "").trim() || null;
      const everydayClear =
        p.everyday_language_clear === true || p.everyday_language_clear === false
          ? p.everyday_language_clear
          : softEveryday.first_pass_clear;
      const humorPresent =
        p.natural_humor_present === true || p.natural_humor_present === false
          ? p.natural_humor_present
          : false;
      const recentMechanisms = Array.isArray((usedRecord as any)?.usedMechanisms)
        ? (usedRecord as any).usedMechanisms : [];
      const recentStyles = Array.isArray((usedRecord as any)?.usedStyleRegisters)
        ? (usedRecord as any).usedStyleRegisters : [];
      const storyJudge = softReaderStoryJudge({
        content: t,
        reaction_mechanism: reactionMech,
        everyday_language_clear: everydayClear,
        natural_humor_present: humorPresent,
        recent_mechanisms: recentMechanisms,
        recent_style_registers: recentStyles,
        style_register: styleRegister,
      });
      qualityPosts.push({
        ...p,
        slotId: sid,
        content: t,
        final_text: t,
        core_thought: String(p.core_thought || "").trim() || null,
        thinking_rail: String(p.thinking_rail || "").trim() || null,
        audience_translation:
          p.audience_translation == null ? null : String(p.audience_translation).trim() || null,
        reaction_mechanism: reactionMech,
        reaction_reason: String(p.reaction_reason || "").trim() || null,
        everyday_language_clear: everydayClear,
        style_register: styleRegister,
        style_reason: String(p.style_reason || "").trim() || softStyle.reason,
        self_disclosure_used: p.self_disclosure_used === true,
        natural_humor_present: humorPresent,
        reader_story_score: typeof p.reader_story_score === "number" ? p.reader_story_score : storyJudge.reader_story_score,
        reader_story_pass: p.reader_story_pass === true || p.reader_story_pass === false ? p.reader_story_pass : storyJudge.pass,
        participation_barrier: typeof p.participation_barrier === "number" ? p.participation_barrier : storyJudge.participation_barrier,
        reader_story_invitation: storyJudge.reader_story_invitation,
        ai_tone_risk: storyJudge.ai_tone_risk,
        mechanism_repetition_risk: storyJudge.mechanism_repetition_risk,
        style_repetition_risk: storyJudge.style_repetition_risk,
        reader_story_notes: storyJudge.notes.join(",") || null,
      });
    }

    for (const s of workingSlots) {
      const id = String(s.slotId || "");
      if (id && !seenIds.has(id)) mapping_errors.push(`NO_OUTPUT_FOR_SLOT:${id}`);
    }

    const style = getCreatorStyle();
    const postsOut = buildGroundedPostsOut(qualityPosts, slotById, offset, GENERATOR_VERSION);
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
        xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: true },
        mapping_errors,
        style_data: { version: style.version, sample_n: style.sample_n, median_post_chars: style.median_post_chars },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(err);
    const msg = err?.name === "AbortError" ? "포스트 생성 시간 초과" : err.message || "Internal error";
    return new Response(
      JSON.stringify({
        error: msg,
        CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
        xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
