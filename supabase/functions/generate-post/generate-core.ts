/** v10 generate-core + ORDER 0A count integrity */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  getCreatorDnaVoice,
  getVocabularyFidelityInstructions,
  getCreatorStyle,
  getStyleBaseline,
} from "./creator-style-data.ts";
import { scoreVocabularyFidelity, detectUnsupportedAdditions } from "./vocabulary-fidelity.ts";
import { buildGroundedPostsOut, compactSlotForModel } from "./grounding-out.ts";
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
import { buildEverydayLanguageInstructions, softEverydayClarityHint } from "./everyday-language.ts";
import { buildContextualStyleInstructions, softContextualStyleHint } from "./contextual-style.ts";
import { buildReaderStoryJudgeInstructions, softReaderStoryJudge } from "./reader-story-judge.ts";
import {
  MAX_SLOT_RETRIES,
  buildGenerateCountReport,
  missingSlotIds,
  type SlotAttempt,
} from "./count-integrity.ts";

const MODEL = "grok-4.5";
const GENERATOR_VERSION = "reader_story_v10_order4_count_integrity";

function buildSystemPrompt(): string {
  const voice = getCreatorDnaVoice();
  const vocab = getVocabularyFidelityInstructions();
  const style = getCreatorStyle();
  const stages = buildThoughtStagesInstructions();
  const reaction = buildReactionMechanismInstructions();
  const everyday = buildEverydayLanguageInstructions();
  const contextual = buildContextualStyleInstructions();
  const readerJudge = buildReaderStoryJudgeInstructions();
  return `You are the content generation engine for AutoPostPilot.\n\nROLE SPLIT:\n- Seed = WHAT; Creator DNA = HOW outer bound\n- Reaction Mechanism / Everyday Language / Contextual Style / Reader Story Invitation (v10)\n\n${stages}\n\n${reaction}\n\n${everyday}\n\n${contextual}\n\n${readerJudge}\n\n${voice}\n\n${vocab}\n\nSTYLE CORPUS n=${style.sample_n}, median ${style.median_post_chars}. No semantic elevation.\nSEED: rewrite stiff tech; preserve proper nouns and verified facts.\nGROUNDING: no invented experiences; respect do_not_invent.\nJSON posts must include slotId + content. Do NOT require CTA or questions.`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handleGeneratePost(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) {
      return new Response(JSON.stringify({
        error: "XAI_API_KEY not configured in Supabase secrets",
        CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
        xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const {
      jobId, startDate, dayOffset = 0, slots = [],
      usedRecord = { usedTopics: [], usedAngles: [], usedExamples: [], usedPlaces: [], usedOpenings: [], usedConclusions: [] },
      dry_run_no_generation = false,
    } = body;
    const offset = typeof dayOffset === "number" ? dayOffset : 0;
    let effectiveSlots = Array.isArray(slots) ? slots : [];
    if (effectiveSlots.length === 0) {
      return new Response(JSON.stringify({ error: "slots array required and must not be empty — no silent theme fallback" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dry_run_no_generation === true) {
      const style = getCreatorStyle();
      const baseline = getStyleBaseline();
      return new Response(JSON.stringify({
        success: true, dry_run: true, CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true, xai_api_used: false,
        xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        generator_version: GENERATOR_VERSION,
        style_data: { version: style.version, sample_n: style.sample_n, median_post_chars: style.median_post_chars, mean_post_chars: style.mean_post_chars, baseline },
        slots_received: effectiveSlots.map((s: any) => ({ slotId: s.slotId, grounding_status: s.grounding_status })),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        return { ...compactSlotForModel(s), thinking_rail_hint: hint.id, thinking_rail_structure: hint.structure, reaction_mechanism_hint: mechHint.id };
      });
      const subsetJson = JSON.stringify(withHints, null, 0);
      const railCatalog = THINKING_RAIL_LIBRARY.map((r) => `${r.id}:${r.label}`).join(" | ");
      const mechCatalog = REACTION_MECHANISM_LIBRARY.map((m) => m.id).join(" | ");
      const userMsg = `Generate exactly ${slotsSubset.length} Korean posts for dayOffset=${offset}.\n${scheduleMeta}\n\nFLOW: Seed → Reaction Mechanism → Core Thought → Thinking Rail → Audience Translation → Everyday Language → Contextual Style → Writing DNA → content\n\nRails: ${railCatalog}\nMechanisms: ${mechCatalog}\n\nSLOTS:\n${subsetJson}\n\nRules:\n- reaction_mechanism by reasoning (not template)\n- ONE core_thought; everyday language; contextual style; no invented self-disclosure\n- humor only if natural; never invent experiences\n- Do NOT require CTA or questions\n- Return slotId EXACTLY\n\nUSED:\n${usedJson}\n\nJSON: {"posts":[{"slotId":"...","core_thought":"...","thinking_rail":"...","audience_translation":"...|null","reaction_mechanism":"...","reaction_reason":"...","style_register":"...","content":"...","score":1-10}]}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      let response: Response;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` };
        if (jobId) headers["x-grok-conv-id"] = String(jobId);
        response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST", headers,
          body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }], temperature: 0.7, reasoning_effort: "low" }),
          signal: controller.signal,
        });
      } finally { clearTimeout(timer); }
      const rawText = await response.text();
      if (!response.ok) throw new Error(`Grok API failed: ${rawText.slice(0, 300)}`);
      return JSON.parse(rawText);
    }

    const slotById = new Map<string, any>();
    for (const s of workingSlots) {
      const id = String(s.slotId || "");
      if (id) slotById.set(id, s);
    }
    const requestedIds = workingSlots.map((s: any) => String(s.slotId || "")).filter(Boolean);
    const seenIds = new Set<string>();
    const mapping_errors: string[] = [];
    const qualityPosts: any[] = [];
    const attempts: SlotAttempt[] = [];
    let receivedFromModel = 0;
    let rejected = 0;
    let parserFailures = 0;
    let retriedSlots = 0;

    function acceptPost(p: any): boolean {
      const t = String(p.content || p.final_text || "").trim();
      if (t.length < 8) { rejected++; attempts.push({ slotId: String(p.slotId || ""), attempt: 0, status: "empty" }); return false; }
      const latinChars = (t.match(/[A-Za-z]/g) || []).length;
      const totalChars = t.replace(/\s/g, "").length || 1;
      if (latinChars / totalChars >= 0.75) { rejected++; attempts.push({ slotId: String(p.slotId || ""), attempt: 0, status: "latin_filter" }); return false; }
      const sid = String(p.slotId || "").trim();
      if (!sid) { mapping_errors.push("MISSING_SLOT_ID"); rejected++; return false; }
      if (seenIds.has(sid)) { mapping_errors.push(`DUPLICATE_SLOT_ID:${sid}`); rejected++; attempts.push({ slotId: sid, attempt: 0, status: "dup" }); return false; }
      if (!slotById.has(sid)) { mapping_errors.push(`UNKNOWN_SLOT_ID:${sid}`); rejected++; return false; }
      seenIds.add(sid);
      attempts.push({ slotId: sid, attempt: 0, status: "ok" });
      const softEveryday = softEverydayClarityHint(t);
      const slotMeta = slotById.get(sid) || {};
      const softStyle = softContextualStyleHint({ editorial_mode: slotMeta.editorial_mode, reaction_mechanism: String(p.reaction_mechanism || ""), topic: slotMeta.primaryTopic || slotMeta.concrete_subject });
      const styleRegister = String(p.style_register || "").trim() || softStyle.register_hint;
      const reactionMech = String(p.reaction_mechanism || "").trim() || null;
      const everydayClear = p.everyday_language_clear === true || p.everyday_language_clear === false ? p.everyday_language_clear : softEveryday.first_pass_clear;
      const humorPresent = p.natural_humor_present === true || p.natural_humor_present === false ? p.natural_humor_present : false;
      const storyJudge = softReaderStoryJudge({ content: t, reaction_mechanism: reactionMech, everyday_language_clear: everydayClear, natural_humor_present: humorPresent, style_register: styleRegister });
      qualityPosts.push({
        ...p, slotId: sid, content: t, final_text: t,
        core_thought: String(p.core_thought || "").trim() || null,
        thinking_rail: String(p.thinking_rail || "").trim() || null,
        audience_translation: p.audience_translation == null ? null : String(p.audience_translation).trim() || null,
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
      return true;
    }

    async function generateForSlots(slotsSubset: any[], attemptNo: number) {
      if (!slotsSubset.length) return;
      const batchSize = 8;
      for (let i = 0; i < slotsSubset.length; i += batchSize) {
        const subset = slotsSubset.slice(i, i + batchSize);
        let parsed: any = { posts: [] };
        try {
          const data = await callGrok(subset);
          const raw = data.choices?.[0]?.message?.content || "{}";
          try {
            const m = String(raw).match(/\{[\s\S]*\}/);
            parsed = JSON.parse(m ? m[0] : raw);
          } catch {
            parserFailures++;
            parsed = { posts: [] };
            for (const s of subset) attempts.push({ slotId: String(s.slotId || ""), attempt: attemptNo, status: "parse_fail" });
          }
        } catch (e: any) {
          parserFailures++;
          mapping_errors.push(`GROK_BATCH_FAIL:${String(e?.message || e).slice(0, 80)}`);
          for (const s of subset) attempts.push({ slotId: String(s.slotId || ""), attempt: attemptNo, status: "parse_fail" });
          continue;
        }
        const posts = Array.isArray(parsed?.posts) ? parsed.posts : [];
        receivedFromModel += posts.length;
        for (const p of posts) acceptPost(p);
      }
    }

    await generateForSlots(workingSlots, 0);
    for (let r = 1; r <= MAX_SLOT_RETRIES; r++) {
      const missing = missingSlotIds(requestedIds, seenIds);
      if (missing.length === 0) break;
      const retrySlots = missing.map((id) => slotById.get(id)).filter(Boolean);
      retriedSlots += retrySlots.length;
      mapping_errors.push(`RETRY_${r}_SLOTS:${missing.join(",")}`);
      await generateForSlots(retrySlots, r);
    }
    const unresolved = missingSlotIds(requestedIds, seenIds);
    for (const id of unresolved) {
      mapping_errors.push(`UNRESOLVED_SLOT:${id}`);
      attempts.push({ slotId: id, attempt: MAX_SLOT_RETRIES, status: "missing" });
    }
    const count_report = buildGenerateCountReport({
      requestedIds, acceptedIds: seenIds, receivedFromModel, rejected, parserFailures, retriedSlots,
      mappingErrors: mapping_errors, attempts,
    });
    const style = getCreatorStyle();
    const postsOut = buildGroundedPostsOut(qualityPosts, slotById, offset, GENERATOR_VERSION);
    const complete = unresolved.length === 0;
    return new Response(JSON.stringify({
      success: complete,
      partial: !complete,
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
      count_report,
      unresolved_slots: unresolved,
      style_data: { version: style.version, sample_n: style.sample_n, median_post_chars: style.median_post_chars },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(err);
    const msg = err?.name === "AbortError" ? "포스트 생성 시간 초과" : err.message || "Internal error";
    return new Response(JSON.stringify({
      error: msg,
      CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED: true,
      xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
