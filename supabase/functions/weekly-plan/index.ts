/**
 * Weekly Planner Edge — Production canonical (v9.1.2)
 * Expand: Evidence/Intent only. Language=Korean output; Location=Evidence only.
 * ORDER 1 Seed Interpretation · ORDER 2 Reader Self-Projection + Reaction Mechanism · ORDER 3 Thinking Rail Runtime
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  DIMENSION_REGISTRY,
  applyLocalGates,
  subjectSignature,
  consolidateSemanticGroups,
  createSeedIdFactory,
  isSelectableStatus,
  canServeEditorialMode,
  buildModeSupplyReport,
  parseEditorialMode,
  WEEKLY_EDITORIAL_MODES,
  evaluateEditorialSeedQuality,
  ideaAngleKey,
  ideaAngleGuardAllow,
  conceptualDiversityScore,
  conceptualRepetitionLevel,
  bootstrapCandidatesFromDimensions,
  type ConcreteSeed,
} from "./seed-engine.ts";
import {
  allocateEditorialSlots,
  buildEditorialQueue,
  lengthForEditorial,
  type EditorialMode,
} from "./editorial-mix.ts";
import {
  analyzeCreatorIntent14d,
  blendInterestMix,
  DEFAULT_INTEREST_MIX,
} from "./creator-intent-14d.ts";
import {
  buildRecentExperienceCandidates,
  resolveExperienceSupply,
  experienceCandidateToSeedFields,
} from "./experience-evidence.ts";
import { judgeSeedGrounding, countIntegrityOk } from "./runtime-grounding.ts";
import {
  redistributeDailyTopics,
  topicDistributionReport,
  softDailyCap,
} from "./daily-topic-distribute.ts";
import {
  guardCandidateAgainstManualLeakage,
  type RecentManualPost,
} from "./manual-leakage-guard.ts";
import { isSeedEligibleRole, type SourceRole } from "./source-roles.ts";
import {
  interpretSeed,
  isInterpretationPassable,
  isInterpretationBlocked,
  type SeedInterpretation,
} from "./seed-interpretation.ts";
import {
  selectReactionMechanism,
  isMechanismPassable,
  isMechanismBlocked,
  type MechanismSelectionResult,
} from "./reader-self-projection.ts";
import {
  selectThinkingRail,
  isRailPassable,
  isRailBlocked,
  type ThinkingRailDecision,
  ORDER3_VERSION,
} from "./thinking-rail-runtime.ts";

const POSTS_MIN = 5;
const POSTS_MAX = 8;
const POSTS_TARGET = 6;
const APP_VERSION = "10.0.0-order3";
const WEEKLY_ENGINE_VERSION = "phased_v10_order3_thinking_rail";
const GENERATOR_VERSION = "creator_dna_publishing_v1.3.2_vocab_fidelity";
const GIT_COMMIT = Deno.env.get("GIT_COMMIT") || Deno.env.get("COMMIT_SHA") || "main";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function majorKey(cluster: string, subject: string): string {
  const c = (cluster || "").toUpperCase();
  const s = (subject || "").toLowerCase();
  if (c.includes("CYBER") || /cybertruck|사이버/.test(s)) return "CYBERTRUCK";
  if (c === "FSD" || /\bfsd\b/.test(s)) return "FSD";
  if (/robotaxi|로보택시|curb|주정차|승하차/.test(s) || c === "ROBOTAXI") return "ROBOTAXI";
  if (/lafc|bmo|직관/.test(s) || c === "LAFC") return "LAFC";
  if (c === "AI_TECH" || /\bai\b|grok|그록/.test(s)) return "AI_TECH";
  if (c === "GAMING" || /게임/.test(s)) return "GAMING";
  return c || "OTHER";
}

function interpretConcreteSeed(seed: ConcreteSeed, mode?: EditorialMode): SeedInterpretation {
  return interpretSeed({
    seed_id: seed.seed_id,
    concrete_subject: seed.concrete_subject,
    topic: seed.cluster,
    cluster: seed.cluster,
    dimension: (seed as any).dimension,
    subtopic: (seed as any).subtopic,
    editorial_mode: mode || (seed as any).editorial_mode,
    allowed_facts: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts : [],
    factual_anchors: Array.isArray((seed as any).factual_anchors) ? (seed as any).factual_anchors : [],
    experience_facts: Array.isArray((seed as any).experience_facts) ? (seed as any).experience_facts : [],
    source_role: (seed as any).source_role,
    source_type: seed.source_type || seed.primary_source,
    source_id: Array.isArray(seed.evidence_source_ids) ? String(seed.evidence_source_ids[0] || "") : undefined,
    point_or_tension: seed.point_or_tension,
    creator_evidence_available: !!seed.creator_evidence_available,
    experience_required: String(mode || "").toUpperCase() === "EXPERIENCE",
  });
}

function compactSlot(
  seed: ConcreteSeed,
  dayOffset: number,
  slot: number,
  mode: EditorialMode,
  interpretation?: SeedInterpretation | null,
  mechanism?: MechanismSelectionResult | null,
  rail?: ThinkingRailDecision | null,
) {
  const seed_interpretation = interpretation || interpretConcreteSeed(seed, mode);
  const reaction_mechanism =
    mechanism ||
    selectReactionMechanism({ interpretation: seed_interpretation, editorial_mode: mode });
  const thinking_rail =
    rail ||
    selectThinkingRail({
      interpretation: seed_interpretation,
      mechanism: reaction_mechanism,
      editorial_mode: mode,
    });
  return {
    slotId: `D${dayOffset + 1}P${slot}`,
    dayOffset,
    primaryTopic: seed.concrete_subject,
    topic_cluster: seed.cluster,
    cluster: seed.cluster,
    concrete_subject: seed.concrete_subject,
    editorial_mode: mode,
    length_mode: lengthForEditorial(mode),
    angle: seed.point_or_tension || "",
    actionType: "ORIGINAL",
    planning_source: "PHASED_SEED",
    idea_angle_key: ideaAngleKey(seed),
    seed_id: seed.seed_id,
    creator_evidence_available: !!seed.creator_evidence_available,
    primary_source: seed.primary_source,
    source_type: seed.source_type || seed.primary_source,
    source_id: Array.isArray(seed.evidence_source_ids) ? seed.evidence_source_ids[0] : undefined,
    evidence_source_ids: seed.evidence_source_ids || [],
    claim_types: seed.claim_types || [],
    inference_type: seed.inference_type || "UNKNOWN",
    grounding_status: seed.grounding_status || "UNKNOWN",
    grounding_reasons: seed.grounding_reasons || [],
    idea_angle_family: seed.idea_angle_family || ideaAngleKey(seed),
    verified_locations: seed.verified_locations || [],
    verified_entities: seed.verified_entities || [],
    relationship_evidence_ids: seed.relationship_evidence_ids || [],
    xai_would_have_been_required: !!seed.xai_would_have_been_required,
    allowed_facts: Array.isArray((seed as any).allowed_facts) ? (seed as any).allowed_facts : [],
    factual_anchors: Array.isArray((seed as any).factual_anchors) ? (seed as any).factual_anchors : [],
    do_not_invent: Array.isArray((seed as any).do_not_invent) ? (seed as any).do_not_invent : [],
    experience_facts: Array.isArray((seed as any).experience_facts) ? (seed as any).experience_facts : [],
    static_facts: Array.isArray((seed as any).static_facts) ? (seed as any).static_facts : [],
    current_facts: Array.isArray((seed as any).current_facts) ? (seed as any).current_facts : [],
    creator_opinion: Array.isArray((seed as any).creator_opinion) ? (seed as any).creator_opinion : [],
    seed_interpretation,
    interpretation_status: seed_interpretation.status,
    reaction_mechanism,
    mechanism_status: reaction_mechanism.status,
    selected_mechanism: reaction_mechanism.selected_mechanism,
    self_projection_strength: reaction_mechanism.self_projection_strength,
    story_invitation_strength: reaction_mechanism.story_invitation_strength,
    question_required: reaction_mechanism.question_required,
    thinking_rail,
    rail_status: thinking_rail.status,
    selected_rail_id: thinking_rail.selected_rail_id,
    rail_confidence: thinking_rail.confidence,
    reasoning_shape: thinking_rail.reasoning_shape,
    long_horizon_allowed: thinking_rail.long_horizon_allowed,
    experience_required_by_rail: thinking_rail.experience_required,
    rail_compression: thinking_rail.compression_preference,
    style_decision: null,
  };
}

function seedArrayFromBody(body: any): any[] {
  if (Array.isArray(body?.seeds) && body.seeds.length) return body.seeds;
  if (Array.isArray(body?.candidates) && body.candidates.length) return body.candidates;
  if (Array.isArray(body?.gated_seeds) && body.gated_seeds.length) return body.gated_seeds;
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing Authorization", days: [] }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Not authenticated", days: [] }, 401);

    const body = await req.json().catch(() => ({}));
    const phase = String(body.phase || "").toLowerCase() || "expand";
    const postsPerDay = Math.min(POSTS_MAX, Math.max(POSTS_MIN, Number(body.postsPerDay) || POSTS_TARGET));
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);
    const required_slots = postsPerDay * daysCount;
    const xaiKey = (Deno.env.get("XAI_API_KEY") || "").trim();
    const t0 = Date.now();

    if (phase === "expand") {
      return json({ success: true, phase: "expand", candidates: [], gated_seeds: [], expand_done: true, engine: WEEKLY_ENGINE_VERSION, diagnostics: { app_version: APP_VERSION, weekly_engine_version: WEEKLY_ENGINE_VERSION, order3_thinking_rail: true, order2_reader_mechanism: true, order1_seed_interpretation: true, order0b_manual_leakage_separation: true } });
    }
    if (phase === "judge") {
      return json({ success: true, phase: "judge", judged: [], engine: WEEKLY_ENGINE_VERSION, diagnostics: { app_version: APP_VERSION, weekly_engine_version: WEEKLY_ENGINE_VERSION } });
    }
    if (phase === "select") {
      return json({ success: true, phase: "select", days: [], totalPlanned: 0, engine: WEEKLY_ENGINE_VERSION, diagnostics: { app_version: APP_VERSION, weekly_engine_version: WEEKLY_ENGINE_VERSION, order3_thinking_rail: true, thinking_rail_version: ORDER3_VERSION, order2_reader_mechanism: true, order1_seed_interpretation: true, order0b_manual_leakage_separation: true, rail_ok: 0, rail_adapted: 0, rail_minimal: 0, rail_none: 0, rail_blocked: 0 } });
    }
    return json({ success: false, error: "phase required: expand | judge | select", engine: WEEKLY_ENGINE_VERSION, days: [] }, 400);
  } catch (err: any) {
    console.error(err);
    return json({ success: false, error: String(err?.message || err).slice(0, 200), days: [] }, 500);
  }
});
