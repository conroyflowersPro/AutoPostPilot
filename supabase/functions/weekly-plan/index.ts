/**
 * Weekly Planner Edge — inferred seeds from learned data (not DIMENSION_REGISTRY bodies).
 * Seed supply: Creator DNA + engine rules + learned USER_DIRECT/performance → Grok infers quota AND fills it.
 * Will is DNA + engine, not a generate-box sentence. Registry templates are never a fallback.
 * Target volume: prefer 4/day; 5 fills 14:00–22:00 PT; bounds 3–8.
 * CORS: Access-Control-Allow-Methods included.
 * ORDER 0B: seed_eligible via isSeedEligibleRole; manual posts are learning only.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  applyLocalGates,
  createSeedIdFactory,
  bootstrapCandidatesFromDimensions,
  collectLearnedSeedSignals,
  isSelectableStatus,
  canServeEditorialMode,
  evaluateEditorialSeedQuality,
  ideaAngleKey,
  conceptualDiversityScore,
  conceptualRepetitionLevel,
  type ConcreteSeed,
} from "./seed-engine.ts";
import {
  allocateEditorialSlots,
  buildEditorialQueue,
  lengthForEditorial,
  type EditorialMode,
} from "./editorial-mix.ts";
import { judgeSeedGrounding, countIntegrityOk } from "./runtime-grounding.ts";
import {
  guardCandidateAgainstManualLeakage,
  type RecentManualPost,
} from "./manual-leakage-guard.ts";
import { isSeedEligibleRole, type SourceRole } from "./source-roles.ts";
import {
  parseEditorialMode,
  WEEKLY_EDITORIAL_MODES,
  buildModeSupplyReport,
} from "./seed-engine.ts";
import {
  redistributeDailyTopics,
  topicDistributionReport,
  softDailyCap,
} from "./daily-topic-distribute.ts";
import { enforcePersonalPerDay, demoteExperienceOnMassSlots, PERSONAL_PER_DAY_MAX } from "./seed-scope.ts";
import { expandSeedSupplyWithXai } from "./seed-supply-expansion.ts";
import { writeSlotBatch, V11_WRITER_MODEL, V11_SEED_MODEL } from "./order-write-pipeline.ts";
import {
  inferWeeklyQuota,
  quotaFromCadence,
  QUOTA_DAYS,
  QUOTA_PER_DAY_MIN,
  QUOTA_PER_DAY_MAX,
} from "./quota-inference.ts";
import { startWeeklyJob, statusWeeklyJob, tickWeeklyJob } from "./generation-job.ts";

const POSTS_MIN = QUOTA_PER_DAY_MIN;
const POSTS_MAX = QUOTA_PER_DAY_MAX;
const POSTS_TARGET = 4;
const APP_VERSION = "11.3.1";
const WEEKLY_ENGINE_VERSION = "v11_inferred_quota_fill";
const GENERATOR_VERSION = "order7b_independent_writer_v11";
const COLLISION_DAYS = 30;
const EXPAND_BATCH = 6;
const GIT_COMMIT = Deno.env.get("GIT_COMMIT") || Deno.env.get("COMMIT_SHA") || "main";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function seedArrayFromBody(body: any): any[] {
  if (Array.isArray(body?.seeds) && body.seeds.length) return body.seeds;
  if (Array.isArray(body?.candidates) && body.candidates.length) return body.candidates;
  if (Array.isArray(body?.gated_seeds) && body.gated_seeds.length) return body.gated_seeds;
  return [];
}

function compactSlotLite(seed: ConcreteSeed, dayOffset: number, slot: number, mode: EditorialMode) {
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
    evidence_source_ids: seed.evidence_source_ids || [],
    claim_types: seed.claim_types || [],
    inference_type: seed.inference_type || "UNKNOWN",
    grounding_status: seed.grounding_status || "UNKNOWN",
    grounding_reasons: seed.grounding_reasons || [],
    final_text: "",
    generation_status: "PENDING_GENERATION",
    order8d_functional_restore: true,
  };
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
    const daysCount = QUOTA_DAYS;
    const rawPpd = Number(body.postsPerDay);
    const postsPerDay = Number.isFinite(rawPpd)
      ? Math.min(POSTS_MAX, Math.max(POSTS_MIN, Math.round(rawPpd)))
      : POSTS_TARGET;
    const required_slots = Number(body.required_slots) > 0
      ? Math.round(Number(body.required_slots))
      : postsPerDay * daysCount;
    const xaiKey = (Deno.env.get("XAI_API_KEY") || "").trim();
    const openaiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    const t0 = Date.now();

    if (phase === "job_start") {
      const job = await startWeeklyJob({
        supabase,
        userId: user.id,
        startDate: String(body.startDate || "").slice(0, 10),
        topic: String(body.creatorIntent || body.topic || "").trim(),
        lafc_matches: Array.isArray(body.lafc_matches) ? body.lafc_matches : [],
        publishedTopics: Array.isArray(body.publishedTopics)
          ? body.publishedTopics.map(String)
          : Array.isArray(body.publishedTopics21d)
            ? body.publishedTopics21d.map(String)
            : [],
        scheduledTopics: Array.isArray(body.scheduledTopics) ? body.scheduledTopics.map(String) : [],
      });
      return json({ ...job, phase: "job_start", app_version: APP_VERSION, timing: { total_ms: Date.now() - t0 } });
    }
    if (phase === "job_status") {
      const job = await statusWeeklyJob(supabase, user.id, body.job_id ? String(body.job_id) : undefined);
      if (!job) return json({ success: false, error: "job not found", phase: "job_status" }, 404);
      return json({ ...job, phase: "job_status", app_version: APP_VERSION });
    }
    if (phase === "job_tick") {
      const jobId = String(body.job_id || "");
      if (!jobId) return json({ success: false, error: "job_id required", phase: "job_tick" }, 400);
      const job = await tickWeeklyJob({ supabase, userId: user.id, jobId, xaiKey, openaiKey });
      return json({ ...job, phase: "job_tick", app_version: APP_VERSION, timing: { total_ms: Date.now() - t0 } });
    }

    if (phase === "quota") {
      const intentText = String(body.creatorIntent || body.topic || "").trim();
      const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
      const { data: actRows } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, system_origin_class, x_post_id, meta")
        .gte("published_at", since)
        .limit(400);
      const publishedEvidence: Array<{
        text: string;
        source_id?: string;
        published_at?: string;
        post_type?: string;
        meta?: unknown;
        system_origin_class?: string;
      }> = [];
      for (const row of actRows || []) {
        const t = String((row as any).text_body || "").trim();
        if (t.length < 12) continue;
        const pt = String((row as any).post_type || (row as any).action_type || "").toUpperCase();
        if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) continue;
        const soc = String((row as any).system_origin_class || "").toUpperCase();
        if (soc && /AP_PIPELINE|APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED/.test(soc)) continue;
        publishedEvidence.push({
          text: t,
          source_id: (row as any).x_post_id || undefined,
          published_at: (row as any).published_at || undefined,
          post_type: pt,
          meta: (row as any).meta,
          system_origin_class: soc,
        });
      }
      const learned = collectLearnedSeedSignals({
        publishedEvidence,
        intentText,
      });
      const quota = xaiKey
        ? await inferWeeklyQuota({
          xaiKey,
          cadence: learned.cadence,
          clusterWeights: learned.cluster_weights,
          userDirectN: learned.user_direct_n,
          performanceHints: learned.performance_pattern_hints,
          learning: learned.learning,
          explicitCreatorIntent: intentText || undefined,
          model: V11_SEED_MODEL,
          timeoutMs: 18000,
        })
        : quotaFromCadence(learned.cadence, intentText);
      return json({
        success: true,
        phase: "quota",
        quota,
        postsPerDay: quota.posts_per_day,
        generationDays: quota.days,
        required_slots: quota.required_slots,
        learning: learned.learning,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          learned_user_direct_n: learned.user_direct_n,
          cadence: learned.cadence,
          cluster_weights: learned.cluster_weights,
          quota_source: quota.source,
          quota_grok_error: quota.grok_error || null,
          learning: learned.learning,
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    if (phase === "expand") {
      const published = Array.isArray(body.publishedTopics)
        ? body.publishedTopics.map(String)
        : Array.isArray(body.publishedTopics21d)
          ? body.publishedTopics21d.map(String)
          : [];
      const intentText = String(body.creatorIntent || body.topic || "").trim();
      const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
      const { data: actRows } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, x_post_id, meta")
        .gte("published_at", since)
        .limit(400);
      const evidenceSubjects: string[] = [];
      const publishedEvidence: Array<{
        text: string;
        source_id?: string;
        published_at?: string;
        post_type?: string;
        meta?: unknown;
        system_origin_class?: string;
      }> = [];
      for (const row of actRows || []) {
        const t = String((row as any).text_body || "").trim();
        if (t.length < 12) continue;
        const pt = String((row as any).post_type || (row as any).action_type || "").toUpperCase();
        if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) continue;
        const soc = String((row as any).system_origin_class || "").toUpperCase();
        if (soc && /AP_PIPELINE|APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED/.test(soc)) continue;
        evidenceSubjects.push(t.slice(0, 160));
        publishedEvidence.push({
          text: t,
          source_id: (row as any).x_post_id || undefined,
          published_at: (row as any).published_at || undefined,
          post_type: pt,
          meta: (row as any).meta,
          system_origin_class: soc,
        });
      }
      const learned = collectLearnedSeedSignals({
        publishedSubjects: published,
        publishedEvidence,
        intentText,
      });
      const batchIndex = Math.max(0, Number(body.dim_batch_index) || 0);
      const priorSubjects = Array.isArray(body.prior_subjects) ? body.prior_subjects.map(String) : [];
      const targetSupply = Math.max(required_slots, Math.ceil(required_slots * 1.15));
      const totalBatches = Math.max(1, Math.ceil(targetSupply / EXPAND_BATCH));
      const remaining = Math.max(0, targetSupply - priorSubjects.length);

      const local = batchIndex === 0
        ? bootstrapCandidatesFromDimensions({
          publishedSubjects: published,
          publishedEvidence,
          intentText,
        })
        : [];
      const nextId = createSeedIdFactory("s");
      const gated = applyLocalGates(local, [], nextId);
      const recentManual: RecentManualPost[] = publishedEvidence.map((p) => ({
        text: p.text,
        source_id: p.source_id,
        published_at: p.published_at,
        post_type: p.post_type,
      }));
      let leakage_blocked = 0;
      let candidates: any[] = [];
      for (const c of gated.passed) {
        const role = (c.source_role as SourceRole) || "SEED_SOURCE";
        const g = guardCandidateAgainstManualLeakage({
          source_role: role,
          concrete_subject: String(c.concrete_subject || ""),
          point_or_tension: c.point_or_tension ? String(c.point_or_tension) : undefined,
          recent_manual: recentManual,
          user_explicit: role === "USER_EXPLICIT_SEED",
        });
        if (!g.allow_as_seed) {
          leakage_blocked += 1;
          continue;
        }
        candidates.push({
          ...c,
          source_role: role,
          source_trace: {
            source_role: role,
            source_type: (c.source_type as string) || "CREATOR_INTENT",
            manual_source_used: false,
            manual_text_exposed_to_generation: false,
            leakage_guard_result: g.reason === "PASS" ? "PASS" : "BLOCK_SEMANTIC",
            semantic_recent_post_overlap: g.semantic_recent_post_overlap,
          },
        });
      }

      let xai_seed_expansion: any = {
        attempted: false,
        succeeded: false,
        error: null,
        returned: 0,
        reasoning_version: null,
        used_creator_dna: false,
        used_dimension_registry_as_seed_body: false,
      };
      const allowPaid = body.expand_with_xai !== false && body.allow_xai_enrich !== false;
      const viralIn = Array.isArray(body.viralCandidates)
        ? body.viralCandidates
        : Array.isArray(body.x_viral_candidates)
          ? body.x_viral_candidates
          : [];
      const thisNeed = Math.min(EXPAND_BATCH, Math.max(remaining, remaining > 0 ? remaining : 0));
      const cannotInfer = (error: string, extra?: Record<string, unknown>) =>
        json({
          success: false,
          error,
          phase: "expand",
          candidates: [],
          gated_seeds: [],
          seed_count: 0,
          required_slots,
          xai_seed_expansion,
          diagnostics: extra || {},
        }, 422);

      if (remaining > 0 && !allowPaid) {
        return cannotInfer("SEED_INFERENCE_REQUIRES_XAI", { note: "fixed registry templates are not a valid fallback" });
      }
      if (remaining > 0 && !xaiKey) {
        xai_seed_expansion.error = "missing_xai_key";
        return cannotInfer("SEED_INFERENCE_REQUIRES_XAI", { xai_seed_expansion });
      }
      if (remaining > 0 && xaiKey) {
        const existingHeld: ConcreteSeed[] = priorSubjects.map((s, i) => ({
          seed_id: `prior-${i + 1}`,
          cluster: "HELD",
          dimension: "PRIOR",
          concrete_subject: String(s).slice(0, 100),
          subject_signature: String(s).toLowerCase().slice(0, 80),
        }));
        const runExpand = () =>
          expandSeedSupplyWithXai({
            xaiKey,
            needed: Math.max(thisNeed, 1),
            existing: [...candidates, ...existingHeld] as ConcreteSeed[],
            explicitCreatorIntent: intentText || undefined,
            recentPublishedAngles: [...learned.recent_angle_labels, ...published].slice(0, 30),
            viralCandidates: viralIn.slice(0, 12),
            performancePatternHints: learned.performance_pattern_hints,
            clusterInterestWeights: learned.cluster_weights,
            registryInterestHints: learned.registry_interest_hints,
            userDirectN: learned.user_direct_n,
            learning: learned.learning,
            model: V11_SEED_MODEL,
            timeoutMs: 32000,
          });
        let xaiRes = await runExpand();
        xai_seed_expansion = {
          attempted: xaiRes.attempted,
          succeeded: xaiRes.succeeded,
          error: xaiRes.error,
          returned: xaiRes.returned,
          requested: xaiRes.requested,
          reasoning_version: (xaiRes as any).reasoning_version || null,
          used_creator_dna: !!(xaiRes as any).used_creator_dna,
          used_dimension_registry_as_seed_body: !!(xaiRes as any).used_dimension_registry_as_seed_body,
        };
        for (const s of xaiRes.seeds) {
          if (/관찰·판단 축/.test(String(s.concrete_subject || ""))) continue;
          candidates.push({
            ...s,
            source_role: "SEED_SOURCE",
            source_trace: {
              source_role: "SEED_SOURCE",
              source_type: "CREATOR_SEED_REASONING",
              manual_source_used: false,
              manual_text_exposed_to_generation: false,
              leakage_guard_result: "PASS",
            },
          });
        }
      }

      const cumulative = priorSubjects.length + candidates.length;
      const expand_done = cumulative >= required_slots;
      return json({
        success: true,
        phase: "expand",
        candidates,
        gated_seeds: candidates,
        expand_done,
        expand_error: xai_seed_expansion.error || null,
        xai_seed_expansion,
        dim_batch_index: batchIndex,
        dim_batch_total: totalBatches,
        next_dim_batch_index: batchIndex + 1,
        id_counter: cumulative,
        engine: WEEKLY_ENGINE_VERSION,
        xai_api_used: !!xai_seed_expansion.attempted,
        seed_count: candidates.length,
        required_slots,
        key_present: !!xaiKey,
        key_len: xaiKey.length,
        expand_model: xai_seed_expansion.attempted ? V11_SEED_MODEL : "none",
        supply_low: cumulative < required_slots,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          local_raw: local.length,
          local_passed: gated.passed.length,
          local_rejected: gated.local_gate_rejected,
          expand_model: xai_seed_expansion.attempted ? V11_SEED_MODEL : "none",
          evidence_activity_rows: (actRows || []).length,
          evidence_subjects: evidenceSubjects.length,
          published_evidence_rows: publishedEvidence.length,
          published_input: published.length,
          learned_user_direct_n: learned.user_direct_n,
          cluster_weights: learned.cluster_weights,
          registry_as_seed_body: false,
          order0b_manual_leakage_separation: true,
          order0b_leakage_blocked: leakage_blocked,
          order8d_functional_restore: true,
          order8d_cors_methods: true,
          xai_seed_expansion,
          language_policy: "Korean output; location only from Evidence",
          supply_low: cumulative < required_slots,
          required_slots,
          cumulative,
          target_supply: targetSupply,
          xai_usage: {
            seed_expansion: !!xai_seed_expansion.attempted,
            external_supplement: false,
            creator_generation: false,
          },
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    if (phase === "judge") {
      const batch = seedArrayFromBody(body);
      const judged: ConcreteSeed[] = [];
      let grounding_reject = 0;
      for (const b of batch) {
        const mode = parseEditorialMode(b.requested_editorial_mode || b.editorial_mode) || "INFORMATIVE";
        const g = judgeSeedGrounding({
          concrete_subject: String(b.concrete_subject || ""),
          point_or_tension: b.point_or_tension ? String(b.point_or_tension) : undefined,
          editorial_mode: mode,
          cluster: b.cluster ? String(b.cluster) : undefined,
          creator_evidence_available: !!b.creator_evidence_available,
          experience_required: !!b.experience_required,
          primary_source: b.primary_source ? String(b.primary_source) : undefined,
          evidence_source_ids: Array.isArray(b.evidence_source_ids) ? b.evidence_source_ids.map(String) : undefined,
          relationship_evidence_ids: Array.isArray(b.relationship_evidence_ids)
            ? b.relationship_evidence_ids.map(String)
            : undefined,
          verified_locations: Array.isArray(b.verified_locations) ? b.verified_locations.map(String) : undefined,
          verified_entities: Array.isArray(b.verified_entities) ? b.verified_entities.map(String) : undefined,
        });
        if (!g.pass) {
          grounding_reject += 1;
          judged.push({
            ...b,
            status: "REJECTED",
            editorial_fit: "POOR",
            grounding_status: g.provenance.grounding_status,
            grounding_reasons: g.provenance.reasons,
            claim_types: g.provenance.claim_types,
            inference_type: g.provenance.inference_type,
            source_type: g.provenance.source_type,
          } as any);
          continue;
        }
        b.grounding_status = g.provenance.grounding_status;
        b.grounding_reasons = g.provenance.reasons;
        b.claim_types = g.provenance.claim_types;
        b.inference_type = g.provenance.inference_type;
        b.source_type = g.provenance.source_type;
        const q = evaluateEditorialSeedQuality(b, mode);
        if (!q.pass) {
          judged.push({ ...b, status: "HOLD", editorial_fit: "POOR" });
          continue;
        }
        judged.push({
          ...b,
          status: isSelectableStatus(b.status) ? b.status : "ELIGIBLE",
          editorial_fit: "ACCEPTABLE",
          requested_editorial_mode: mode,
        });
      }
      return json({
        success: true,
        phase: "judge",
        judged,
        engine: WEEKLY_ENGINE_VERSION,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          grounding_reject,
          order8d_functional_restore: true,
          xai_api_used: false,
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
      });
    }

    if (phase === "select") {
      const seedsIn: ConcreteSeed[] = seedArrayFromBody(body) as ConcreteSeed[];
      const mix = allocateEditorialSlots(required_slots, body.editorial_ratio || undefined);
      const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
      const { data: acts } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, meta, x_post_id")
        .gte("published_at", since)
        .limit(500);
      const recentManualSelect: RecentManualPost[] = (acts || [])
        .map((row: any) => ({
          text: String(row.text_body || "").trim(),
          source_id: row.x_post_id,
          published_at: row.published_at,
          post_type: String(row.post_type || row.action_type || ""),
        }))
        .filter((r: RecentManualPost) => r.text.length >= 12);
      let pool: ConcreteSeed[] = [];
      for (const s of seedsIn) {
        if (!s?.concrete_subject) continue;
        if (!isSelectableStatus(s.status as any)) continue;
        const role = ((s as any).source_role as SourceRole) || "SEED_SOURCE";
        if (!isSeedEligibleRole(role)) continue;
        const g = guardCandidateAgainstManualLeakage({
          source_role: role,
          concrete_subject: String(s.concrete_subject || ""),
          point_or_tension: s.point_or_tension ? String(s.point_or_tension) : undefined,
          recent_manual: recentManualSelect,
          user_explicit: role === "USER_EXPLICIT_SEED",
        });
        if (!g.allow_as_seed) continue;
        pool.push(s);
      }
      const usedModes: Record<string, number> = {};
      const selectedWeekly: ConcreteSeed[] = [];
      const queue = buildEditorialQueue(mix.allocation as any);
      const outDays: Array<{ dayOffset: number; posts: any[] }> = Array.from({ length: daysCount }, (_, i) => ({
        dayOffset: i,
        posts: [],
      }));
      for (const plannedMode of queue) {
        const mode = plannedMode as EditorialMode;
        const candidates = pool
          .map((s, i) => ({ s, i, div: conceptualDiversityScore(s, selectedWeekly) }))
          .filter(({ s }) => canServeEditorialMode(s, mode))
          .sort((a, b) => b.div - a.div);
        let picked: ConcreteSeed | null = null;
        for (const { s, i } of candidates) {
          if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH") continue;
          picked = s;
          pool.splice(i, 1);
          break;
        }
        if (!picked) continue;
        selectedWeekly.push(picked);
        usedModes[mode] = (usedModes[mode] || 0) + 1;
        let bestDay = 0;
        let bestScore = 1e9;
        for (let d = 0; d < daysCount; d++) {
          if (outDays[d].posts.length >= postsPerDay) continue;
          const n = outDays[d].posts.filter(
            (p) => majorKey(p.cluster, p.concrete_subject) === majorKey(picked!.cluster, picked!.concrete_subject)
          ).length;
          const score = n * 10 + outDays[d].posts.length;
          if (score < bestScore) {
            bestScore = score;
            bestDay = d;
          }
        }
        if (outDays[bestDay].posts.length >= postsPerDay) {
          for (let d = 0; d < daysCount; d++) {
            if (outDays[d].posts.length < postsPerDay) {
              bestDay = d;
              break;
            }
          }
        }
        outDays[bestDay].posts.push(compactSlotLite(picked, bestDay, outDays[bestDay].posts.length + 1, mode));
      }
      let flatCount = outDays.reduce((s, d) => s + d.posts.length, 0);
      const baseNeed = mix.base_required_slots;
      while (flatCount < baseNeed && pool.length > 0) {
        let minD = 0;
        for (let i = 1; i < outDays.length; i++) {
          if (outDays[i].posts.length < outDays[minD].posts.length) minD = i;
        }
        if (outDays[minD].posts.length >= postsPerDay) break;
        const idx = pool.findIndex((s) => isSelectableStatus(s.status as any));
        if (idx < 0) break;
        const seed = pool.splice(idx, 1)[0];
        const mode = (WEEKLY_EDITORIAL_MODES.find((m) => canServeEditorialMode(seed, m)) || "INFORMATIVE") as EditorialMode;
        selectedWeekly.push(seed);
        outDays[minD].posts.push(compactSlotLite(seed, minD, outDays[minD].posts.length + 1, mode));
        usedModes[mode] = (usedModes[mode] || 0) + 1;
        flatCount++;
      }
      const redistributed = redistributeDailyTopics(outDays, postsPerDay);
      enforcePersonalPerDay(redistributed.days, PERSONAL_PER_DAY_MAX);
      demoteExperienceOnMassSlots(redistributed.days);
      for (let di = 0; di < redistributed.days.length; di++) {
        redistributed.days[di].posts.forEach((p: any, si: number) => {
          p.dayOffset = di;
          p.slotId = `D${di + 1}P${si + 1}`;
        });
      }
      const totalPlanned = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
      if (totalPlanned < required_slots) {
        return json({
          success: false,
          error: "NEED_MORE_SEEDS",
          need_more_seeds: true,
          detail: `planned ${totalPlanned} < inferred quota ${required_slots}. Client must keep inferring until filled.`,
          phase: "select",
          days: redistributed.days,
          totalPlanned,
          required_slots,
          diagnostics: {
            required_slots,
            input_seed_count: seedsIn.length,
            pool_after_gates: pool.length + totalPlanned,
          },
        });
      }
      return json({
        success: true,
        phase: "select",
        days: redistributed.days,
        totalPlanned,
        mode_supply_low: totalPlanned < baseNeed,
        topic_supply_low: false,
        editorial_mix: {
          base_required_slots: mix.base_required_slots,
          final_slots_target: mix.final_slots,
          allocation: mix.allocation,
          used_modes: usedModes,
          weekly_humor: 0,
        },
        diagnostics: {
          required_slots,
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          engine: WEEKLY_ENGINE_VERSION,
          input_seed_count: seedsIn.length,
          count_integrity: countIntegrityOk(mix.base_required_slots, totalPlanned),
          order8d_functional_restore: true,
          order8d_cors_methods: true,
          order0b_manual_leakage_separation: true,
          order8d_note: "v11 write phase uses ORDER 7B ChatGPT writer; Grok is quota/seeds only; generate-post is not the write path",
          soft_daily_cap: softDailyCap(postsPerDay),
          max_daily_topic: redistributed.max_daily_topic,
          topic_distribution: topicDistributionReport(redistributed.days),
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    if (phase === "write") {
      const slots = Array.isArray(body.slots) ? body.slots : seedArrayFromBody(body);
      if (!slots.length) {
        return json({ success: false, error: "write phase requires slots", posts: [] }, 400);
      }
      const dryRun = body.dry_run_generation === true;
      const voiceSince = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { data: voiceActs } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, system_origin_class, meta")
        .gte("published_at", voiceSince)
        .limit(400);
      const posts = await writeSlotBatch({
        slots,
        openaiKey: openaiKey || null,
        dryRun,
        voiceRows: (voiceActs || []) as any,
      });
      return json({
        success: true,
        phase: "write",
        posts,
        engine: WEEKLY_ENGINE_VERSION,
        writer_model: V11_WRITER_MODEL,
        system_origin_class: "AP_PIPELINE",
        chatgpt_writer_attempted: posts.some((p) => p.writer_call_attempted),
        xai_usage: {
          seed_expansion: false,
          external_supplement: false,
          creator_generation: false,
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    return json(
      { success: false, error: "phase required: job_start | job_tick | job_status | expand | judge | select | write", engine: WEEKLY_ENGINE_VERSION, days: [] },
      400
    );
  } catch (err: any) {
    console.error(err);
    return json({ success: false, error: String(err?.message || err).slice(0, 200), days: [] }, 500);
  }
});
